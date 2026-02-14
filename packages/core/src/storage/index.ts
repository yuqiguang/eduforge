// 文件存储抽象层
import { mkdir, writeFile, readFile, unlink } from 'fs/promises';
import { join } from 'path';

export interface StorageProvider {
  save(key: string, data: Buffer, contentType?: string): Promise<string>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
}

// 本地文件存储（默认）
export class LocalStorage implements StorageProvider {
  private basePath: string;

  constructor(basePath?: string) {
    this.basePath = basePath || join(process.cwd(), 'uploads');
  }

  async save(key: string, data: Buffer): Promise<string> {
    const filePath = join(this.basePath, key);
    const dir = filePath.substring(0, filePath.lastIndexOf('/'));
    await mkdir(dir, { recursive: true });
    await writeFile(filePath, data);
    return key;
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await readFile(join(this.basePath, key));
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(join(this.basePath, key));
    } catch {
      // 忽略不存在的文件
    }
  }
}
