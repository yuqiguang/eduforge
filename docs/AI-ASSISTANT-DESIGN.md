# EduForge AI 助手 — 技术方案

> 版本：v1.0 | 日期：2026-02-15
> 状态：已确定，待实现

---

## 一、设计原则

借鉴 OpenClaw 的三个核心设计：

1. **对话即操作** — 用户说什么，AI 就做什么，插件是 AI 的手和脚
2. **能力插件化** — AI 助手不内置业务逻辑，所有教学能力来自插件暴露的 Tools
3. **配置层级覆盖** — 上层设默认，下层可覆盖，简单场景零配置，复杂场景够灵活

---

## 二、AI 配置层级（决策 Q1）

### 四层覆盖模型

```
┌─────────────────────────────────────────┐
│  Layer 0: 平台默认                       │
│  - SaaS 模式下平台提供的 AI 服务          │
│  - 按量计费，用户无需配置                 │
│  ┌───────────────────────────────────┐   │
│  │  Layer 1: 学校/机构级              │   │
│  │  - 管理员在后台统一配置             │   │
│  │  - 可选择模型、设用量预算            │   │
│  │  - 覆盖平台默认                    │   │
│  │  ┌─────────────────────────────┐  │   │
│  │  │  Layer 2: 教师个人级         │  │   │
│  │  │  - 教师可选填自己的 Key      │  │   │
│  │  │  - 不填则继承学校配置        │  │   │
│  │  │  - 覆盖学校级               │  │   │
│  │  │  ┌───────────────────────┐  │  │   │
│  │  │  │  Layer 3: 学生         │  │  │   │
│  │  │  │  - 永远继承上层配置    │  │  │   │
│  │  │  │  - 不允许自行配置      │  │  │   │
│  │  │  └───────────────────────┘  │  │   │
│  │  └─────────────────────────────┘  │   │
│  └───────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### 配置解析逻辑

```typescript
async function resolveAIConfig(userId: string): Promise<AIConfig> {
  const user = await getUser(userId);
  
  // Layer 2: 教师个人配置（仅教师角色）
  if (user.role === 'TEACHER') {
    const personal = await getPersonalAIConfig(userId);
    if (personal?.apiKey) return personal;
  }
  
  // Layer 1: 学校/机构级
  if (user.schoolId) {
    const school = await getSchoolAIConfig(user.schoolId);
    if (school?.apiKey) return school;
  }
  
  // Layer 0: 平台默认
  return getPlatformDefaultConfig();
}
```

### 各场景对照

| 场景 | 谁配置 | 用哪层 | 付费方 |
|------|--------|--------|--------|
| SaaS 个人教师 | 不需要配，注册即用 | Layer 0 平台默认 | 平台免费额度 + 超出自付 |
| SaaS 教师自带 Key | 教师在"设置"填 Key | Layer 2 个人 | 教师自己 |
| 学校部署 | 管理员在后台配 | Layer 1 学校 | 学校统一采购 |
| 学校部署 + 教师自带 | 管理员配基础，教师可覆盖 | Layer 2 > Layer 1 | 混合 |
| 培训机构 | 机构负责人配 | Layer 1 | 机构 |

### 用量控制

```
平台总额度
  └── 学校月度配额（管理员设置，如 100 万 tokens/月）
        └── 教师配额（可选，默认不限）
              └── 学生配额（自动分配，如每人每天 5000 tokens）
```

超出配额时：降级到小模型 → 提示用量不足 → 不直接报错

### 模型分级（节省成本）

| 任务类型 | 推荐模型 | 原因 |
|----------|----------|------|
| 日常对话/简单查询 | deepseek-chat / qwen-turbo | 便宜快速 |
| AI 批改/出题 | deepseek-chat / qwen-plus | 质量要求中等 |
| 复杂分析/学情报告 | qwen-max / gpt-4o | 需要强推理 |
| 学生 AI 辅导 | deepseek-chat | 量大，需要便宜 |

管理员可配置任务-模型映射，AI 助手根据任务类型自动选择。

---

## 三、AI 助手能力设计（决策 Q2）

### 双角色助手

```
┌──────────────────┐    ┌──────────────────┐
│   教师 AI 助手    │    │   学生 AI 助手    │
│                  │    │                  │
│  📚 出题/组卷    │    │  📖 AI 辅导      │
│  📋 布置/管理作业 │    │  ❓ 答疑解惑     │
│  📊 学情分析     │    │  ❌ 错题复习      │
│  👥 班级管理     │    │  📈 学习建议     │
│  🔌 插件管理     │    │  📋 查看作业     │
│  ⚙️ 系统配置     │    │                  │
└──────────────────┘    └──────────────────┘
       │                        │
       └────────┬───────────────┘
                │
        ┌───────┴───────┐
        │  Tool Calling  │
        │  统一 Agent    │
        └───────┬───────┘
                │
    ┌───────────┼───────────┐
    │           │           │
  插件 Tools   核心 API   插件市场
