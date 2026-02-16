import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { openaiComplete, type AIMessage, type AICompletionResult } from './providers/openai.js';
import { authMiddleware } from '../auth/middleware.js';
import { encrypt, decrypt, maskApiKey } from '../crypto.js';

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
      apiKey: decrypt(config.apiKey),
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
        provider: result.model?.split('/')[0] || 'unknown',
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
      select: { id: true, provider: true, model: true, baseUrl: true, isDefault: true, schoolId: true, apiKey: true },
    });
    // Mask API keys in response
    return configs.map((c: typeof configs[number]) => ({ ...c, apiKey: maskApiKey(decrypt(c.apiKey)) }));
  });

  app.post('/api/ai/config', { preHandler: [authMiddleware] }, async (request, reply) => {
    const user = (request as any).user;
    if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return reply.code(403).send({ error: '权限不足' });
    }
    const body = request.body as any;
    if (!body.apiKey) return reply.code(400).send({ error: '缺少 apiKey' });
    const config = await prisma.aIConfig.create({
      data: {
        provider: body.provider,
        model: body.model,
        apiKey: encrypt(body.apiKey),
        baseUrl: body.baseUrl,
        schoolId: body.schoolId,
        isDefault: body.isDefault || false,
      },
    });
    return { ...config, apiKey: maskApiKey(body.apiKey) };
  });

  // 删除 AI 配置
  app.delete('/api/ai/config/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    const user = (request as any).user;
    if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return reply.code(403).send({ error: '权限不足' });
    }
    const { id } = request.params as { id: string };
    const config = await prisma.aIConfig.findUnique({ where: { id } });
    if (!config) {
      return reply.code(404).send({ error: '配置不存在' });
    }
    // ADMIN 只能删除本校的配置
    if (user.role === 'ADMIN' && config.schoolId !== user.schoolId) {
      return reply.code(403).send({ error: '无权删除此配置' });
    }
    await prisma.aIConfig.delete({ where: { id } });
    return { success: true };
  });

  // AI 连接测试（支持传入参数直接测试，或使用已保存的配置）
  app.post('/api/ai/test', { preHandler: [authMiddleware] }, async (request, reply) => {
    const user = (request as any).user;
    if (!['ADMIN', 'TEACHER', 'SUPER_ADMIN'].includes(user.role)) {
      return reply.code(403).send({ error: '权限不足' });
    }

    const body = request.body as any;
    const start = Date.now();

    try {
      let result;
      if (body?.apiKey) {
        // 直接用传入的参数测试（保存前测试）
        result = await openaiComplete({
          provider: body.provider || 'openai',
          model: body.model || 'gpt-4o-mini',
          apiKey: body.apiKey,
          baseUrl: body.baseUrl,
          messages: [
            { role: 'system', content: '你是测试助手。' },
            { role: 'user', content: '请回复OK' },
          ],
          maxTokens: 16,
        });
      } else {
        // 用已保存的配置测试
        const gateway = new AIGateway(prisma);
        result = await gateway.complete({
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
      }
      return { success: true, model: result.model, responseTime: Date.now() - start };
    } catch (err: any) {
      return { success: false, error: err.message, responseTime: Date.now() - start };
    }
  });
}
