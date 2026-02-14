import type { EduPlugin } from './types.js';

// 插件注册表
export class PluginRegistry {
  private plugins = new Map<string, EduPlugin>();

  register(plugin: EduPlugin): void {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`插件 "${plugin.name}" 已注册`);
    }
    this.plugins.set(plugin.name, plugin);
  }

  get(name: string): EduPlugin | undefined {
    return this.plugins.get(name);
  }

  has(name: string): boolean {
    return this.plugins.has(name);
  }

  getAll(): EduPlugin[] {
    return Array.from(this.plugins.values());
  }

  // 检查依赖是否满足
  checkDependencies(plugin: EduPlugin): string[] {
    const missing: string[] = [];
    for (const dep of plugin.dependencies || []) {
      if (!this.has(dep)) {
        missing.push(dep);
      }
    }
    return missing;
  }
}
