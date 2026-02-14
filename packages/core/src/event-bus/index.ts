// 事件总线 - 插件间通信的核心
import { EventEmitter } from 'events';

export class EventBus {
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(100);
  }

  on(event: string, handler: (...args: any[]) => void): void {
    this.emitter.on(event, handler);
  }

  off(event: string, handler: (...args: any[]) => void): void {
    this.emitter.off(event, handler);
  }

  emit(event: string, ...args: any[]): void {
    this.emitter.emit(event, ...args);
  }

  once(event: string, handler: (...args: any[]) => void): void {
    this.emitter.once(event, handler);
  }
}

export const eventBus = new EventBus();
