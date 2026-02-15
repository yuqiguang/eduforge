import { PrismaClient } from '@prisma/client';
import { openaiChatWithTools } from '../ai-gateway/providers/openai.js';
import { getToolsAsOpenAIFormat, executeTool, getTool, type ToolContext } from './tool-registry.js';
import { createSession, getSession, saveMessage, loadMessages } from './session.js';
import { canUseTool } from './permissions.js';

function buildSystemPrompt(user: { name?: string; role: string }) {
  const name = user.name || '用户';
  const role = user.role;
  return `你是 EduForge AI 教学助手。
当前用户：${name}（角色：${role}）

你可以使用提供的工具来完成任务。请注意：
- 查询类工具（query_*）可以直接调用，结果会立即返回
- 修改类工具（generate_questions、create_assignment 等）也请直接调用，系统会自动弹出确认对话框让用户确认
- 不要自己描述确认流程，直接调用工具即可
- 回复使用中文
- 如果用户问的问题不需要工具，直接回答即可`;
}

async function getAIConfig(prisma: PrismaClient, schoolId?: string) {
  let config: any = null;
  if (schoolId) {
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT * FROM "AIConfig" WHERE "schoolId" = $1 LIMIT 1`, schoolId
    );
    config = rows[0];
  }
  if (!config) {
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT * FROM "AIConfig" WHERE "isDefault" = true LIMIT 1`
    );
    config = rows[0];
  }
  if (!config) throw new Error('未配置 AI 服务，请在管理后台设置');
  return config;
}

export interface ChatRequest {
  message: string;
  sessionId?: string;
}

