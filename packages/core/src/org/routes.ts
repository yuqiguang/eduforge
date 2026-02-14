import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, requireRole } from '../auth/middleware.js';

export function registerOrgRoutes(app: FastifyInstance, prisma: PrismaClient) {
  // 学校列表
  app.get('/api/schools', { preHandler: [authMiddleware] }, async () => {
    return prisma.school.findMany({ orderBy: { createdAt: 'desc' } });
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
    return prisma.class.findMany({
      where: gradeId ? { gradeId } : undefined,
      include: { grade: true },
      orderBy: { name: 'asc' },
    });
  });

  // 学科列表
  app.get('/api/subjects', { preHandler: [authMiddleware] }, async () => {
    return prisma.subject.findMany({ orderBy: { order: 'asc' } });
  });
}
