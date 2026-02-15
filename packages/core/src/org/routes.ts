import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authMiddleware, requireRole } from '../auth/middleware.js';
import type { EventBus } from '../event-bus/index.js';

const updateSchoolSchema = z.object({
  name: z.string().min(2, '学校名称至少2个字符').optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
});

export function registerOrgRoutes(app: FastifyInstance, prisma: PrismaClient, eventBus?: EventBus) {
  // 学校列表
  app.get('/api/schools', { preHandler: [authMiddleware] }, async () => {
    return prisma.school.findMany({ orderBy: { createdAt: 'desc' } });
  });

  // 获取学校详情
  app.get('/api/schools/:id', {
    preHandler: [authMiddleware, requireRole('ADMIN', 'SUPER_ADMIN')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = (request as any).user;

    // ADMIN 只能查看本校
    if (user.role === 'ADMIN' && user.schoolId !== id) {
      return reply.code(403).send({ error: '无权查看其他学校信息' });
    }

    const school = await prisma.school.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });

    if (!school) {
      return reply.code(404).send({ error: '学校不存在' });
    }

    return school;
  });

  // 更新学校信息
  app.patch('/api/schools/:id', {
    preHandler: [authMiddleware, requireRole('ADMIN', 'SUPER_ADMIN')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = (request as any).user;

    if (user.role === 'ADMIN' && user.schoolId !== id) {
      return reply.code(403).send({ error: '无权修改其他学校信息' });
    }

    const result = updateSchoolSchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({ error: result.error.errors[0].message });
    }

    const school = await prisma.school.update({
      where: { id },
      data: result.data,
    });

    return school;
  });

  // 获取学校成员列表
  app.get('/api/schools/:id/members', {
    preHandler: [authMiddleware, requireRole('ADMIN', 'SUPER_ADMIN')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = (request as any).user;

    if (user.role === 'ADMIN' && user.schoolId !== id) {
      return reply.code(403).send({ error: '无权查看其他学校成员' });
    }

    const members = await prisma.user.findMany({
      where: { schoolId: id },
      select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    return members;
  });

  // 年级列表
  app.get('/api/grades', { preHandler: [authMiddleware] }, async () => {
    return prisma.grade.findMany({
      include: { studyLevel: true },
      orderBy: { order: 'asc' },
    });
  });

  // 班级列表
  app.get('/api/classes', { preHandler: [authMiddleware] }, async (request) => {
    const { gradeId } = request.query as { gradeId?: string };
    const user = (request as any).user;
    return prisma.class.findMany({
      where: gradeId ? { gradeId } : undefined,
      include: {
        grade: true,
        students: { select: { studentId: true } },
        teachers: { include: { teacher: { include: { user: { select: { name: true } } } }, subject: true } },
      },
      orderBy: { name: 'asc' },
    });
  });

  // 创建班级
  app.post('/api/classes', { preHandler: [authMiddleware, requireRole('TEACHER', 'ADMIN', 'SUPER_ADMIN')] }, async (request, reply) => {
    const body = request.body as any;
    if (!body.name || !body.gradeId) {
      return reply.code(400).send({ error: '班级名称和年级为必填项' });
    }
    const cls = await prisma.class.create({
      data: {
        name: body.name,
        gradeId: body.gradeId,
        academicYear: body.academicYear || new Date().getFullYear().toString(),
      },
      include: { grade: true, students: { select: { studentId: true } } },
    });
    eventBus?.emit('class:created', { classId: cls.id, name: cls.name, gradeId: cls.gradeId });
    return cls;
  });

  // 获取班级学生列表
  app.get('/api/classes/:id/students', { preHandler: [authMiddleware] }, async (request) => {
    const { id } = request.params as { id: string };
    const classStudents = await prisma.classStudent.findMany({
      where: { classId: id },
      include: {
        student: { include: { user: { select: { id: true, name: true, email: true } } } },
      },
    });
    return classStudents.map((cs: any) => ({
      studentId: cs.studentId,
      ...cs.student.user,
    }));
  });

  // 学科列表
  app.get('/api/subjects', { preHandler: [authMiddleware] }, async () => {
    return prisma.subject.findMany({ orderBy: { order: 'asc' } });
  });

  // ===== 管理后台 API =====

  // 系统统计概览
  app.get('/api/admin/stats', {
    preHandler: [authMiddleware, requireRole('ADMIN', 'SUPER_ADMIN')],
  }, async (request) => {
    const user = (request as any).user;
    const schoolFilter = user.role === 'ADMIN' && user.schoolId ? { schoolId: user.schoolId } : {};

    const [userCount, teacherCount, studentCount, classCount, schoolCount] = await Promise.all([
      prisma.user.count({ where: schoolFilter }),
      prisma.user.count({ where: { ...schoolFilter, role: 'TEACHER' } }),
      prisma.user.count({ where: { ...schoolFilter, role: 'STUDENT' } }),
      prisma.class.count(),
      prisma.school.count(),
    ]);

    return { userCount, teacherCount, studentCount, classCount, schoolCount };
  });

  // 用户列表（管理后台）
  app.get('/api/admin/users', {
    preHandler: [authMiddleware, requireRole('ADMIN', 'SUPER_ADMIN')],
  }, async (request) => {
    const user = (request as any).user;
    const schoolFilter = user.role === 'ADMIN' && user.schoolId ? { schoolId: user.schoolId } : {};

    const users = await prisma.user.findMany({
      where: schoolFilter,
      select: { id: true, name: true, email: true, role: true, status: true, lastLoginAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    return users;
  });

  // 更新用户状态
  app.patch('/api/admin/users/:id/status', {
    preHandler: [authMiddleware, requireRole('ADMIN', 'SUPER_ADMIN')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: string };
    const currentUser = (request as any).user;

    if (!['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(status)) {
      return reply.code(400).send({ error: '无效状态' });
    }

    // 不能修改自己的状态
    if (id === currentUser.userId) {
      return reply.code(400).send({ error: '不能修改自己的状态' });
    }

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      return reply.code(404).send({ error: '用户不存在' });
    }

    // ADMIN 只能管理本校用户
    if (currentUser.role === 'ADMIN' && target.schoolId !== currentUser.schoolId) {
      return reply.code(403).send({ error: '无权管理其他学校用户' });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { status: status as any },
      select: { id: true, name: true, email: true, role: true, status: true },
    });

    return updated;
  });

  // 获取系统设置
  app.get('/api/admin/settings', {
    preHandler: [authMiddleware, requireRole('ADMIN', 'SUPER_ADMIN')],
  }, async () => {
    const settings = await prisma.setting.findMany();
    const result: Record<string, any> = {};
    for (const s of settings) {
      result[s.key] = s.value;
    }
    return result;
  });

  // 更新系统设置
  app.put('/api/admin/settings', {
    preHandler: [authMiddleware, requireRole('ADMIN', 'SUPER_ADMIN')],
  }, async (request) => {
    const body = request.body as Record<string, any>;
    for (const [key, value] of Object.entries(body)) {
      await prisma.setting.upsert({
        where: { key },
        update: { value: value as any },
        create: { key, value: value as any },
      });
    }
    return { success: true };
  });
}
