import { PrismaClient } from '@prisma/client';

export async function createSession(prisma: PrismaClient, userId: string, title?: string) {
  const rows: any[] = await prisma.$queryRawUnsafe(
    `INSERT INTO ai_chat_sessions (user_id, title) VALUES ($1, $2) RETURNING *`,
    userId, title || null
  );
  return rows[0];
}

export async function getSession(prisma: PrismaClient, sessionId: string, userId: string) {
  const rows: any[] = await prisma.$queryRawUnsafe(
    `SELECT * FROM ai_chat_sessions WHERE id = $1 AND user_id = $2`,
    sessionId, userId
  );
  return rows[0] || null;
}

export async function listSessions(prisma: PrismaClient, userId: string) {
  return prisma.$queryRawUnsafe(
    `SELECT id, title, created_at, updated_at FROM ai_chat_sessions WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 50`,
    userId
  );
}

export async function saveMessage(prisma: PrismaClient, data: {
  sessionId: string;
  role: string;
  content?: string;
  toolCalls?: any;
  toolResult?: any;
  metadata?: any;
}) {
  const rows: any[] = await prisma.$queryRawUnsafe(
    `INSERT INTO ai_chat_messages (session_id, role, content, tool_calls, tool_result, metadata) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    data.sessionId, data.role, data.content || null,
    data.toolCalls ? JSON.stringify(data.toolCalls) : null,
    data.toolResult ? JSON.stringify(data.toolResult) : null,
    data.metadata ? JSON.stringify(data.metadata) : null
  );
  // Update session timestamp
  await prisma.$executeRawUnsafe(
    `UPDATE ai_chat_sessions SET updated_at = now() WHERE id = $1`, data.sessionId
  );
  return rows[0];
}

export async function loadMessages(prisma: PrismaClient, sessionId: string, limit = 20) {
  return prisma.$queryRawUnsafe(
    `SELECT * FROM ai_chat_messages WHERE session_id = $1 ORDER BY created_at DESC LIMIT $2`,
    sessionId, limit
  );
}

export async function getSessionMessages(prisma: PrismaClient, sessionId: string) {
  return prisma.$queryRawUnsafe(
    `SELECT * FROM ai_chat_messages WHERE session_id = $1 ORDER BY created_at ASC`,
    sessionId
  );
}
