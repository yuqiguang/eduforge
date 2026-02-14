# EduForge

> 开源教育 AI 引擎 · 让每个学生都有 AI 老师

EduForge 是一个**开源、插件化**的教育 AI 平台。核心引擎小而精，所有教学功能通过插件实现，教师、开发者和社区可以共建教育生态。

## 特性

- 🧩 **插件化架构** — 核心引擎 + 插件，按需组合
- 🤖 **AI 原生** — 内置 AI 网关，统一调用多种大模型
- 🏫 **K12 适配** — 适配中国教材体系和教学场景
- 🔒 **数据自控** — 支持私有部署，数据不出校
- 🇨🇳 **信创兼容** — 支持国产 OS、国产数据库、国产大模型

## 快速开始

```bash
# 克隆项目
git clone https://github.com/your-org/eduforge.git
cd eduforge

# 安装依赖
pnpm install

# 初始化数据库
cd packages/core
pnpm db:push
pnpm db:generate

# 启动开发服务
pnpm dev
```

## 项目结构

```
eduforge/
├── packages/
│   ├── core/          # 核心引擎（Fastify + Prisma）
│   └── sdk/           # 插件开发 SDK
├── plugins/           # 官方内置插件
├── apps/
│   └── web/           # 前端（Next.js）
├── docker/            # Docker 部署配置
└── docs/              # 文档
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Fastify + TypeScript |
| 数据库 | PostgreSQL + Prisma |
| 前端 | Next.js + React + Tailwind |
| AI | OpenAI 兼容接口（通义千问/DeepSeek/文心一言/Ollama） |
| 部署 | Docker Compose |

## 文档

- [架构方案](docs/ARCHITECTURE.md)

## License

MIT
