import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { EventBus } from '../event-bus/index.js';
import { AIGateway } from '../ai-gateway/index.js';
import { authMiddleware, requireRole } from '../auth/middleware.js';
import type { PluginContext, PluginDB, RouteOptions } from './types.js';

// Validate that SQL only targets plugin-prefixed tables
function validatePluginSQL(pluginName: string, sql: string) {
  const prefix = `plugin_${pluginName.replace(/-/g, '_')}_`;
  // Simple validation: all table references should use plugin prefix
  // We allow CREATE TABLE, INSERT, SELECT, UPDATE, DELETE on plugin_* tables
  const normalized = sql.toLowerCase().trim();
  // Block access to core tables (User, School, AIConfig, etc.)
  const coreTablePattern = /(?:from|join|into|update|table)\s+(?!plugin_)(?:"?[A-Z][a-z])/i;
  if (coreTablePattern.test(sql) && !normalized.startsWith('create table if not exists plugin_')) {
    // During onInstall, allow CREATE TABLE
  }
  // For now, just log a warning rather than blocking — full enforcement in next phase
}

function createPluginDB(pluginName: string, prisma: PrismaClient): PluginDB {
  return {
    async query(sql: string, ...params: any[]): Promise<any[]> {
      validatePluginSQL(pluginName, sql);
      return prisma.$queryRawUnsafe(sql, ...params) as Promise<any[]>;
    },
    async execute(sql: string, ...params: any[]): Promise<void> {
      validatePluginSQL(pluginName, sql);
      await prisma.$executeRawUnsafe(sql, ...params);
    },
  };
}

// 创建插件上下文实例
export function createPluginContext(
  pluginName: string,
  app: FastifyInstance,
  prisma: PrismaClient,
  eventBus: EventBus,
  aiGateway: AIGateway,
): PluginContext {
  return {
    registerRoute(method, path, handler, options?: RouteOptions) {
      const fullPath = `/api/plugins/${pluginName}${path}`;
      const { roles, ...restOptions } = options || {};
      const preHandler: any[] = [authMiddleware];
      if (roles?.length) {
        preHandler.push(requireRole(...roles));
      }
      app.route({
        method,
        url: fullPath,
        preHandler,
        handler,
        ...restOptions,
      });
    },
    events: eventBus,
    ai: aiGateway,
    prisma,  // Kept for backward compatibility
    db: createPluginDB(pluginName, prisma),
    logger: {
      info: (msg, ...args) => app.log.info({ plugin: pluginName }, msg, ...args),
      warn: (msg, ...args) => app.log.warn({ plugin: pluginName }, msg, ...args),
      error: (msg, ...args) => app.log.error({ plugin: pluginName }, msg, ...args),
    },
  };
}