export async function chat(
  prisma: PrismaClient,
  user: { userId: string; name?: string; role: string; schoolId?: string },
  req: ChatRequest
): Promise<{ sessionId: string; reply: string; pendingAction?: any }> {
  const config = await getAIConfig(prisma, user.schoolId);
  
  // Get or create session
  let sessionId: string;
  if (!req.sessionId) {
    const session = await createSession(prisma, user.userId, req.message.slice(0, 50));
    sessionId = session.id;
  } else {
    sessionId = req.sessionId;
    const session = await getSession(prisma, sessionId, user.userId);
    if (!session) throw new Error('会话不存在');
  }

  // Save user message
  await saveMessage(prisma, { sessionId, role: 'user', content: req.message });

  // Load history
  const historyRows: any[] = await loadMessages(prisma, sessionId, 20) as any;
  const history = historyRows.reverse().map((m: any) => {
    const msg: any = { role: m.role, content: m.content || '' };
    if (m.tool_calls) msg.tool_calls = typeof m.tool_calls === 'string' ? JSON.parse(m.tool_calls) : m.tool_calls;
    if (m.role === 'tool' && m.tool_result) {
      msg.content = typeof m.tool_result === 'string' ? m.tool_result : JSON.stringify(m.tool_result);
      msg.tool_call_id = (typeof m.metadata === 'string' ? JSON.parse(m.metadata) : m.metadata)?.tool_call_id;
    }
    return msg;
  });

  const messages = [
    { role: 'system', content: buildSystemPrompt(user) },
    ...history,
  ];

  const tools = getToolsAsOpenAIFormat(user.role);
  const toolCtx: ToolContext = { userId: user.userId, role: user.role, schoolId: user.schoolId, sessionId, prisma };

  // Agent loop (max 5 iterations)
  for (let i = 0; i < 5; i++) {
    const resp = await openaiChatWithTools({
      provider: config.provider,
      model: config.model,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl ?? undefined,
      messages,
      tools: tools.length > 0 ? tools : undefined,
      temperature: 0.7,
    });

    const data = await resp.json() as any;
    const choice = data.choices?.[0];
    const assistantMsg = choice?.message;

    if (!assistantMsg) throw new Error('AI 返回为空');

    // Save assistant message
    await saveMessage(prisma, {
      sessionId,
      role: 'assistant',
      content: assistantMsg.content || null,
      toolCalls: assistantMsg.tool_calls || null,
    });

    if (!assistantMsg.tool_calls?.length) {
      return { sessionId, reply: assistantMsg.content || '' };
    }

    // Process tool calls
    messages.push(assistantMsg);

    for (const tc of assistantMsg.tool_calls) {
      const toolName = tc.function.name;
      const params = JSON.parse(tc.function.arguments || '{}');
      const toolDef = getTool(toolName);

      if (!canUseTool(user.role, toolName)) {
        const errResult = JSON.stringify({ error: '权限不足' });
        messages.push({ role: 'tool', tool_call_id: tc.id, content: errResult });
        await saveMessage(prisma, { sessionId, role: 'tool', toolResult: errResult, metadata: { tool_call_id: tc.id } });
        continue;
      }

      // Check if confirm required
      if (toolDef?.confirmRequired) {
        const preview = `将执行「${toolDef.description}」，参数：${JSON.stringify(params)}`;
        const rows: any[] = await prisma.$queryRawUnsafe(
          `INSERT INTO ai_pending_actions (session_id, user_id, tool_name, parameters, preview) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          sessionId, user.userId, toolName, JSON.stringify(params), preview
        );
        const pending = rows[0];
        const toolResult = JSON.stringify({ status: 'PENDING_CONFIRMATION', actionId: pending.id, preview });
        messages.push({ role: 'tool', tool_call_id: tc.id, content: toolResult });
        await saveMessage(prisma, { sessionId, role: 'tool', toolResult, metadata: { tool_call_id: tc.id } });
        // Return immediately with pending action info — don't let AI loop
        return {
          sessionId,
          reply: `操作需要确认：${preview}`,
          pendingAction: { actionId: pending.id, toolName, parameters: params, preview },
        };
      }

      try {
        const result = await executeTool(toolName, params, toolCtx);
        const resultStr = JSON.stringify(result);
        messages.push({ role: 'tool', tool_call_id: tc.id, content: resultStr });
        await saveMessage(prisma, { sessionId, role: 'tool', toolResult: result, metadata: { tool_call_id: tc.id } });
      } catch (err: any) {
        const errResult = JSON.stringify({ error: err.message });
        messages.push({ role: 'tool', tool_call_id: tc.id, content: errResult });
        await saveMessage(prisma, { sessionId, role: 'tool', toolResult: errResult, metadata: { tool_call_id: tc.id } });
      }
    }
    // Continue loop to let AI process tool results
  }

  return { sessionId, reply: '抱歉，处理超时，请重试。' };
}

// SSE streaming version
export async function chatStream(
  prisma: PrismaClient,
  user: { userId: string; name?: string; role: string; schoolId?: string },
  req: ChatRequest,
  send: (event: string, data: any) => void,
  close: () => void,
) {
  try {
    const config = await getAIConfig(prisma, user.schoolId);
    
    let sessionId: string;
    if (!req.sessionId) {
      const session = await createSession(prisma, user.userId, req.message.slice(0, 50));
      sessionId = session.id;
    } else {
      sessionId = req.sessionId;
      const session = await getSession(prisma, sessionId, user.userId);
      if (!session) { send('error', { error: '会话不存在' }); close(); return; }
    }

    send('session', { sessionId });
    await saveMessage(prisma, { sessionId, role: 'user', content: req.message });

    const historyRows: any[] = await loadMessages(prisma, sessionId, 20) as any;
    const history = historyRows.reverse().map((m: any) => {
      const msg: any = { role: m.role, content: m.content || '' };
      if (m.tool_calls) msg.tool_calls = typeof m.tool_calls === 'string' ? JSON.parse(m.tool_calls) : m.tool_calls;
      if (m.role === 'tool' && m.tool_result) {
        msg.content = typeof m.tool_result === 'string' ? m.tool_result : JSON.stringify(m.tool_result);
        msg.tool_call_id = (typeof m.metadata === 'string' ? JSON.parse(m.metadata) : m.metadata)?.tool_call_id;
      }
      return msg;
    });

    const messages = [{ role: 'system', content: buildSystemPrompt(user) }, ...history];
    const tools = getToolsAsOpenAIFormat(user.role);
    const toolCtx: ToolContext = { userId: user.userId, role: user.role, schoolId: user.schoolId, sessionId, prisma };

    for (let i = 0; i < 5; i++) {
      const resp = await openaiChatWithTools({
        provider: config.provider,
        model: config.model,
        apiKey: config.apiKey,
        baseUrl: config.baseUrl ?? undefined,
        messages,
        tools: tools.length > 0 ? tools : undefined,
        temperature: 0.7,
        stream: true,
      });

      // Parse SSE stream
      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';
      let toolCalls: any[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;
            if (!delta) continue;
            if (delta.content) {
              fullContent += delta.content;
              send('content', { text: delta.content });
            }
            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0;
                if (!toolCalls[idx]) toolCalls[idx] = { id: '', function: { name: '', arguments: '' } };
                if (tc.id) toolCalls[idx].id = tc.id;
                if (tc.function?.name) toolCalls[idx].function.name += tc.function.name;
                if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments;
              }
            }
          } catch {}
        }
      }

      // No tool calls — done
      if (toolCalls.length === 0) {
        await saveMessage(prisma, { sessionId, role: 'assistant', content: fullContent });
        send('done', { sessionId });
        close();
        return;
      }

      // Save assistant with tool_calls
      const assistantMsg: any = { role: 'assistant', content: fullContent || null, tool_calls: toolCalls };
      await saveMessage(prisma, { sessionId, role: 'assistant', content: fullContent || undefined, toolCalls });
      messages.push(assistantMsg);

      // Execute tools
      for (const tc of toolCalls) {
        const toolName = tc.function.name;
        const params = JSON.parse(tc.function.arguments || '{}');
        const toolDef = getTool(toolName);
        send('tool_call', { name: toolName, params });

        if (!canUseTool(user.role, toolName)) {
          const errResult = JSON.stringify({ error: '权限不足' });
          messages.push({ role: 'tool', tool_call_id: tc.id, content: errResult });
          await saveMessage(prisma, { sessionId, role: 'tool', toolResult: errResult, metadata: { tool_call_id: tc.id } });
          send('tool_result', { name: toolName, result: { error: '权限不足' } });
          continue;
        }

        if (toolDef?.confirmRequired) {
          const preview = `将执行「${toolDef.description}」，参数：${JSON.stringify(params)}`;
          const rows: any[] = await prisma.$queryRawUnsafe(
            `INSERT INTO ai_pending_actions (session_id, user_id, tool_name, parameters, preview) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            sessionId, user.userId, toolName, JSON.stringify(params), preview
          );
          const pending = rows[0];
          const result = { status: 'PENDING_CONFIRMATION', actionId: pending.id, preview };
          messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
          await saveMessage(prisma, { sessionId, role: 'tool', toolResult: result, metadata: { tool_call_id: tc.id } });
          // Send confirm event and stop
          send('confirm', { actionId: pending.id, toolName, parameters: params, preview });
          send('done', { sessionId });
          close();
          return;
        }

        try {
          const result = await executeTool(toolName, params, toolCtx);
          messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
          await saveMessage(prisma, { sessionId, role: 'tool', toolResult: result, metadata: { tool_call_id: tc.id } });
          send('tool_result', { name: toolName, result });
        } catch (err: any) {
          const errResult = { error: err.message };
          messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(errResult) });
          await saveMessage(prisma, { sessionId, role: 'tool', toolResult: errResult, metadata: { tool_call_id: tc.id } });
          send('tool_result', { name: toolName, result: errResult });
        }
      }
      // Loop continues to let AI respond after tool results
      toolCalls = [];
    }

    send('done', { sessionId });
    close();
  } catch (err: any) {
    send('error', { error: err.message });
    close();
  }
}
