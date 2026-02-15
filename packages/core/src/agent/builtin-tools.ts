import { registerTool, type ToolDefinition } from './tool-registry.js';
import { openaiChatWithTools } from '../ai-gateway/providers/openai.js';
import { decrypt } from '../crypto.js';

const queryQuestions: ToolDefinition = {
  name: 'query_questions',
  description: '查询题库中的题目，支持按科目、难度、类型、关键词筛选',
  parameters: {
    type: 'object',
    properties: {
      subject: { type: 'string', description: '科目ID: math/chinese/english' },
      difficulty: { type: 'string', description: '难度: EASY/MEDIUM/HARD' },
      type: { type: 'string', description: '题型: SINGLE_CHOICE/FILL_BLANK/CALCULATION/SHORT_ANSWER' },
      keyword: { type: 'string', description: '关键词搜索' },
      limit: { type: 'number', description: '返回数量，默认10' },
    },
  },
  roles: ['TEACHER', 'STUDENT'],
  async execute(params, ctx) {
    let sql = `SELECT id, subject_id, type, difficulty, content, options, answer FROM plugin_qb_questions WHERE status = 'ACTIVE'`;
    const args: any[] = [];
    let n = 0;
    if (params.subject) { args.push(params.subject); sql += ` AND subject_id = $${++n}`; }
    if (params.difficulty) {
      const diffMap: Record<string, number> = { EASY: 0.3, MEDIUM: 0.5, HARD: 0.8 };
      args.push(diffMap[params.difficulty] || 0.5); sql += ` AND difficulty = $${++n}`;
    }
    if (params.type) { args.push(params.type); sql += ` AND type = $${++n}`; }
    if (params.keyword) { args.push(`%${params.keyword}%`); sql += ` AND content ILIKE $${++n}`; }
    const limit = params.limit || 10;
    args.push(limit);
    sql += ` ORDER BY created_at DESC LIMIT $${++n}`;
    return ctx.prisma.$queryRawUnsafe(sql, ...args);
  },
};

const queryAssignments: ToolDefinition = {
  name: 'query_assignments',
  description: '查看作业列表，教师可看所有，学生看自己班级的',
  parameters: {
    type: 'object',
    properties: {
      classId: { type: 'string', description: '班级ID' },
      status: { type: 'string', description: '状态: DRAFT/PUBLISHED/CLOSED' },
    },
  },
  roles: ['TEACHER', 'STUDENT'],
  async execute(params, ctx) {
    let sql = `SELECT id, title, class_id, status, deadline, created_at FROM plugin_hw_assignments WHERE 1=1`;
    const args: any[] = [];
    let n = 0;
    if (params.classId) { args.push(params.classId); sql += ` AND class_id = $${++n}`; }
    if (params.status) { args.push(params.status); sql += ` AND status = $${++n}`; }
    sql += ` ORDER BY created_at DESC LIMIT 20`;
    return ctx.prisma.$queryRawUnsafe(sql, ...args);
  },
};

const querySubmissions: ToolDefinition = {
  name: 'query_submissions',
  description: '查看作业提交和批改结果',
  parameters: {
    type: 'object',
    properties: {
      assignmentId: { type: 'string', description: '作业ID' },
      studentId: { type: 'string', description: '学生ID' },
    },
  },
  roles: ['TEACHER', 'STUDENT'],
  async execute(params, ctx) {
    let sql = `SELECT id, assignment_id, student_id, status, score, grading_result, submitted_at FROM plugin_hw_submissions WHERE 1=1`;
    const args: any[] = [];
    let n = 0;
    if (params.assignmentId) { args.push(params.assignmentId); sql += ` AND assignment_id = $${++n}`; }
    // Students can only see their own
    if (ctx.role === 'STUDENT') {
      args.push(ctx.userId); sql += ` AND student_id = $${++n}`;
    } else if (params.studentId) {
      args.push(params.studentId); sql += ` AND student_id = $${++n}`;
    }
    sql += ` ORDER BY submitted_at DESC LIMIT 20`;
    return ctx.prisma.$queryRawUnsafe(sql, ...args);
  },
};

const queryAnalytics: ToolDefinition = {
  name: 'query_analytics',
  description: '查询班级学情数据，包括平均分、提交率等',
  parameters: {
    type: 'object',
    properties: {
      classId: { type: 'string', description: '班级ID' },
      metric: { type: 'string', description: '指标: avg_score/submission_rate/all' },
    },
    required: ['classId'],
  },
  roles: ['TEACHER'],
  async execute(params, ctx) {
    const classId = params.classId;
    const avgScore: any[] = await ctx.prisma.$queryRawUnsafe(
      `SELECT AVG(score)::numeric(5,2) as avg_score, COUNT(*) as total_submissions
       FROM plugin_hw_submissions s
       JOIN plugin_hw_assignments a ON s.assignment_id = a.id
       WHERE a.class_id = $1 AND s.score IS NOT NULL`, classId
    );
    const submissionRate: any[] = await ctx.prisma.$queryRawUnsafe(
      `SELECT 
        COUNT(DISTINCT s.student_id) as submitted_students,
        a.title as assignment_title
       FROM plugin_hw_assignments a
       LEFT JOIN plugin_hw_submissions s ON s.assignment_id = a.id
       WHERE a.class_id = $1
       GROUP BY a.id, a.title
       ORDER BY a.created_at DESC LIMIT 5`, classId
    );
    return { avgScore: avgScore[0], recentAssignments: submissionRate };
  },
};

