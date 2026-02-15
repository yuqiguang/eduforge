import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../auth/middleware.js';
import { chat, chatStream } from './engine.js';
import { listSessions, getSessionMessages } from './session.js';
import { executeTool, getTool, type ToolContext } from './tool-registry.js';
import { registerBuiltinTools } from './builtin-tools.js';

export function registerAgentRoutes(app: FastifyInstance, prisma: PrismaClient) {
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

  // GET /api/chat/sessions/:id
  app.get('/api/chat/sessions/:id', { preHandler: [authMiddleware] }, async (request) => {
    const user = (request as any).user;
    const { id } = request.params as any;
    return getSessionMessages(prisma, id);
  });

  // POST /api/chat/confirm/:actionId
  app.post('/api/chat/confirm/:actionId', { preHandler: [authMiddleware] }, async (request, reply) => {
    const user = (request as any).user;
    const { actionId } = request.params as any;

    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT * FROM ai_pending_actions WHERE id = $1 AND user_id = $2 AND status = 'PENDING'`,
      actionId, user.userId
    );
    const action = rows[0];
    if (!action) return reply.code(404).send({ error: '操作不存在或已过期' });

    // Check expiry
    if (new Date(action.expires_at) < new Date()) {
      await prisma.$executeRawUnsafe(
        `UPDATE ai_pending_actions SET status = 'EXPIRED', resolved_at = now() WHERE id = $1`, actionId
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
      await prisma.$executeRawUnsafe(
        `UPDATE ai_pending_actions SET status = 'CONFIRMED', resolved_at = now() WHERE id = $1`, actionId
      );
      return { success: true, result };
    } catch (err: any) {
      await prisma.$executeRawUnsafe(
        `UPDATE ai_pending_actions SET status = 'FAILED', resolved_at = now() WHERE id = $1`, actionId
      );
      return reply.code(500).send({ error: err.message });
    }
  });

  // POST /api/chat/cancel/:actionId
  app.post('/api/chat/cancel/:actionId', { preHandler: [authMiddleware] }, async (request, reply) => {
    const user = (request as any).user;
    const { actionId } = request.params as any;

    const result = await prisma.$executeRawUnsafe(
      `UPDATE ai_pending_actions SET status = 'CANCELLED', resolved_at = now() WHERE id = $1 AND user_id = $2 AND status = 'PENDING'`,
      actionId, user.userId
    );
    return { success: true };
  });
}
