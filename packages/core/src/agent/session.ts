import { PrismaClient, Prisma } from '@prisma/client';

export async function createSession(prisma: PrismaClient, userId: string, title?: string) {
  const rows: any[] = await prisma.$queryRaw(
    Prisma.sql`INSERT INTO ai_chat_sessions (user_id, title) VALUES (${userId}, ${title || null}) RETURNING *`
  );
  return rows[0];
}

export async function getSession(prisma: PrismaClient, sessionId: string, userId: string) {
  const rows: any[] = await prisma.$queryRaw(
    Prisma.sql`SELECT * FROM ai_chat_sessions WHERE id = ${sessionId} AND user_id = ${userId}`
  );
  return rows[0] || null;
}

export async function listSessions(prisma: PrismaClient, userId: string) {
  return prisma.$queryRaw(
    Prisma.sql`SELECT id, title, created_at, updated_at FROM ai_chat_sessions WHERE user_id = ${userId} ORDER BY updated_at DESC LIMIT 50`
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
  const toolCallsJson = data.toolCalls ? JSON.stringify(data.toolCalls) : null;
  const toolResultJson = data.toolResult ? JSON.stringify(data.toolResult) : null;
  const metadataJson = data.metadata ? JSON.stringify(data.metadata) : null;

  const rows: any[] = await prisma.$queryRaw(
    Prisma.sql`INSERT INTO ai_chat_messages (session_id, role, content, tool_calls, tool_result, metadata)
     VALUES (${data.sessionId}, ${data.role}, ${data.content || null}, ${toolCallsJson}::jsonb, ${toolResultJson}::jsonb, ${metadataJson}::jsonb)
     RETURNING *`
  );
  // Update session timestamp
  await prisma.$executeRaw(
    Prisma.sql`UPDATE ai_chat_sessions SET updated_at = now() WHERE id = ${data.sessionId}`
  );
  return rows[0];
}

export async function loadMessages(prisma: PrismaClient, sessionId: string, limit = 20) {
  return prisma.$queryRaw(
    Prisma.sql`SELECT * FROM ai_chat_messages WHERE session_id = ${sessionId} ORDER BY created_at DESC LIMIT ${limit}`
  );
}

export async function getSessionMessages(prisma: PrismaClient, sessionId: string, userId: string) {
  // Verify session ownership before returning messages
  const session = await getSession(prisma, sessionId, userId);
  if (!session) return [];
  return prisma.$queryRaw(
    Prisma.sql`SELECT * FROM ai_chat_messages WHERE session_id = ${sessionId} ORDER BY created_at ASC`
  );
}