const generateQuestions: ToolDefinition = {
  name: 'generate_questions',
  description: 'AI 自动出题并入库，需要用户确认后执行',
  parameters: {
    type: 'object',
    properties: {
      subject: { type: 'string', description: '科目ID: math/chinese/english' },
      topic: { type: 'string', description: '知识点/主题' },
      count: { type: 'number', description: '题目数量' },
      difficulty: { type: 'string', description: '难度: EASY/MEDIUM/HARD' },
    },
    required: ['subject', 'topic', 'count', 'difficulty'],
  },
  confirmRequired: true,
  roles: ['TEACHER'],
  async execute(params, ctx) {
    // Get AI config
    const configs: any[] = await ctx.prisma.$queryRawUnsafe(
      `SELECT * FROM "AIConfig" WHERE "isDefault" = true LIMIT 1`
    );
    const config = configs[0];
    if (!config) throw new Error('未配置 AI 服务');

    const prompt = `请生成 ${params.count} 道关于"${params.topic}"的${params.subject}题目，难度为${params.difficulty}。
返回 JSON 数组，每个元素包含: type(CHOICE/FILL/SHORT_ANSWER), content(题目内容), options(选项数组，选择题必填), answer(答案), explanation(解析)。
只返回 JSON，不要其他内容。`;

    const resp = await openaiChatWithTools({
      provider: config.provider,
      model: config.model,
      apiKey: decrypt(config.apiKey),
      baseUrl: config.baseUrl ?? undefined,
      messages: [
        { role: 'system', content: '你是出题专家，根据要求生成高质量题目。只返回JSON。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
    });
    const data = await resp.json() as any;
    const content = data.choices?.[0]?.message?.content || '[]';
    
    // Parse and insert
    let questions: any[];
    try {
      const match = content.match(/\[[\s\S]*\]/);
      questions = JSON.parse(match ? match[0] : content);
    } catch {
      return { error: '生成的题目格式有误，请重试', raw: content };
    }

    let inserted = 0;
    for (const q of questions) {
      await ctx.prisma.$executeRawUnsafe(
        `INSERT INTO plugin_qb_questions (subject_id, type, difficulty, content, options, answer, explanation, creator_id)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)`,
        params.subject, q.type || 'SINGLE_CHOICE',
        params.difficulty === 'EASY' ? 0.3 : params.difficulty === 'HARD' ? 0.8 : 0.5,
        q.content,
        q.options ? JSON.stringify(q.options) : null, q.answer || '', q.explanation || '',
        ctx.userId
      );
      inserted++;
    }
    return { success: true, inserted, total: questions.length };
  },
};

const createAssignment: ToolDefinition = {
  name: 'create_assignment',
  description: '布置作业，将题目分配给指定班级，设置截止时间',
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: '作业标题' },
      classId: { type: 'string', description: '班级ID' },
      subjectId: { type: 'string', description: '科目ID: math/chinese/english' },
      questionIds: { type: 'array', items: { type: 'string' }, description: '题目ID列表' },
      deadline: { type: 'string', description: '截止时间，ISO 8601 格式' },
    },
    required: ['title', 'classId', 'subjectId', 'questionIds', 'deadline'],
  },
  confirmRequired: true,
  roles: ['TEACHER'],
  async execute(params, ctx) {
    const rows: any[] = await ctx.prisma.$queryRawUnsafe(
      `INSERT INTO plugin_hw_assignments (title, class_id, subject_id, question_ids, deadline, status, creator_id)
       VALUES ($1, $2, $3, $4::jsonb, $5, 'PUBLISHED', $6) RETURNING id, title`,
      params.title, params.classId, params.subjectId,
      JSON.stringify(params.questionIds), params.deadline, ctx.userId
    );
    const assignment = rows[0];
    // Emit event for notification system
    await ctx.prisma.$executeRawUnsafe(
      `INSERT INTO domain_events (aggregate_type, aggregate_id, event_type, payload)
       VALUES ('assignment', $1, 'homework:assigned', $2)`,
      assignment.id,
      JSON.stringify({ assignmentId: assignment.id, title: params.title, classId: params.classId, deadline: params.deadline })
    );
    return { success: true, assignmentId: assignment.id, title: params.title };
  },
};

export function registerBuiltinTools() {
  registerTool(queryQuestions);
  registerTool(queryAssignments);
  registerTool(querySubmissions);
  registerTool(queryAnalytics);
  registerTool(generateQuestions);
  registerTool(createAssignment);
}
