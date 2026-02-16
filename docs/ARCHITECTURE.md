# EduForge 架构方案

> 开源教育 AI 引擎 · 让每个学生都有 AI 老师

---

## 一、产品定位

EduForge 是一个**开源、AI 原生的教育平台**，面向中国 K12 教育场景。核心引擎内置题库、作业、批改、错题、学情分析等教学功能，通过插件系统支持社区扩展。学校可私有部署，数据不出校。

| 理念 | 说明 |
|------|------|
| AI 原生 | AI 不是附加功能，是内置于核心的基础能力（Agent 引擎 + AI Gateway） |
| 核心内置 | 题库/作业/批改/错题/学情分析为核心功能，不可卸载 |
| 插件扩展 | 插件系统用于社区扩展（背单词、口语评测、AI 学伴等） |
| 开源可控 | 学校可私有部署，数据不出校 |

---

## 二、目标用户

| 用户 | 场景 |
|------|------|
| 独立教师 | 个人使用，出题批改，无需创建学校/组织（轻量模式） |
| 学校 / 培训机构 | 统一部署，管理员配置，多教师多班级（完整模式） |
| 学生 | 完成作业、自主学习、AI 辅导 |
| 开发者 | 开发教学扩展插件，贡献到社区 |

---

## 三、技术栈

| 层级 | 技术 | 选型理由 |
|------|------|----------|
| 后端引擎 | Fastify (Node.js) | 高性能、插件体系成熟、TypeScript 支持好 |
| 前端 | Next.js + React | SSR 支持、生态好 |
| 数据库 | PostgreSQL | 开源、信创兼容、性能强 |
| ORM | Prisma | 类型安全、迁移工具好 |
| 缓存 | Redis（可选） | 会话、限流、队列 |
| 部署 | Docker Compose | 一键部署，学校 IT 友好 |

---

## 四、项目结构

```
eduforge/
├── packages/
│   ├── core/                    # 核心引擎
│   │   ├── src/
│   │   │   ├── auth/            # 用户认证（JWT + Session）
│   │   │   ├── org/             # 组织结构（学校、年级、班级、学科）
│   │   │   ├── agent/           # Agent 引擎（对话、Tool Calling、确认机制）
│   │   │   ├── ai-gateway/      # AI 统一网关（多模型适配）
│   │   │   ├── plugin-engine/   # 插件系统（加载、注册、生命周期）
│   │   │   ├── event-bus/       # 事件总线（模块间通信）
│   │   │   └── storage/         # 文件存储抽象
│   │   └── prisma/
│   │       └── schema.prisma    # 数据库模型定义
│   └── sdk/                     # 插件开发 SDK
├── plugins/                     # 扩展插件（社区/第三方）
│   ├── question-bank/           # 题库管理（核心内置）
│   ├── homework/                # 作业系统（核心内置）
│   └── ai-grading/              # AI 批改（核心内置）
├── apps/
│   └── web/                     # Next.js 前端（统一）
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
├── scripts/                     # 脚本工具
└── docs/                        # 文档
```

> **说明**：`plugins/` 目录下的 question-bank、homework、ai-grading 虽然以插件形式组织代码，但属于核心内置功能，默认启用且不可卸载。插件系统的扩展点面向社区开发者。

---

## 五、架构图

```
┌─────────────────────────────────────────────────────────────┐
│                     前端 (Next.js)                           │
│  ┌──────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │ Dashboard │  │   AI 对话界面    │  │   管理后台       │  │
│  │ (传统 UI) │  │  (Agent 入口)    │  │   (Admin)        │  │
│  └─────┬────┘  └───────┬──────────┘  └───────┬──────────┘  │
│        │  REST API      │  SSE (流式)          │  REST API   │
└────────┼────────────────┼──────────────────────┼────────────┘
         │                │                      │
┌────────▼────────────────▼──────────────────────▼────────────┐
│                    核心引擎 (Fastify)                         │
│                                                              │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌────────┐ ┌──────────────┐    │
│  │ Auth │ │ RBAC │ │ Org  │ │ Event  │ │  AI Gateway  │    │
│  │ 认证 │ │ 权限 │ │ 组织 │ │  Bus   │ │  多模型适配  │    │
│  └──────┘ └──────┘ └──────┘ └────────┘ └──────┬───────┘    │
│                                                │             │
│  ┌─────────────────────────────────────────────▼──────────┐  │
│  │                   Agent 引擎                            │  │
│  │  对话管理 · Tool Calling · 权限检查 · 确认机制          │  │
│  └──────────────────────┬────────────────────────────────┘  │
│                         │                                    │
│  ┌──────────────────────▼────────────────────────────────┐  │
│  │              核心教学功能（内置）                        │  │
│  │  ┌──────┐ ┌──────┐ ┌────────┐ ┌──────┐ ┌──────────┐  │  │
│  │  │ 题库 │ │ 作业 │ │ AI批改 │ │错题本│ │ 学情分析 │  │  │
│  │  └──────┘ └──────┘ └────────┘ └──────┘ └──────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
│                         │                                    │
│  ┌──────────────────────▼────────────────────────────────┐  │
│  │              插件引擎（扩展点）                          │  │
│  │  背单词 · 口语评测 · AI 学伴 · 社区插件...              │  │
│  └──────────────────────────────────────────────────────┘  │
│                         │                                    │
│                    PostgreSQL                                │
└──────────────────────────────────────────────────────────────┘
```

