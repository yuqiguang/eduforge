import { EventBus } from '../event-bus/index.js';
import { AIGateway } from '../ai-gateway/index.js';
import { PrismaClient } from '@prisma/client';

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

// 插件上下文 - 插件通过此接口与核心交互
export interface PluginContext {
  registerRoute(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    path: string,
    handler: any,
    options?: any
  ): void;

  events: EventBus;
  ai: AIGateway;
  prisma: PrismaClient;

  logger: {
    info(msg: string, ...args: any[]): void;
    warn(msg: string, ...args: any[]): void;
    error(msg: string, ...args: any[]): void;
  };
}
