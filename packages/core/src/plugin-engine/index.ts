import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { EventBus } from '../event-bus/index.js';
import { AIGateway } from '../ai-gateway/index.js';
import { PluginRegistry } from './registry.js';
import { createPluginContext } from './context.js';
import type { EduPlugin, PluginContext } from './types.js';

// 插件加载器 - 负责插件的生命周期管理
export class PluginLoader {
  private registry = new PluginRegistry();
  private contexts = new Map<string, PluginContext>();

  constructor(
    private app: FastifyInstance,
    private prisma: PrismaClient,
    private eventBus: EventBus,
    private aiGateway: AIGateway,
  ) {}

  // 加载并初始化插件
  async load(plugin: EduPlugin): Promise<void> {
    // 检查依赖
    const missing = this.registry.checkDependencies(plugin);
    if (missing.length > 0) {
      throw new Error(`插件 "${plugin.name}" 缺少依赖: ${missing.join(', ')}`);
    }

    // 注册插件
    this.registry.register(plugin);

    // 创建上下文
    const ctx = createPluginContext(
      plugin.name, this.app, this.prisma, this.eventBus, this.aiGateway,
    );
    this.contexts.set(plugin.name, ctx);

    // 检查是否已安装
    const existing = await this.prisma.plugin.findUnique({
      where: { name: plugin.name },
    });

    if (!existing) {
      // 首次安装
      if (plugin.onInstall) {
        await plugin.onInstall(ctx);
      }
      await this.prisma.plugin.create({
        data: {
          name: plugin.name,
          version: plugin.version,
          displayName: plugin.displayName,
          description: plugin.description,
          status: 'ACTIVE',
        },
      });
      this.app.log.info(`插件 "${plugin.name}" 安装成功`);
    }

    // 初始化
    if (plugin.onInit) {
      await plugin.onInit(ctx);
    }
    this.app.log.info(`插件 "${plugin.name}" v${plugin.version} 已加载`);
  }

  // 卸载插件
  async unload(name: string): Promise<void> {
    const plugin = this.registry.get(name);
    const ctx = this.contexts.get(name);
    if (plugin && ctx && plugin.onDestroy) {
      await plugin.onDestroy(ctx);
    }
    this.contexts.delete(name);
    this.app.log.info(`插件 "${name}" 已卸载`);
  }

  getRegistry(): PluginRegistry {
    return this.registry;
  }
}

export { PluginRegistry } from './registry.js';
export type { EduPlugin, PluginContext } from './types.js';