---

## 六、核心引擎设计

### 6.1 用户认证 (Auth)

**代码位置**：`packages/core/src/auth/`

- JWT + HttpOnly Cookie 双模式
- 支持邮箱密码、手机验证码登录
- 预留 OAuth（微信登录）扩展点
- 多设备会话管理
- 密码使用 bcrypt 加密存储

### 6.2 角色权限 (RBAC)

```
角色层级：
SUPER_ADMIN  → 平台超级管理员（跨学校管理）
ADMIN        → 学校管理员（管理本校用户、配置）
TEACHER      → 教师（出题、布置作业、查看学情）
STUDENT      → 学生（做作业、查看错题、AI 辅导）
PARENT       → 家长（查看学情报告，预留）

权限粒度：
- 资源级：能否访问某个模块（如管理后台）
- 操作级：能否执行增删改查
- 数据级：只能操作自己关联的数据
  - 教师：只能看到自己班级的学生和作业
  - 学生：只能看到自己的作业和成绩
  - 管理员：只能看到本校的数据
```

### 6.3 组织结构 (Org)

**代码位置**：`packages/core/src/org/`

支持两种运行模式：

**轻量模式**（独立教师）：
- 无需创建学校、年级
- 注册即用，直接创建班级和学生
- 适合个人教师、培训机构

**完整模式**（学校部署）：
- 完整的组织层级：学校 → 年级 → 班级
- 管理员统一管理用户
- 支持多学段（小学/初中/高中）

```
数据模型：
School（学校）— 可选
  └── Grade（年级）
       └── Class（班级）
            ├── ClassTeacher（教师）→ 关联 Subject（学科）
            └── ClassStudent（学生）

StudyLevel（学段：小学/初中/高中）→ 关联年级
Subject（学科：语文/数学/英语...）
```

### 6.4 AI Gateway

**代码位置**：`packages/core/src/ai-gateway/`

统一的 AI 模型调用网关，所有 AI 功能通过此网关访问模型。

**四层配置覆盖模型**：

```
Layer 0: 平台默认（SaaS 模式下平台提供 AI 服务）
  └── Layer 1: 学校/机构级（管理员在后台统一配置）
       └── Layer 2: 教师个人级（教师可选填自己的 API Key）
            └── Layer 3: 学生（继承上层配置，不允许自行配置）
```

解析优先级：教师个人 > 学校级 > 平台默认。学生始终继承上层。

**任务分级（节省成本）**：

| 任务类型 | 推荐模型 | 原因 |
|----------|----------|------|
| 日常对话/简单查询 | deepseek-chat / qwen-turbo | 便宜快速 |
| AI 批改/出题 | deepseek-chat / qwen-plus | 质量要求中等 |
| 复杂分析/学情报告 | qwen-max / gpt-4o | 需要强推理 |
| 学生 AI 辅导 | deepseek-chat | 量大，需要便宜 |

管理员可配置任务-模型映射，系统根据任务类型自动选择模型。

**其他功能**：
- 多模型适配：OpenAI / 通义千问 / DeepSeek / 文心一言 / Ollama（本地）
- 用量统计：按学校、按用户统计 Token 用量
- 限额管理：学校月度配额 → 教师配额 → 学生配额（自动分配）
- 降级策略：主模型不可用时自动切换备用模型

### 6.5 Agent 引擎

**代码位置**：`packages/core/src/agent/`

