// EduForge 插件 SDK
// 插件开发者通过此 SDK 与核心引擎交互

// 事件总线接口
export interface IEventBus {
  on(event: string, handler: (...args: any[]) => void): void;
  off(event: string, handler: (...args: any[]) => void): void;
  emit(event: string, ...args: any[]): void;
  once(event: string, handler: (...args: any[]) => void): void;
}

// AI 网关接口
export interface IAIGateway {
  complete(request: {
    task: string;
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    temperature?: number;
    maxTokens?: number;
    userId?: string;
    schoolId?: string;
    plugin?: string;
  }): Promise<{
    content: string;
    inputTokens: number;
    outputTokens: number;
    model: string;
  }>;
}

// 插件上下文接口
export interface PluginContext {
  registerRoute(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    path: string,
    handler: any,
    options?: any
  ): void;

  events: IEventBus;
  ai: IAIGateway;
  prisma: any; // 核心数据库访问（只读）

  logger: {
    info(msg: string, ...args: any[]): void;
    warn(msg: string, ...args: any[]): void;
    error(msg: string, ...args: any[]): void;
  };
}

// 插件接口 - 所有插件必须实现此接口
export interface EduPlugin {
  /** 插件唯一标识 */
  name: string;
  /** 版本号 */
  version: string;
  /** 显示名称 */
  displayName?: string;
  /** 描述 */
  description?: string;
  /** 依赖的其他插件 */
  dependencies?: string[];

  /** 首次安装时调用（建表等） */
  onInstall?(ctx: PluginContext): Promise<void>;
  /** 每次启动时调用 */
  onInit?(ctx: PluginContext): Promise<void>;
  /** 卸载时调用 */
  onDestroy?(ctx: PluginContext): Promise<void>;
}

// 插件基类（可选，提供便捷方法）
export abstract class BasePlugin implements EduPlugin {
  abstract name: string;
  abstract version: string;
  displayName?: string;
  description?: string;
  dependencies?: string[];

  async onInstall?(ctx: PluginContext): Promise<void>;
  async onInit?(ctx: PluginContext): Promise<void>;
  async onDestroy?(ctx: PluginContext): Promise<void>;
}