```

### Tool 分类与权限

#### 🟢 自动执行（查询类，无需确认）

| Tool | 说明 | 教师 | 学生 |
|------|------|------|------|
| `query_questions` | 查询题库 | ✅ | ✅ |
| `query_assignments` | 查看作业列表 | ✅ | ✅（仅自己的） |
| `query_submissions` | 查看提交/批改结果 | ✅ | ✅（仅自己的） |
| `query_mistakes` | 查看错题 | ✅（看班级的） | ✅（看自己的） |
| `query_analytics` | 学情数据 | ✅ | ❌ |
| `query_classes` | 班级信息 | ✅ | ✅（仅自己的班） |
| `query_plugins` | 查看已安装插件 | ✅ | ❌ |
| `search_plugin_hub` | 搜索插件市场 | ✅ | ❌ |

#### 🟡 需确认执行（修改类，AI 先描述将要做什么，用户确认后执行）

| Tool | 说明 | 教师 | 学生 |
|------|------|------|------|
| `generate_questions` | AI 出题 | ✅ 确认后入库 | ❌ |
| `create_assignment` | 布置作业 | ✅ 确认后发布 | ❌ |
| `submit_answers` | 提交作业 | ❌ | ✅ 确认后提交 |
| `install_plugin` | 安装插件 | ⚠️ 见下文 | ❌ |
| `update_settings` | 修改配置 | ⚠️ 仅管理员 | ❌ |

#### 🔴 需审批（高权限操作）

| Tool | 说明 | 触发流程 |
|------|------|----------|
| `install_plugin` | 安装新插件 | 学校模式：教师申请 → 管理员审批 → 安装 |
|  |  | 个人模式：教师直接安装 |
| `delete_data` | 删除数据 | 二次确认 + 操作日志 |
| `export_data` | 导出数据 | 记录审计日志 |

### 确认机制的交互设计

```
教师：帮我给七年级一班布置一次数学作业，10道一元一次方程

AI：好的，我来准备：
    📋 作业标题：一元一次方程练习
    👥 班级：七年级一班（29人）
    📚 题目：10 道一元一次方程（4 易 + 4 中 + 2 难）
    ⏰ 截止：本周五 23:59
    
    [确认布置] [修改] [取消]

教师：截止时间改成周四

AI：已更新截止时间为周四 23:59。
    [确认布置] [取消]

教师：确认

AI：✅ 作业已布置，29 名学生将在下次登录时看到。
```

---

## 四、插件与 AI 的关系（决策 Q2 扩展）

### 插件暴露 Tools

每个插件在注册时声明它提供的 AI Tools：

```typescript
// 插件开发者在 SDK 中声明
const homeworkPlugin: EduPlugin = {
  name: 'homework',
  
  // 插件暴露给 AI 的能力
  aiTools: [
    {
      name: 'create_assignment',
      description: '为指定班级布置作业',
      parameters: {
        title: { type: 'string', description: '作业标题' },
        classId: { type: 'string', description: '班级ID' },
        questionIds: { type: 'array', description: '题目ID列表' },
        deadline: { type: 'string', description: '截止时间' },
      },
      confirmRequired: true,  // 需要用户确认
      roles: ['TEACHER'],     // 允许的角色
    },
    {
      name: 'query_submissions',
      description: '查询作业提交情况',
      parameters: { assignmentId: { type: 'string' } },
      confirmRequired: false,
      roles: ['TEACHER', 'STUDENT'],
    },
  ],
  
  async onInit(ctx) { /* ... */ },
};
```

### 插件安装 → AI 自动获得新能力

```
安装"听力训练"插件
  → 插件注册 aiTools: [play_listening, check_pronunciation, ...]
    → AI 助手自动获得听力训练相关能力
      → 教师说"给学生布置听力作业"时，AI 就知道调用这些 Tools