```
agent/
├── engine.ts          # Agent 核心：对话循环 + Tool Calling
├── builtin-tools.ts   # 内置 Tools（查询题库、查询作业等）
├── tool-registry.ts   # Tool 注册表（从插件收集）
├── permissions.ts     # 权限检查（角色 × Tool × 确认级别）
├── session.ts         # 会话管理（SSE 流式输出）
├── routes.ts          # API 路由（POST /api/chat 等）
└── index.ts           # 模块入口
```

#### 双角色助手

```
教师 AI 助手                学生 AI 助手
├── 出题/组卷              ├── AI 辅导/答疑
├── 布置/管理作业          ├── 错题复习
├── 学情分析              ├── 学习建议
├── 班级管理              └── 查看作业
└── 系统配置
```

两个角色共用同一个 Agent 引擎，通过 Tool 权限和 System Prompt 区分行为。

#### Tool 分类与权限

**自动执行（查询类，无需确认）**：

| Tool | 说明 | 教师 | 学生 |
|------|------|------|------|
| `query_questions` | 查询题库 | Y | Y |
| `query_assignments` | 查看作业列表 | Y | Y（仅自己的） |
| `query_submissions` | 查看提交/批改结果 | Y | Y（仅自己的） |
| `query_mistakes` | 查看错题 | Y（班级的） | Y（自己的） |
| `query_analytics` | 学情数据 | Y | N |
| `query_classes` | 班级信息 | Y | Y（仅自己的班） |

**需确认执行（修改类）**：

| Tool | 说明 | 教师 | 学生 |
|------|------|------|------|
| `generate_questions` | AI 出题 | Y（确认后入库） | N |
| `create_assignment` | 布置作业 | Y（确认后发布） | N |
| `submit_answers` | 提交作业 | N | Y（确认后提交） |

**需审批（高权限操作）**：

| Tool | 说明 | 触发流程 |
|------|------|----------|
| `install_plugin` | 安装新插件 | 学校模式：教师申请 → 管理员审批；个人模式：直接安装 |
| `delete_data` | 删除数据 | 二次确认 + 操作日志 |
| `export_data` | 导出数据 | 记录审计日志 |

#### 对话流程

```
用户消息
  → 上下文组装（用户角色 + 可用 Tools + 对话历史）
    → AI 模型（Tool Calling）
      → 返回 Tool 调用意图
        → 权限检查
          → [查询类] 直接执行 → 返回结果 → AI 组织回复
          → [修改类] 生成确认卡片 → 等待用户确认 → 执行
          → [审批类] 创建审批单 → 通知管理员 → 等待审批
```

#### 流式响应

对话使用 SSE (Server-Sent Events) 流式输出：
- AI 文本：逐字流式
- Tool 调用：显示"正在查询..."状态
- 确认卡片：structured message
- 执行结果：inline 展示

### 6.6 教学功能（核心内置）

以下功能为核心内置，默认启用，不可卸载。代码以插件形式组织在 `plugins/` 目录下，便于解耦维护。

#### 题库 (question-bank)

**代码位置**：`plugins/question-bank/`

- 题目 CRUD，支持选择题、填空题、解答题等多种题型
- 知识点体系管理
- 按教材版本、学段、年级分类
- 支持手动录入和 AI 生成

#### 作业 (homework)

**代码位置**：`plugins/homework/`

- 作业布置（选题 → 设截止时间 → 发布到班级）
- 学生提交
- 自动/手动批改流程
- 依赖题库模块

#### AI 批改 (ai-grading)

**代码位置**：`plugins/ai-grading/`

- 监听作业提交事件，自动触发 AI 批改
- 评分 + 逐题解析 + 反馈
- 批改完成后触发事件通知错题本和学情模块
- 通过 AI Gateway 调用模型

#### 错题本 (mistake-book)

- 自动从批改结果收集错题
- 按知识点分类
- 生成复习计划
- 规划中

#### 学情分析 (analytics)

- 知识点掌握度分析
- 班级/个人成绩趋势
- 薄弱知识点识别
- 规划中

### 6.7 插件引擎（扩展点）

**代码位置**：`packages/core/src/plugin-engine/`

插件系统用于**社区扩展**，核心教学功能不通过插件安装/卸载控制。

