import Fastify from 'fastify';
import cors from '@fastify/cors';
import { PrismaClient } from '@prisma/client';
import { loadConfig } from './config.js';
import { EventBus } from './event-bus/index.js';
import { AIGateway, registerAIRoutes } from './ai-gateway/index.js';
import { PluginLoader } from './plugin-engine/index.js';
import { registerAuthRoutes } from './auth/routes.js';
import { registerOrgRoutes } from './org/routes.js';

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

  // 健康检查
  app.get('/api/health', async () => ({
    status: 'ok',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  }));

  // 注册核心路由
  registerAuthRoutes(app, prisma);
  registerOrgRoutes(app, prisma);
  registerAIRoutes(app, prisma);

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

  // 加载内置插件
  const { default: questionBankPlugin } = await import('../../../plugins/question-bank/src/index.js');
  const { default: homeworkPlugin } = await import('../../../plugins/homework/src/index.js');
  const { default: aiGradingPlugin } = await import('../../../plugins/ai-grading/src/index.js');

  await pluginLoader.load(questionBankPlugin);
  await pluginLoader.load(homeworkPlugin);
  await pluginLoader.load(aiGradingPlugin);

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
