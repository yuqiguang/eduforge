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
  role: z.enum(['TEACHER', 'STUDENT']).default('STUDENT'),
});

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

    const token = signToken({ userId: user.id, email: user.email ?? undefined, role: user.role });
    reply.setCookie('token', token, COOKIE_OPTIONS);
    return { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
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
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role },
    });

    if (role === 'TEACHER') {
      await prisma.teacher.create({ data: { userId: user.id } });
    } else {
      await prisma.student.create({ data: { userId: user.id } });
    }

    eventBus?.emit('user:created', { userId: user.id, name: user.name, role: user.role });

    const token = signToken({ userId: user.id, email: user.email ?? undefined, role: user.role });
    reply.setCookie('token', token, COOKIE_OPTIONS);
    return { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
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
    return { user };
  });

  // 登出
  app.post('/api/auth/logout', async (request, reply) => {
    reply.clearCookie('token', { path: '/' });
    return { success: true };
  });
}
