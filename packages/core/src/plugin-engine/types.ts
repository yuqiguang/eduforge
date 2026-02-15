import { EventBus } from '../event-bus/index.js';
import { AIGateway } from '../ai-gateway/index.js';

// Scoped database interface for plugins — restricts access to plugin-prefixed tables only
export interface PluginDB {
  /** Execute a raw read query (must target plugin_* tables) */
  query(sql: string, ...params: any[]): Promise<any[]>;
  /** Execute a raw write query (must target plugin_* tables) */
  execute(sql: string, ...params: any[]): Promise<void>;
}

// 插件接口定义
export interface EduPlugin {
  name: string;
  version: string;
  displayName?: string;
  description?: string;
  dependencies?: string[];

  onInstall?(ctx: PluginContext): Promise<void>;
  onInit?(ctx: PluginContext): Promise<void>;
  onDestroy?(ctx: PluginContext): Promise<void>;
}

export interface RouteOptions {
  roles?: string[];  // Required roles, e.g. ['TEACHER', 'ADMIN']
  [key: string]: any;
}

// 插件上下文 - 插件通过此接口与核心交互
export interface PluginContext {
  registerRoute(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    path: string,
    handler: any,
    options?: RouteOptions
  ): void;

  events: EventBus;
  ai: AIGateway;
  /** @deprecated Use db instead for scoped access. prisma is kept for backward compatibility during migration. */
  prisma: any;
  /** Scoped database access - only allows queries on plugin_* tables */
  db: PluginDB;

  logger: {
    info(msg: string, ...args: any[]): void;
    warn(msg: string, ...args: any[]): void;
    error(msg: string, ...args: any[]): void;
  };
}
