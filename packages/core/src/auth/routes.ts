import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { signToken } from './jwt.js';
import type { EventBus } from '../event-bus/index.js';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
};

const loginSchema = z.object({
  email: z.string().email('请输入有效邮箱'),
  password: z.string().min(1, '请输入密码'),
});

const registerSchema = z.object({
  name: z.string().min(2, '姓名至少2个字符'),
  email: z.string().email('请输入有效邮箱'),
  password: z.string().min(6, '密码至少6个字符'),
  role: z.enum(['TEACHER', 'STUDENT', 'ADMIN']).default('STUDENT'),
  schoolName: z.string().min(2, '机构名称至少2个字符').optional(),
  independent: z.boolean().optional(), // 独立教师模式
}).refine(
  (data) => data.role !== 'ADMIN' || (data.schoolName && data.schoolName.length >= 2),
  { message: '机构注册必须填写机构名称', path: ['schoolName'] },
);

function generateSchoolCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function registerAuthRoutes(app: FastifyInstance, prisma: PrismaClient, eventBus?: EventBus) {
  // 登录
  app.post('/api/auth/login', async (request, reply) => {
    const result = loginSchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({ error: result.error.errors[0].message });
    }

    const { email, password } = result.data;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return reply.code(401).send({ error: '邮箱或密码错误' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return reply.code(401).send({ error: '邮箱或密码错误' });
    }

    if (user.status !== 'ACTIVE') {
      return reply.code(403).send({ error: '账号已被禁用' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // 检查是否有 Teacher profile（独立教师 = ADMIN + Teacher）
    const hasTeacherProfile = await prisma.teacher.findUnique({ where: { userId: user.id } });

    const token = signToken({ userId: user.id, email: user.email ?? undefined, role: user.role, schoolId: user.schoolId ?? undefined });
    reply.setCookie('token', token, COOKIE_OPTIONS);
    return {
      token,
      user: {
        id: user.id, name: user.name, email: user.email, role: user.role,
        schoolId: user.schoolId, isTeacher: !!hasTeacherProfile,
      },
    };
  });

  // 注册
  app.post('/api/auth/register', async (request, reply) => {
    const result = registerSchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({ error: result.error.errors[0].message });
    }

    const { name, email, password, role } = result.data;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.code(409).send({ error: '该邮箱已被注册' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const existingSchool = await prisma.school.findFirst();

    let schoolId: string | undefined;
    let finalRole = role;
    let createTeacherProfile = false;

    if (role === 'ADMIN') {
      // 单机构模式：系统中只允许一个学校
      if (existingSchool) {
        return reply.code(409).send({ error: '系统已有机构注册，请联系管理员获取账号' });
      }

      const schoolName = result.data.schoolName!;
      let code = generateSchoolCode();
      while (await prisma.school.findUnique({ where: { code } })) {
        code = generateSchoolCode();
      }
      const school = await prisma.school.create({
        data: { name: schoolName, code },
      });
      schoolId = school.id;

      // 独立教师模式：ADMIN + Teacher profile
      if (result.data.independent) {
        createTeacherProfile = true;
      }
    } else if (role === 'TEACHER') {
      if (!existingSchool) {
        return reply.code(400).send({ error: '暂无学校，请先注册为独立教师或机构' });
      }
      // 独立教师模式下不允许教师注册
      const admin = await prisma.user.findFirst({ where: { schoolId: existingSchool.id, role: 'ADMIN' }, select: { id: true } });
      if (admin) {
        const adminIsTeacher = await prisma.teacher.findUnique({ where: { userId: admin.id } });
        if (adminIsTeacher) {
          return reply.code(400).send({ error: '当前为独立教师模式，仅开放学生注册' });
        }
      }
      schoolId = existingSchool.id;
      createTeacherProfile = true;
    } else if (role === 'STUDENT') {
      if (!existingSchool) {
        return reply.code(400).send({ error: '暂无学校，请等待教师或机构先注册' });
      }
      schoolId = existingSchool.id;
    }

    const user = await prisma.user.create({
      data: { name, email, passwordHash, role: finalRole, schoolId },
    });

    if (createTeacherProfile) {
      await prisma.teacher.create({ data: { userId: user.id } });
    }
    if (role === 'STUDENT') {
      await prisma.student.create({ data: { userId: user.id } });
    }

    eventBus?.emit('user:created', { userId: user.id, name: user.name, role: user.role });

    const token = signToken({ userId: user.id, email: user.email ?? undefined, role: user.role, schoolId: user.schoolId ?? undefined });
    reply.setCookie('token', token, COOKIE_OPTIONS);
    return {
      token,
      user: {
        id: user.id, name: user.name, email: user.email, role: user.role,
        schoolId: user.schoolId, isTeacher: createTeacherProfile,
      },
    };
  });

  // 获取当前用户
  app.get('/api/auth/me', {
    preHandler: [async (req, rep) => {
      const { authMiddleware } = await import('./middleware.js');
      return authMiddleware(req, rep);
    }],
  }, async (request) => {
    const { userId } = (request as any).user;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, avatarUrl: true, schoolId: true },
    });
    if (!user) return { user: null };
    const hasTeacher = await prisma.teacher.findUnique({ where: { userId } });
    return { user: { ...user, isTeacher: !!hasTeacher } };
  });

  // 登出
  app.post('/api/auth/logout', async (request, reply) => {
    reply.clearCookie('token', { path: '/' });
    return { success: true };
  });

  // 检查注册状态（单机构模式）
  app.get('/api/auth/register-status', async () => {
    const school = await prisma.school.findFirst({ select: { id: true, name: true } });
    if (!school) {
      return { hasSchool: false, schoolName: null, allowTeacher: false };
    }

    // 检查管理员是否是独立教师（有 Teacher profile）
    // 独立教师模式：只开放学生注册；机构模式：教师+学生都可注册
    const admin = await prisma.user.findFirst({
      where: { schoolId: school.id, role: 'ADMIN' },
      select: { id: true },
    });
    let isIndependentTeacher = false;
    if (admin) {
      const hasTeacher = await prisma.teacher.findUnique({ where: { userId: admin.id } });
      isIndependentTeacher = !!hasTeacher;
    }

    return {
      hasSchool: true,
      schoolName: school.name,
      allowTeacher: !isIndependentTeacher,
    };
  });
}
