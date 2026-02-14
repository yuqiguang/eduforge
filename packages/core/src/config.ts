// 配置管理
export interface AppConfig {
  port: number;
  host: string;
  jwtSecret: string;
  databaseUrl: string;
  cors: { origin: string[] };
}

export function loadConfig(): AppConfig {
  return {
    port: parseInt(process.env.PORT || '3001'),
    host: process.env.HOST || '0.0.0.0',
    jwtSecret: process.env.JWT_SECRET || 'eduforge-dev-secret-change-in-production',
    databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:123456@localhost:5432/eduforge_v2?schema=public',
    cors: {
      origin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(','),
    },
  };
}
