import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { EventBus } from '../event-bus/index.js';
import { AIGateway } from '../ai-gateway/index.js';
import { authMiddleware } from '../auth/middleware.js';
import type { PluginContext } from './types.js';

// 创建插件上下文实例
export function createPluginContext(
  pluginName: string,
  app: FastifyInstance,
  prisma: PrismaClient,
  eventBus: EventBus,
  aiGateway: AIGateway,
): PluginContext {
  return {
    registerRoute(method, path, handler, options) {
      const fullPath = `/api/plugins/${pluginName}${path}`;
      app.route({
        method,
        url: fullPath,
        preHandler: [authMiddleware],
        handler,
        ...options,
      });
    },
    events: eventBus,
    ai: aiGateway,
    prisma,
    logger: {
      info: (msg, ...args) => app.log.info({ plugin: pluginName }, msg, ...args),
      warn: (msg, ...args) => app.log.warn({ plugin: pluginName }, msg, ...args),
      error: (msg, ...args) => app.log.error({ plugin: pluginName }, msg, ...args),
    },
  };
}