```typescript
// 插件接口
interface EduPlugin {
  name: string;
  version: string;
  dependencies?: string[];

  onInstall?(ctx: PluginContext): Promise<void>;
  onInit?(ctx: PluginContext): Promise<void>;
  onDestroy?(ctx: PluginContext): Promise<void>;

  // 插件暴露给 AI 助手的 Tools
  aiTools?: AITool[];
}

// 插件能力
interface PluginContext {
  registerRoute(method, path, handler): void;  // 注册 API 路由
  events: EventBus;                             // 事件总线
  ai: AIGateway;                                // 调用 AI
  db: PluginDatabase;                           // 插件数据库
  logger: Logger;
}
```

**插件安装 = AI 获得新能力**：插件注册 `aiTools` 后，Agent 引擎自动将其纳入可用 Tool 列表。

社区插件示例方向：
- 背单词（记忆曲线 + AI 例句）
- 口语评测（语音识别 + 发音打分）
- AI 学伴（个性化问答辅导）
- 备课助手（AI 生成教案）

### 6.8 事件总线 (Event Bus)

**代码位置**：`packages/core/src/event-bus/`

模块间通过事件解耦通信：

```
核心事件：
├── user:created / user:updated
├── class:student_added / class:student_removed
└── system:plugin_installed / system:plugin_removed

教学功能事件：
├── homework:assigned        → 教师布置了作业
├── homework:submitted       → 学生提交了作业
├── grading:completed        → AI 批改完成
├── mistake:recorded         → 错题被记录
└── analytics:report_ready   → 学情报告生成完毕
```

---

## 七、核心领域模型

### 中国 K12 教育概念

| 概念 | 说明 | 数据模型 |
|------|------|----------|
| 学段 | 小学(6年)/初中(3年)/高中(3年) | `StudyLevel` — code, name, order |
| 年级 | 一年级~高三，关联学段 | `Grade` — 关联 StudyLevel |
| 学期 | 上学期/下学期，与学年关联 | 通过 `Class.academicYear` 表示 |
| 学科 | 语文/数学/英语/物理/化学等 | `Subject` — code, name, color, icon |
| 课标 | 国家课程标准，按学段+学科组织 | 规划中，用于知识点体系 |
| 教材版本 | 人教版/北师大版/苏教版等 | 规划中，关联题库 |
| 组卷 | 按知识点、难度、题型组合试卷 | 通过 Agent 引擎 + 题库实现 |

### 知识点体系（规划中）

```
课标
  └── 学段（初中数学）
       └── 教材版本（人教版）
            └── 章节
                 └── 知识点
                      └── 关联题目
```

---

## 八、数据库设计

基于 Prisma ORM，数据库为 PostgreSQL。完整定义见 `packages/core/prisma/schema.prisma`。

### 核心表

```
User          — 用户（id, email, phone, name, passwordHash, role, status, schoolId）
Teacher       — 教师档案（userId → User, title）
Student       — 学生档案（userId → User, studentNo）

School        — 学校（name, code, address）
StudyLevel    — 学段（code, name, order）
Grade         — 年级（name, code, order, studyLevelId, schoolId）
Class         — 班级（name, gradeId, academicYear）
Subject       — 学科（name, code, color, icon, order）

ClassTeacher  — 班级-教师-学科关联（联合主键：classId + teacherId + subjectId）
ClassStudent  — 班级-学生关联（联合主键：classId + studentId）

Plugin        — 插件注册（name, version, status, config）
AIConfig      — AI 配置（schoolId, provider, model, apiKey, baseUrl, isDefault）
AIUsageLog    — AI 用量日志（userId, schoolId, plugin, provider, model, inputTokens, outputTokens, cost）
Setting       — 系统设置（key-value，scope 区分范围）
```

### 数据关系

```
School 1──N User
School 1──N Grade
School 1──N AIConfig

StudyLevel 1──N Grade
Grade 1──N Class
Class N──N Teacher (via ClassTeacher, 含 Subject)
Class N──N Student (via ClassStudent)

User 1──1 Teacher (可选)
User 1──1 Student (可选)
User 1──N AIUsageLog
```

---

## 九、前端设计

### 原则

- 前端是一个完整的 Next.js 应用（`apps/web/`）
- 通过 API 检测用户角色和功能状态，动态显示/隐藏模块
- 核心教学功能的 UI 预置在前端代码中
- 扩展插件如需 UI，提供 JSON Schema，前端统一渲染

### 路由结构

