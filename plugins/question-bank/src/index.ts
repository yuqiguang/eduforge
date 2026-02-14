import type { EduPlugin, PluginContext } from '../../packages/core/src/plugin-engine/types.js';

// 题目类型枚举
export type QuestionType = 'SINGLE_CHOICE' | 'MULTI_CHOICE' | 'TRUE_FALSE' | 'FILL_BLANK' | 'SHORT_ANSWER' | 'ESSAY';

// 题库插件 - 管理题目、知识点、教材版本
const questionBankPlugin: EduPlugin = {
  name: 'question-bank',
  version: '0.1.0',
  displayName: '题库管理',
  description: '题目管理、知识点体系、教材版本管理',

  async onInstall(ctx: PluginContext) {
    const exec = (sql: string) => ctx.prisma.$executeRawUnsafe(sql);

    await exec(`CREATE TABLE IF NOT EXISTS plugin_qb_knowledge_points (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      code TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
      parent_id TEXT REFERENCES plugin_qb_knowledge_points(id),
      subject_id TEXT NOT NULL, "order" INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now()
    )`);

    await exec(`CREATE TABLE IF NOT EXISTS plugin_qb_editions (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, publisher TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    )`);

    await exec(`CREATE TABLE IF NOT EXISTS plugin_qb_questions (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      type TEXT NOT NULL DEFAULT 'SINGLE_CHOICE', content TEXT NOT NULL,
      options JSONB, answer TEXT, explanation TEXT, difficulty FLOAT DEFAULT 0.5,
      knowledge_point_id TEXT REFERENCES plugin_qb_knowledge_points(id),
      subject_id TEXT NOT NULL, grade_code TEXT, edition_code TEXT,
      creator_id TEXT NOT NULL, status TEXT DEFAULT 'ACTIVE', tags TEXT[],
      created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
    )`);

    await exec(`CREATE INDEX IF NOT EXISTS idx_qb_questions_subject ON plugin_qb_questions(subject_id)`);
    await exec(`CREATE INDEX IF NOT EXISTS idx_qb_questions_knowledge ON plugin_qb_questions(knowledge_point_id)`);
    await exec(`CREATE INDEX IF NOT EXISTS idx_qb_questions_creator ON plugin_qb_questions(creator_id)`);

    ctx.logger.info('题库插件表创建完成');
  },

  async onInit(ctx: PluginContext) {
    // === 知识点 API ===
    ctx.registerRoute('GET', '/knowledge-points', async (request: any) => {
      const { subjectId, parentId } = request.query as any;
      const where = [];
      const params: any[] = [];

      if (subjectId) {
        params.push(subjectId);
        where.push(`subject_id = $${params.length}`);
      }
      if (parentId) {
        params.push(parentId);
        where.push(`parent_id = $${params.length}`);
      } else if (!parentId && subjectId) {
        where.push('parent_id IS NULL');
      }

      const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const rows = await ctx.prisma.$queryRawUnsafe(
        `SELECT * FROM plugin_qb_knowledge_points ${whereClause} ORDER BY "order" ASC`,
        ...params
      );
      return rows;
    });

    // === 题目 CRUD ===

    // 查询题目列表
    ctx.registerRoute('GET', '/questions', async (request: any) => {
      const { subjectId, knowledgePointId, type, difficulty, page = '1', pageSize = '20' } = request.query as any;
      const where = [];
      const params: any[] = [];

      if (subjectId) { params.push(subjectId); where.push(`subject_id = $${params.length}`); }
      if (knowledgePointId) { params.push(knowledgePointId); where.push(`knowledge_point_id = $${params.length}`); }
      if (type) { params.push(type); where.push(`type = $${params.length}`); }

      const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const offset = (parseInt(page) - 1) * parseInt(pageSize);

      const [rows, countResult] = await Promise.all([
        ctx.prisma.$queryRawUnsafe(
          `SELECT * FROM plugin_qb_questions ${whereClause} ORDER BY created_at DESC LIMIT ${parseInt(pageSize)} OFFSET ${offset}`,
          ...params
        ),
        ctx.prisma.$queryRawUnsafe(
          `SELECT COUNT(*)::int as total FROM plugin_qb_questions ${whereClause}`,
          ...params
        ),
      ]);

      return {
        data: rows,
        total: (countResult as any)[0]?.total || 0,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
      };
    });

    // 创建题目
    ctx.registerRoute('POST', '/questions', async (request: any) => {
      const body = request.body as any;
      const user = (request as any).user;

      const result = await ctx.prisma.$queryRawUnsafe(
        `INSERT INTO plugin_qb_questions (type, content, options, answer, explanation, difficulty, knowledge_point_id, subject_id, grade_code, edition_code, creator_id, tags)
         VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9, $10, $11, $12::text[])
         RETURNING *`,
        body.type || 'SINGLE_CHOICE',
        body.content,
        JSON.stringify(body.options || []),
        body.answer,
        body.explanation,
        body.difficulty || 0.5,
        body.knowledgePointId || null,
        body.subjectId,
        body.gradeCode || null,
        body.editionCode || null,
        user?.userId || 'system',
        body.tags || [],
      );

      ctx.events.emit('question-bank:question_created', (result as any)[0]);
      return (result as any)[0];
    });

    // AI 生成题目
    ctx.registerRoute('POST', '/questions/ai-generate', async (request: any) => {
      const { subjectId, knowledgePoint, type, difficulty, count = 3 } = request.body as any;
      const user = (request as any).user;

      const result = await ctx.ai.complete({
        task: 'question-generation',
        messages: [
          {
            role: 'system',
            content: `你是一个专业的K12教育出题专家。请根据要求生成题目，以JSON数组格式返回。
每道题包含: type(题型), content(题干), options(选项数组，每项有label和content), answer(答案), explanation(解析), difficulty(难度0-1)`,
          },
          {
            role: 'user',
            content: `请生成 ${count} 道题目。
知识点: ${knowledgePoint}
题型: ${type || '选择题'}
难度: ${difficulty || '中等'}`,
          },
        ],
        temperature: 0.8,
        userId: user?.userId,
        plugin: 'question-bank',
      });

      try {
        // 尝试解析 AI 返回的 JSON
        const contentStr = result.content;
        const jsonMatch = contentStr.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const questions = JSON.parse(jsonMatch[0]);
          return { questions, tokens: result.inputTokens + result.outputTokens };
        }
      } catch {
        // 解析失败，返回原始内容
      }

      return { raw: result.content, tokens: result.inputTokens + result.outputTokens };
    });

    // 获取单个题目
    ctx.registerRoute('GET', '/questions/:id', async (request: any) => {
      const { id } = request.params as any;
      const rows = await ctx.prisma.$queryRawUnsafe(
        'SELECT * FROM plugin_qb_questions WHERE id = $1', id
      );
      const row = (rows as any)[0];
      if (!row) return { error: '题目不存在' };
      return row;
    });

    // 删除题目
    ctx.registerRoute('DELETE', '/questions/:id', async (request: any) => {
      const { id } = request.params as any;
      await ctx.prisma.$executeRawUnsafe('DELETE FROM plugin_qb_questions WHERE id = $1', id);
      return { success: true };
    });

    ctx.logger.info('题库插件路由注册完成');
  },
};

export default questionBankPlugin;
