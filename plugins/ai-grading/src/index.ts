import type { EduPlugin, PluginContext } from '@eduforge/sdk';

// AI 批改插件 - 监听作业提交，自动批改
const aiGradingPlugin: EduPlugin = {
  name: 'ai-grading',
  version: '0.1.0',
  displayName: 'AI 批改',
  description: 'AI 自动批改作业，提供评分和解析',
  dependencies: ['homework'],

  async onInstall(ctx: PluginContext) {
    const exec = (sql: string) => ctx.prisma.$executeRawUnsafe(sql);

    await exec(`CREATE TABLE IF NOT EXISTS plugin_ag_results (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      submission_id TEXT NOT NULL, score FLOAT NOT NULL,
      details JSONB NOT NULL, feedback TEXT, model TEXT,
      tokens_used INT DEFAULT 0, created_at TIMESTAMPTZ DEFAULT now()
    )`);

    await exec(`CREATE INDEX IF NOT EXISTS idx_ag_results_submission ON plugin_ag_results(submission_id)`);

    ctx.logger.info('AI 批改插件表创建完成');
  },

  async onInit(ctx: PluginContext) {
    // 监听作业提交事件，自动触发批改
    ctx.events.on('homework:submitted', async (submission: any) => {
      ctx.logger.info(`收到作业提交 ${submission.id}，开始 AI 批改...`);

      try {
        // 获取作业的题目信息
        const assignments = await ctx.prisma.$queryRawUnsafe(
          'SELECT * FROM plugin_hw_assignments WHERE id = $1',
          submission.assignment_id
        ) as any[];

        if (!assignments.length) return;
        const assignment = assignments[0];

        // 获取题目详情
        const questionIds = assignment.question_ids as string[];
        if (!questionIds.length) return;

        const placeholders = questionIds.map((_, i) => `$${i + 1}`).join(',');
        const questions = await ctx.prisma.$queryRawUnsafe(
          `SELECT * FROM plugin_qb_questions WHERE id IN (${placeholders})`,
          ...questionIds
        ) as any[];

        // 构建批改请求
        const answers = typeof submission.answers === 'string'
          ? JSON.parse(submission.answers)
          : submission.answers;

        let result;
        try {
          result = await ctx.ai.complete({
            task: 'grading',
          messages: [
            {
              role: 'system',
              content: `你是一个专业的K12教师，请批改学生的作业。
对每道题判断对错，给出分数和解析。
返回 JSON 格式：
{
  "totalScore": 数字(0-100),
  "details": [
    { "questionId": "题目ID", "correct": true/false, "score": 分数, "comment": "点评" }
  ],
  "feedback": "总体评价和建议"
}`,
            },
            {
              role: 'user',
              content: `题目：${JSON.stringify(questions.map(q => ({
                id: q.id,
                content: q.content,
                options: q.options,
                answer: q.answer,
                type: q.type,
              })))}

学生答案：${JSON.stringify(answers)}`,
            },
          ],
          temperature: 0.3,
          plugin: 'ai-grading',
        });
        } catch (aiErr: any) {
          ctx.logger.error(`AI 服务调用失败: ${aiErr.message}`);
          // 更新状态为批改失败
          await ctx.prisma.$executeRawUnsafe(
            `UPDATE plugin_hw_submissions SET status = 'GRADING_FAILED' WHERE id = $1`,
            submission.id,
          );
          return;
        }

        // 解析 AI 返回结果
        let gradingResult: any = { totalScore: 0, details: [], feedback: '' };
        try {
          const jsonMatch = result.content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            gradingResult = JSON.parse(jsonMatch[0]);
          }
        } catch {
          gradingResult.feedback = result.content;
        }

        // 保存批改结果
        await ctx.prisma.$executeRawUnsafe(
          `INSERT INTO plugin_ag_results (submission_id, score, details, feedback, model, tokens_used)
           VALUES ($1, $2, $3::jsonb, $4, $5, $6)`,
          submission.id,
          gradingResult.totalScore || 0,
          JSON.stringify(gradingResult.details || []),
          gradingResult.feedback || '',
          result.model,
          result.inputTokens + result.outputTokens,
        );

        // 更新提交记录的分数
        await ctx.prisma.$executeRawUnsafe(
          `UPDATE plugin_hw_submissions SET score = $1, grading_result = $2::jsonb, status = 'GRADED', graded_at = now() WHERE id = $3`,
          gradingResult.totalScore || 0,
          JSON.stringify(gradingResult),
          submission.id,
        );

        // 发出批改完成事件
        ctx.events.emit('grading:completed', {
          submissionId: submission.id,
          score: gradingResult.totalScore,
          details: gradingResult.details,
        });

        ctx.logger.info(`作业 ${submission.id} 批改完成，得分: ${gradingResult.totalScore}`);
      } catch (err: any) {
        ctx.logger.error(`批改失败: ${err.message}`);
      }
    });

    // 手动触发批改（仅教师/管理员）
    ctx.registerRoute('POST', '/grade/:submissionId', async (request: any) => {
      const { submissionId } = request.params as any;
      const submissions = await ctx.prisma.$queryRawUnsafe(
        'SELECT * FROM plugin_hw_submissions WHERE id = $1', submissionId
      ) as any[];

      if (!submissions.length) return { error: '提交不存在' };

      ctx.events.emit('homework:submitted', submissions[0]);
      return { message: '批改任务已提交' };
    }, { roles: ['TEACHER', 'ADMIN', 'SUPER_ADMIN'] });

    // 获取批改结果
    ctx.registerRoute('GET', '/results/:submissionId', async (request: any) => {
      const { submissionId } = request.params as any;
      const results = await ctx.prisma.$queryRawUnsafe(
        'SELECT * FROM plugin_ag_results WHERE submission_id = $1 ORDER BY created_at DESC LIMIT 1',
        submissionId
      ) as any[];

      return results[0] || { error: '暂无批改结果' };
    });

    // 获取错题列表
    ctx.registerRoute('GET', '/mistakes', async (request: any) => {
      const user = (request as any).user;
      if (!user?.userId) {
        throw { statusCode: 401, message: '未登录' };
      }
      const { subjectId } = request.query as any;

      // 1. 获取该学生的所有批改结果
      let query = `
        SELECT r.details, r.feedback, r.created_at as graded_at,
               s.answers, a.question_ids
        FROM plugin_ag_results r
        JOIN plugin_hw_submissions s ON s.id = r.submission_id
        JOIN plugin_hw_assignments a ON a.id = s.assignment_id
        WHERE s.student_id = $1
      `;
      const params: any[] = [user.userId];
      if (subjectId) {
        params.push(subjectId);
        query += ` AND a.subject_id = $${params.length}`;
      }
      query += ` ORDER BY r.created_at DESC`;

      const rows = await ctx.prisma.$queryRawUnsafe(query, ...params) as any[];

      // 2. 提取所有错题的 questionId
      const mistakeItems: { questionId: string; studentAnswer: string; comment: string; feedback: string; gradedAt: string }[] = [];
      for (const row of rows) {
        const details = typeof row.details === 'string' ? JSON.parse(row.details) : (row.details || []);
        const answers = typeof row.answers === 'string' ? JSON.parse(row.answers) : (row.answers || {});
        for (const d of details) {
          if (!d.correct) {
            mistakeItems.push({
              questionId: d.questionId,
              studentAnswer: answers[d.questionId] ?? '',
              comment: d.comment || '',
              feedback: row.feedback || '',
              gradedAt: row.graded_at,
            });
          }
        }
      }

      if (!mistakeItems.length) return [];

      // 3. 批量获取题目详情
      const qIds = [...new Set(mistakeItems.map(m => m.questionId))];
      const ph = qIds.map((_, i) => `$${i + 1}`).join(',');
      const questions = await ctx.prisma.$queryRawUnsafe(
        `SELECT id, content, options, answer, type FROM plugin_qb_questions WHERE id IN (${ph})`,
        ...qIds
      ) as any[];
      const qMap = Object.fromEntries(questions.map(q => [q.id, q]));

      // 4. 组装返回
      return mistakeItems.map(m => {
        const q = qMap[m.questionId];
        return {
          questionId: m.questionId,
          content: q?.content || '',
          type: q?.type || '',
          options: q?.options || null,
          correctAnswer: q?.answer || '',
          studentAnswer: m.studentAnswer,
          aiComment: m.comment,
          feedback: m.feedback,
          gradedAt: m.gradedAt,
        };
      });
    });

    ctx.logger.info('AI 批改插件已就绪，正在监听作业提交事件');
  },
};

export default aiGradingPlugin;
