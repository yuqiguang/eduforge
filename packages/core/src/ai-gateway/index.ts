import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { openaiComplete, type AIMessage, type AICompletionResult } from './providers/openai.js';
import { authMiddleware } from '../auth/middleware.js';

export interface AIRequest {
  task: string;
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
  userId?: string;
  schoolId?: string;
  plugin?: string;
}

// AI 统一网关 - 所有插件通过此网关调用大模型
export class AIGateway {
  constructor(private prisma: PrismaClient) {}

  async complete(request: AIRequest): Promise<AICompletionResult> {
    const config = await this.getConfig(request.schoolId);
    if (!config) {
      throw new Error('未配置 AI 服务，请在管理后台设置');
    }

    const result = await openaiComplete({
      provider: config.provider,
      model: config.model,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl ?? undefined,
      messages: request.messages,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
    });

    // 记录用量
    if (request.userId) {
      await this.logUsage(request, result);
    }

    return result;
  }

  private async getConfig(schoolId?: string) {
    if (schoolId) {
      const schoolConfig = await this.prisma.aIConfig.findFirst({
        where: { schoolId },
      });
      if (schoolConfig) return schoolConfig;
    }
    return this.prisma.aIConfig.findFirst({ where: { isDefault: true } });
  }

  private async logUsage(request: AIRequest, result: AICompletionResult) {
    await this.prisma.aIUsageLog.create({
      data: {
        userId: request.userId!,
        schoolId: request.schoolId,
        plugin: request.plugin || 'system',
        provider: request.model?.split('/')[0] || 'unknown',
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      },
    });
  }
}

// AI 管理路由
export function registerAIRoutes(app: FastifyInstance, prisma: PrismaClient) {
  app.get('/api/ai/config', { preHandler: [authMiddleware] }, async (request) => {
    const user = (request as any).user;
    const configs = await prisma.aIConfig.findMany({
      where: user.role === 'SUPER_ADMIN' ? {} : { schoolId: user.schoolId },
      select: { id: true, provider: true, model: true, baseUrl: true, isDefault: true, schoolId: true },
    });
    return configs;
  });

  app.post('/api/ai/config', { preHandler: [authMiddleware] }, async (request, reply) => {
    const user = (request as any).user;
    if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return reply.code(403).send({ error: '权限不足' });
    }
    const body = request.body as any;
    const config = await prisma.aIConfig.create({
      data: {
        provider: body.provider,
        model: body.model,
        apiKey: body.apiKey,
        baseUrl: body.baseUrl,
        schoolId: body.schoolId,
        isDefault: body.isDefault || false,
      },
    });
    return config;
  });

  // AI 连接测试
  app.post('/api/ai/test', { preHandler: [authMiddleware] }, async (request, reply) => {
    const user = (request as any).user;
    if (!['ADMIN', 'TEACHER', 'SUPER_ADMIN'].includes(user.role)) {
      return reply.code(403).send({ error: '权限不足' });
    }
    const gateway = new AIGateway(prisma);
    const start = Date.now();
    try {
      const result = await gateway.complete({
        task: 'test',
        messages: [
          { role: 'system', content: '你是测试助手。' },
          { role: 'user', content: '请回复OK' },
        ],
        maxTokens: 16,
        userId: user.userId,
        schoolId: user.schoolId,
        plugin: 'system-test',
      });
      return { success: true, model: result.model, responseTime: Date.now() - start };
    } catch (err: any) {
      return { success: false, error: err.message, responseTime: Date.now() - start };
    }
  });
}