```

**这是 EduForge 最像 OpenClaw 的地方：安装插件 = 赋予 AI 新技能。**

### 插件市场与 AI 的交互

```
教师：有没有适合练习英语口语的插件？

AI：在插件市场找到 3 个相关插件：
    
    1. 🗣️ 口语对话练习 v1.2（⭐4.8，500+ 安装）
       AI 模拟场景对话，纠正发音
       
    2. 🎧 听力精练 v2.0（⭐4.5，300+ 安装）
       分级听力材料 + AI 评测
       
    3. 📖 英语绘本阅读 v1.0（⭐4.2，100+ 安装）
       AI 互动式绘本，适合低年级
    
    要安装哪个？

教师：安装第一个

AI：[学校模式] 已提交安装申请，等待管理员审批。
    [个人模式] ✅ 已安装"口语对话练习"插件，现在可以说"给学生布置口语练习"了。
```

---

## 五、技术架构（决策 Q4 — 自建 Agent）

### 选择：自建 Agent + 预留 OpenClaw 对接口

**理由：**
- 教育场景的权限控制、确认机制比通用 Agent 更严格，自建更可控
- Tool Calling 是标准协议，DeepSeek/通义/OpenAI 都支持，不难实现
- 预留标准接口，未来可作为 OpenClaw 的一组 Skills 对接

### 架构图

```
┌─ 前端 ───────────────────────────────────┐
│                                          │
│  ┌──────────┐  ┌──────────────────────┐  │
│  │ Dashboard │  │   AI 对话界面        │  │
│  │ (传统UI)  │  │   (主入口)          │  │
│  └─────┬────┘  └──────────┬───────────┘  │
│        │                  │              │
│        │     WebSocket / SSE (流式)       │
└────────┼──────────────────┼──────────────┘
         │                  │
┌─ 后端 ─┼──────────────────┼──────────────┐
│        │                  │              │
│  ┌─────┴────┐   ┌────────┴──────────┐   │
│  │ REST API  │   │   Agent 引擎      │   │
│  │ (现有)    │   │                   │   │
│  └─────┬────┘   │  对话管理          │   │
│        │        │  Tool 注册/调度     │   │
│        │        │  权限检查          │   │
│        │        │  确认机制          │   │
│        │        │  上下文管理        │   │
│        │        └───────┬───────────┘   │
│        │                │               │
│        │         Tool Calling           │
│        │                │               │
│  ┌─────┴────────────────┴───────────┐   │
│  │         插件 Tool Registry        │   │
│  │                                   │   │
│  │  ┌─────┐ ┌─────┐ ┌──────┐       │   │
│  │  │题库 │ │作业 │ │AI批改│ ...   │   │
│  │  └─────┘ └─────┘ └──────┘       │   │
│  └──────────────────────────────────┘   │
│                    │                     │
│              ┌─────┴─────┐              │
│              │  AI 网关   │              │
│              │ (多模型)   │              │
│              └───────────┘              │
│                    │                     │
│              PostgreSQL                  │
└──────────────────────────────────────────┘
```

### 核心模块

#### 1. Agent 引擎 (`packages/core/src/agent/`)

```
agent/
├── engine.ts          # Agent 核心：对话循环 + Tool Calling
├── context.ts         # 上下文管理（对话历史、用户信息、权限）
├── tool-registry.ts   # Tool 注册表（从插件收集）
├── permissions.ts     # 权限检查（角色 × Tool × 确认级别）
├── confirm.ts         # 确认机制（pending 队列）
└── session.ts         # 会话管理（WebSocket 连接）
```

#### 2. 对话流程

```
用户消息
  → 上下文组装（用户角色 + 可用 Tools + 对话历史）
    → AI 模型（Tool Calling）
      → 返回 Tool 调用意图
        → 权限检查（角色是否有权限？）
          → [查询类] 直接执行 → 返回结果 → AI 组织回复
          → [修改类] 生成确认卡片 → 等待用户确认 → 执行 → 返回结果
          → [审批类] 创建审批单 → 通知管理员 → 等待审批
