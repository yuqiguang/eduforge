import { FastifyInstance } from 'fastify';
import { PrismaClient, Prisma } from '@prisma/client';
import { authMiddleware } from '../auth/middleware.js';
import { chat, chatStream } from './engine.js';
import { listSessions, getSessionMessages } from './session.js';
import { executeTool, getTool, type ToolContext } from './tool-registry.js';
import { registerBuiltinTools } from './builtin-tools.js';

export function registerAgentRoutes(app: FastifyInstance, prisma: PrismaClient) {
  // Initialize agent tables
  prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS ai_chat_sessions (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id TEXT NOT NULL,
      title TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `).catch(() => {});
  prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS ai_chat_messages (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      session_id TEXT NOT NULL REFERENCES ai_chat_sessions(id),
      role TEXT NOT NULL,
      content TEXT,
      tool_calls JSONB,
      tool_result JSONB,
      metadata JSONB,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `).catch(() => {});
  prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS ai_pending_actions (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      session_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      tool_name TEXT NOT NULL,
      parameters JSONB NOT NULL,
      preview TEXT,
      status TEXT DEFAULT 'PENDING',
      resolved_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `).catch(() => {});
  // Add expires_at column if missing (for existing deployments)
  prisma.$executeRawUnsafe(`ALTER TABLE ai_pending_actions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ`).catch(() => {});

  // Initialize builtin tools
  registerBuiltinTools();

  // POST /api/chat — non-streaming
  app.post('/api/chat', { preHandler: [authMiddleware] }, async (request, reply) => {
    const user = (request as any).user;
    const body = request.body as any;
    if (!body?.message) return reply.code(400).send({ error: '缺少 message' });

    const result = await chat(prisma, user, {
      message: body.message,
      sessionId: body.sessionId,
    });
    return result;
  });

  // GET /api/chat/stream — SSE streaming
  app.get('/api/chat/stream', { preHandler: [authMiddleware] }, async (request, reply) => {
    const user = (request as any).user;
    const query = request.query as any;
    if (!query?.message) return reply.code(400).send({ error: '缺少 message' });

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const send = (event: string, data: any) => {
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    const close = () => {
      reply.raw.end();
    };

    await chatStream(prisma, user, {
      message: query.message,
      sessionId: query.sessionId,
    }, send, close);
  });

  // GET /api/chat/sessions
  app.get('/api/chat/sessions', { preHandler: [authMiddleware] }, async (request) => {
    const user = (request as any).user;
    return listSessions(prisma, user.userId);
  });

  // POST /api/chat/sessions — create a new session
  app.post('/api/chat/sessions', { preHandler: [authMiddleware] }, async (request) => {
    const user = (request as any).user;
    const body = request.body as any;
    const { createSession } = await import('./session.js');
    const session = await createSession(prisma, user.userId, body?.title || '新对话');
    return session;
  });

  // GET /api/chat/sessions/:id — get session messages
  app.get('/api/chat/sessions/:id', { preHandler: [authMiddleware] }, async (request) => {
    const user = (request as any).user;
    const { id } = request.params as any;
    return getSessionMessages(prisma, id, user.userId);
  });

  // GET /api/chat/sessions/:id/messages — alias for compatibility
  app.get('/api/chat/sessions/:id/messages', { preHandler: [authMiddleware] }, async (request) => {
    const user = (request as any).user;
    const { id } = request.params as any;
    return getSessionMessages(prisma, id, user.userId);
  });

  // POST /api/chat/confirm/:actionId
  app.post('/api/chat/confirm/:actionId', { preHandler: [authMiddleware] }, async (request, reply) => {
    const user = (request as any).user;
    const { actionId } = request.params as any;

    const rows: any[] = await prisma.$queryRaw(
      Prisma.sql`SELECT * FROM ai_pending_actions WHERE id = ${actionId} AND user_id = ${user.userId} AND status = 'PENDING'`
    );
    const action = rows[0];
    if (!action) return reply.code(404).send({ error: '操作不存在或已过期' });

    // Check expiry
    if (action.expires_at && new Date(action.expires_at) < new Date()) {
      await prisma.$executeRaw(
        Prisma.sql`UPDATE ai_pending_actions SET status = 'EXPIRED', resolved_at = now() WHERE id = ${actionId}`
      );
      return reply.code(410).send({ error: '操作已过期' });
    }

    const toolDef = getTool(action.tool_name);
    if (!toolDef) return reply.code(400).send({ error: '工具不存在' });

    const params = typeof action.parameters === 'string' ? JSON.parse(action.parameters) : action.parameters;
    const ctx: ToolContext = {
      userId: user.userId,
      role: user.role,
      schoolId: user.schoolId,
      sessionId: action.session_id,
      prisma,
    };

    try {
      const result = await toolDef.execute(params, ctx);
      await prisma.$executeRaw(
        Prisma.sql`UPDATE ai_pending_actions SET status = 'CONFIRMED', resolved_at = now() WHERE id = ${actionId}`
      );
      return { success: true, result };
    } catch (err: any) {
      await prisma.$executeRaw(
        Prisma.sql`UPDATE ai_pending_actions SET status = 'FAILED', resolved_at = now() WHERE id = ${actionId}`
      );
      return reply.code(500).send({ error: err.message });
    }
  });

  // POST /api/chat/cancel/:actionId
  app.post('/api/chat/cancel/:actionId', { preHandler: [authMiddleware] }, async (request, reply) => {
    const user = (request as any).user;
    const { actionId } = request.params as any;

    const result = await prisma.$executeRaw(
      Prisma.sql`UPDATE ai_pending_actions SET status = 'CANCELLED', resolved_at = now() WHERE id = ${actionId} AND user_id = ${user.userId} AND status = 'PENDING'`
    );
    return { success: true };
  });
}
