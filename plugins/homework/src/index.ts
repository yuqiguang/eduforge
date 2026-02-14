import type { EduPlugin, PluginContext } from '../../packages/core/src/plugin-engine/types.js';

// 作业插件 - 作业布置、提交、管理
const homeworkPlugin: EduPlugin = {
  name: 'homework',
  version: '0.1.0',
  displayName: '作业管理',
  description: '作业布置、提交、截止时间管理',
  dependencies: ['question-bank'],

  async onInstall(ctx: PluginContext) {
    const exec = (sql: string) => ctx.prisma.$executeRawUnsafe(sql);

    await exec(`CREATE TABLE IF NOT EXISTS plugin_hw_assignments (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      title TEXT NOT NULL, description TEXT, class_id TEXT NOT NULL,
      teacher_id TEXT NOT NULL, subject_id TEXT NOT NULL,
      question_ids TEXT[] NOT NULL, deadline TIMESTAMPTZ,
      status TEXT DEFAULT 'ACTIVE',
      created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
    )`);

    await exec(`CREATE TABLE IF NOT EXISTS plugin_hw_submissions (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      assignment_id TEXT NOT NULL REFERENCES plugin_hw_assignments(id),
      student_id TEXT NOT NULL, answers JSONB NOT NULL,
      score FLOAT, grading_result JSONB, status TEXT DEFAULT 'SUBMITTED',
      submitted_at TIMESTAMPTZ DEFAULT now(), graded_at TIMESTAMPTZ
    )`);

    await exec(`CREATE INDEX IF NOT EXISTS idx_hw_assignments_class ON plugin_hw_assignments(class_id)`);
    await exec(`CREATE INDEX IF NOT EXISTS idx_hw_assignments_teacher ON plugin_hw_assignments(teacher_id)`);
    await exec(`CREATE INDEX IF NOT EXISTS idx_hw_submissions_assignment ON plugin_hw_submissions(assignment_id)`);
    await exec(`CREATE INDEX IF NOT EXISTS idx_hw_submissions_student ON plugin_hw_submissions(student_id)`);

    ctx.logger.info('作业插件表创建完成');
  },

  async onInit(ctx: PluginContext) {
    // 获取当前学生的提交记录
    ctx.registerRoute('GET', '/my-submissions', async (request: any) => {
      const user = (request as any).user;
      if (!user?.userId) {
        throw { statusCode: 401, message: '未登录' };
      }
      return ctx.prisma.$queryRawUnsafe(
        `SELECT s.*, a.title as assignment_title, a.subject_id, a.deadline, a.question_ids
         FROM plugin_hw_submissions s
         JOIN plugin_hw_assignments a ON a.id = s.assignment_id
         WHERE s.student_id = $1
         ORDER BY s.submitted_at DESC`,
        user.userId
      );
    });

    // 布置作业
    ctx.registerRoute('POST', '/assignments', async (request: any) => {
      const body = request.body as any;
      const user = (request as any).user;
      if (!user?.userId) {
        throw { statusCode: 401, message: '未登录' };
      }

      const result = await ctx.prisma.$queryRawUnsafe(
        `INSERT INTO plugin_hw_assignments (title, description, class_id, teacher_id, subject_id, question_ids, deadline)
         VALUES ($1, $2, $3, $4, $5, $6::text[], $7)
         RETURNING *`,
        body.title,
        body.description || null,
        body.classId,
        user?.userId,
        body.subjectId,
        body.questionIds,
        body.deadline ? new Date(body.deadline) : null,
      );

      const assignment = (result as any)[0];
      ctx.events.emit('homework:assigned', assignment);
      return assignment;
    });

    // 获取作业列表
    ctx.registerRoute('GET', '/assignments', async (request: any) => {
      const { classId, teacherId, status } = request.query as any;
      const where = [];
      const params: any[] = [];

      if (classId) { params.push(classId); where.push(`class_id = $${params.length}`); }
      if (teacherId) { params.push(teacherId); where.push(`teacher_id = $${params.length}`); }
      if (status) { params.push(status); where.push(`status = $${params.length}`); }

      const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
      return ctx.prisma.$queryRawUnsafe(
        `SELECT * FROM plugin_hw_assignments ${whereClause} ORDER BY created_at DESC`,
        ...params
      );
    });

    // 提交作业
    ctx.registerRoute('POST', '/submissions', async (request: any) => {
      const body = request.body as any;
      const user = (request as any).user;
      if (!user?.userId) {
        throw { statusCode: 401, message: '未登录' };
      }

      const result = await ctx.prisma.$queryRawUnsafe(
        `INSERT INTO plugin_hw_submissions (assignment_id, student_id, answers)
         VALUES ($1, $2, $3::jsonb)
         RETURNING *`,
        body.assignmentId,
        user?.userId,
        JSON.stringify(body.answers),
      );

      const submission = (result as any)[0];
      ctx.events.emit('homework:submitted', submission);
      return submission;
    });

    // 获取提交列表
    ctx.registerRoute('GET', '/submissions', async (request: any) => {
      const { assignmentId, studentId } = request.query as any;
      const where = [];
      const params: any[] = [];

      if (assignmentId) { params.push(assignmentId); where.push(`assignment_id = $${params.length}`); }
      if (studentId) { params.push(studentId); where.push(`student_id = $${params.length}`); }

      const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
      return ctx.prisma.$queryRawUnsafe(
        `SELECT * FROM plugin_hw_submissions ${whereClause} ORDER BY submitted_at DESC`,
        ...params
      );
    });

    ctx.logger.info('作业插件路由注册完成');
  },
};

export default homeworkPlugin;
