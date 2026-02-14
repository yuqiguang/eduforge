import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken } from './jwt.js';

// 认证中间件
export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return reply.code(401).send({ error: '未登录' });
  }

  try {
    const payload = verifyToken(token);
    (request as any).user = payload;
  } catch {
    return reply.code(401).send({ error: 'Token 无效或已过期' });
  }
}

// 角色检查中间件
export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    if (!user || !roles.includes(user.role)) {
      return reply.code(403).send({ error: '权限不足' });
    }
  };
}
