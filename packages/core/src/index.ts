import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { PrismaClient } from '@prisma/client';
import { loadConfig } from './config.js';
import { EventBus } from './event-bus/index.js';
import { AIGateway, registerAIRoutes } from './ai-gateway/index.js';
import { PluginLoader } from './plugin-engine/index.js';
import { registerAuthRoutes } from './auth/routes.js';
import { registerOrgRoutes } from './org/routes.js';
import { registerAgentRoutes } from './agent/index.js';

async function main() {
  const config = loadConfig();
  const prisma = new PrismaClient();
  const eventBus = new EventBus();
  const aiGateway = new AIGateway(prisma);

  // 创建 Fastify 实例
  const app = Fastify({
    logger: {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: { colorize: true },
      },
    },
  });

  // CORS
  await app.register(cors, { origin: config.cors.origin, credentials: true });

  // Cookie support for HttpOnly JWT
  await app.register(cookie);

  // Security headers
  await app.register(helmet, {
    contentSecurityPolicy: false,  // Handled by nginx in production
  });

  // Rate limiting
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    // Stricter limits for auth and AI endpoints
    keyGenerator: (request) => {
      return (request as any).user?.userId || request.ip;
    },
  });

  // 健康检查
  app.get('/api/health', async () => ({
    status: 'ok',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  }));

  // 注册核心路由
  registerAuthRoutes(app, prisma, eventBus);
  registerOrgRoutes(app, prisma, eventBus);
  registerAIRoutes(app, prisma);
  registerAgentRoutes(app, prisma);

  // 插件加载器
  const pluginLoader = new PluginLoader(app, prisma, eventBus, aiGateway);

  // 插件管理 API
  app.get('/api/plugins', async () => {
    return pluginLoader.getRegistry().getAll().map(p => ({
      name: p.name,
      version: p.version,
      displayName: p.displayName,
      description: p.description,
    }));
  });

  // 加载内置插件 (dynamic paths to avoid rootDir constraint)
  const pluginPaths = [
    '../../../plugins/question-bank/src/index.js',
    '../../../plugins/homework/src/index.js',
    '../../../plugins/ai-grading/src/index.js',
  ];
  for (const p of pluginPaths) {
    const { default: plugin } = await import(p);
    await pluginLoader.load(plugin);
  }

  // 启动服务
  try {
    await app.listen({ port: config.port, host: config.host });
    console.log(`\n🚀 EduForge 核心引擎已启动`);
    console.log(`   地址: http://${config.host}:${config.port}`);
    console.log(`   API:  http://${config.host}:${config.port}/api/health\n`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
