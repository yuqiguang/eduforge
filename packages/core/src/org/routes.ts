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
    return classStudents.map(cs => ({
      studentId: cs.studentId,
      ...cs.student.user,
    }));
  });

  // 学科列表
  app.get('/api/subjects', { preHandler: [authMiddleware] }, async () => {
    return prisma.subject.findMany({ orderBy: { order: 'asc' } });
  });
}