```

#### 3. 流式响应

对话使用 SSE (Server-Sent Events) 流式输出：
- AI 文本：逐字流式
- Tool 调用：显示"正在查询..."状态
- 确认卡片：structured message
- 执行结果：inline 展示

---

## 六、数据模型扩展

```sql
-- AI 对话会话
CREATE TABLE ai_chat_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "User"(id),
  title TEXT,                    -- 自动生成的会话标题
  context JSONB,                 -- 会话上下文（班级、学科等）
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 对话消息
CREATE TABLE ai_chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES ai_chat_sessions(id),
  role TEXT NOT NULL,            -- user / assistant / tool
  content TEXT,
  tool_calls JSONB,             -- AI 发起的 tool 调用
  tool_result JSONB,            -- tool 执行结果
  metadata JSONB,               -- 模型、tokens 等
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 待确认操作
CREATE TABLE ai_pending_actions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  parameters JSONB NOT NULL,
  preview TEXT,                  -- AI 生成的操作预览描述
  status TEXT DEFAULT 'PENDING', -- PENDING / CONFIRMED / CANCELLED / EXPIRED
  resolved_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 插件 AI Tools 注册表（运行时动态）
CREATE TABLE plugin_ai_tools (
  id TEXT PRIMARY KEY,
  plugin_name TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  description TEXT,
  parameters JSONB,
  confirm_required BOOLEAN DEFAULT false,
  allowed_roles TEXT[],
  created_at TIMESTAMPTZ DEFAULT now()
);

-- AI 配置层级
ALTER TABLE "AIConfig" ADD COLUMN IF NOT EXISTS 
  layer TEXT DEFAULT 'school';   -- platform / school / personal
ALTER TABLE "AIConfig" ADD COLUMN IF NOT EXISTS 
  user_id TEXT;                  -- 个人级配置关联用户
ALTER TABLE "AIConfig" ADD COLUMN IF NOT EXISTS 
  task_type TEXT;                -- 任务类型（chat/grading/generation/tutoring）
ALTER TABLE "AIConfig" ADD COLUMN IF NOT EXISTS
  monthly_quota INT;             -- 月度 token 配额
ALTER TABLE "AIConfig" ADD COLUMN IF NOT EXISTS
  used_quota INT DEFAULT 0;      -- 已用配额
```

---

## 七、插件 SDK 扩展

```typescript
// packages/sdk/src/index.ts 新增

export interface AITool {
  /** Tool 名称，全局唯一（建议 pluginName:toolName） */
  name: string;
  /** 自然语言描述，AI 靠这个理解何时调用 */
  description: string;
  /** JSON Schema 参数定义 */
  parameters: Record<string, ToolParameter>;
  /** 是否需要用户确认 */
  confirmRequired?: boolean;
  /** 允许调用的角色 */
  roles?: ('TEACHER' | 'STUDENT' | 'ADMIN')[];
  /** 执行函数 */
  execute: (params: any, context: ToolContext) => Promise<any>;
  /** 生成确认预览（confirmRequired=true 时） */
  preview?: (params: any, context: ToolContext) => Promise<string>;
}

export interface ToolContext {
  userId: string;
  role: string;
  schoolId?: string;
  prisma: PrismaClient;
  logger: Logger;
}

export interface EduPlugin {
  name: string;
  version: string;
  // ... 现有字段
  
  /** 插件暴露给 AI 助手的 Tools */
  aiTools?: AITool[];
}
```

---

## 八、实现路线

### Sprint 1（第 1 周）：基础 Agent

- [ ] `packages/core/src/agent/engine.ts` — 对话循环 + DeepSeek Tool Calling
- [ ] `packages/core/src/agent/tool-registry.ts` — 从插件收集 Tools
- [ ] `packages/core/src/agent/session.ts` — SSE 流式输出
- [ ] 后端路由：`POST /api/chat`, `GET /api/chat/stream`（SSE）
- [ ] 前端对话组件：气泡列表 + 输入框 + 流式渲染
- [ ] 3 个基础 Tools：`query_questions`, `query_assignments`, `query_analytics`

### Sprint 2（第 2 周）：确认机制 + 核心 Tools

- [ ] 确认机制（pending action → 确认/取消）
- [ ] 修改类 Tools：`generate_questions`, `create_assignment`
- [ ] 权限系统（角色 × Tool）
- [ ] AI 配置层级实现（四层覆盖）
- [ ] 对话历史持久化

### Sprint 3（第 3 周）：学生助手 + 插件市场

- [ ] 学生 AI 助手（限制 Tools + 辅导模式）
- [ ] 插件 SDK 扩展（aiTools 声明）
- [ ] 插件市场查询 Tool
- [ ] 插件安装审批流程

---

*本文档为 EduForge AI 助手的确定方案，实现过程中如有调整请同步更新。*
