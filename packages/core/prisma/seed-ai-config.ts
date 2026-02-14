import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 检查是否已有默认配置
  const existing = await prisma.aIConfig.findFirst({ where: { isDefault: true } });
  if (existing) {
    console.log('默认 AI 配置已存在，跳过');
    return;
  }

  await prisma.aIConfig.create({
    data: {
      provider: 'deepseek',
      model: 'deepseek-chat',
      apiKey: 'sk-placeholder-请在管理后台设置真实密钥',
      baseUrl: 'https://api.deepseek.com/v1',
      isDefault: true,
    },
  });

  console.log('✅ 默认 AI 配置已创建 (DeepSeek, 需要设置 API Key)');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