```
/ (首页/Landing)
/login
/register

/dashboard (根据角色显示不同内容)
  /dashboard/assignments      ← 教师：作业管理
  /dashboard/my-assignments   ← 学生：我的作业
  /dashboard/questions        ← 题库管理
  /dashboard/classes          ← 班级管理
  /dashboard/school           ← 学校信息
  /dashboard/analytics        ← 学情分析
  /dashboard/mistakes         ← 错题本
  /dashboard/progress         ← 学生：学习进度
  /dashboard/chat             ← AI 对话助手
  /dashboard/ai-settings      ← 教师 AI 配置

/admin (管理后台，ADMIN/SUPER_ADMIN)
  /admin/users               ← 用户管理
  /admin/school              ← 学校管理
  /admin/plugins             ← 插件管理
  /admin/ai-config           ← AI Gateway 配置
  /admin/monitor             ← 系统监控
  /admin/settings            ← 系统设置
```

---

## 十、数据安全与合规

### 学生隐私保护

- 学生数据（姓名、学号、成绩）仅教师和管理员可访问
- 学生间不可互相查看成绩
- 数据级权限：教师只能看到自己班级的学生数据
- 前端不传输不必要的敏感字段

### AI 数据边界

- 发送给 AI 模型的数据不包含学生真实姓名，使用编号代替
- AI 对话记录按学校隔离存储
- 管理员可配置是否允许将学生作答内容发送给外部 AI 服务
- 本地部署模式（Ollama）可实现数据完全不出校

### 审计日志

- AI 用量日志：记录每次 AI 调用的用户、模型、Token 消耗（`AIUsageLog` 表）
- 关键操作日志：用户增删、作业发布、数据导出等操作记录
- 日志保留策略：由管理员配置

### 密码与认证安全

- 密码使用 bcrypt 加密存储
- JWT Token 有过期时间
- 支持 HttpOnly Cookie 防 XSS
- 后端 Helmet 安全头、CORS 配置、Rate Limit 限流

---

## 十一、部署方案

### 个人/小型部署

```
单机 Docker Compose：
  - Node.js (Fastify + Next.js)
  - PostgreSQL
  - 可选：Redis

最低配置：2 核 4G 内存
适合：独立教师、小型培训机构
```

### 学校部署

```
Docker Compose 或 K8s：
  - Node.js 应用（可水平扩展）
  - PostgreSQL（主从复制）
  - Redis（会话 + 缓存）
  - 可选：Ollama（本地 AI 模型）

推荐配置：4 核 8G+ 内存
适合：学校私有部署，数据不出校
```

### SaaS 托管（规划中）

```
多租户架构：
  - 按学校隔离数据
  - 统一 AI 服务代理
  - 弹性扩缩容
```

---

## 十二、信创兼容

| 要求 | EduForge 方案 | 兼容性 |
|------|-------------|--------|
| 操作系统 | Docker 部署 | 可跑在统信 UOS、麒麟 |
| 数据库 | PostgreSQL | 信创目录认可 |
| AI 模型 | 通义千问/DeepSeek/文心一言 | 国产大模型 |
| 芯片架构 | Node.js | ARM（鲲鹏/飞腾）可运行 |
| 浏览器 | Web 标准 | 不依赖特定浏览器 |

---

## 十三、开发路线

### Phase 1：核心引擎 + 基础教学（已完成）

- [x] 项目初始化（Monorepo + TypeScript + Prisma）
- [x] 用户认证 + RBAC
- [x] 组织结构（学校、年级、班级、学科、学段）
- [x] 插件引擎（加载、注册、生命周期、事件总线）
- [x] AI Gateway（多模型适配）
- [x] Agent 引擎（Tool Calling、确认机制、双角色）
- [x] 前端框架（Next.js + 基础布局 + 管理后台）
- [x] 题库插件、作业插件、AI 批改插件基础实现

### Phase 2：核心链路完善（进行中）

- [ ] 完善作业提交 → AI 批改 → 错题收集完整链路
- [ ] 错题本功能实现
- [ ] 学情分析基础实现
- [ ] 知识点体系 + 教材版本支持
- [ ] 组卷功能（AI 智能组卷）
- [ ] Docker 一键部署

### Phase 3：体验优化 + 生态

- [ ] 前端 UI/UX 完善
- [ ] 插件 SDK 文档 + 开发指南
- [ ] 数据导入导出
- [ ] GitHub 开源发布

---

*文档版本：v2.0*
*更新日期：2026-02-16*
*详细 AI 助手设计参见 [AI-ASSISTANT-DESIGN.md](./AI-ASSISTANT-DESIGN.md)*
