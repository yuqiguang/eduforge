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

## Docker 部署

### 一键启动

```bash
# 复制环境变量模板并修改
cp .env.example .env
# 编辑 .env，设置 JWT_SECRET、POSTGRES_PASSWORD 等

# 构建并启动所有服务
docker compose up -d

# 查看日志
docker compose logs -f
```

启动后访问 `http://localhost` 即可使用。

### 架构

- **nginx** (:80) — 反向代理统一入口
  - `/` → Next.js 前端
  - `/api/` → Fastify 后端
- **web** (:3000) — Next.js 前端
- **api** (:3001) — Fastify 后端（自动执行 prisma db push 建表）
- **postgres** (:5432) — 数据库（仅内部网络，不对外暴露）

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `POSTGRES_PASSWORD` | 数据库密码 | `eduforge_secret` |
| `JWT_SECRET` | JWT 签名密钥 | `change-me-in-production` |
| `NEXT_PUBLIC_API_URL` | 前端调用 API 的地址 | `http://localhost/api` |
| `NGINX_PORT` | Nginx 监听端口 | `80` |

### 常用命令

```bash
# 停止
docker compose down

# 停止并删除数据卷
docker compose down -v

# 重新构建
docker compose build --no-cache
```

## 文档

- [架构方案](docs/ARCHITECTURE.md)

## License

MIT
