// OpenAI 兼容 provider（同时支持通义千问、DeepSeek 等兼容接口）

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AICompletionOptions {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface AICompletionResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

// 各提供商默认 Base URL
const PROVIDER_URLS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  deepseek: 'https://api.deepseek.com/v1',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4',
  doubao: 'https://ark.cn-beijing.volces.com/api/v3',
  ollama: 'http://localhost:11434/v1',
};

// Tool-calling + streaming support
export interface AIToolCallOptions {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
  messages: any[];
  tools?: any[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export async function openaiChatWithTools(options: AIToolCallOptions): Promise<Response> {
  const baseUrl = options.baseUrl || PROVIDER_URLS[options.provider] || PROVIDER_URLS.openai;

  const body: any = {
    model: options.model,
    messages: options.messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens,
  };
  if (options.tools?.length) body.tools = options.tools;
  if (options.stream) body.stream = true;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AI 请求失败 (${response.status}): ${error}`);
  }

  return response;
}

export async function openaiComplete(options: AICompletionOptions): Promise<AICompletionResult> {
  const baseUrl = options.baseUrl || PROVIDER_URLS[options.provider] || PROVIDER_URLS.openai;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify({
      model: options.model,
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AI 请求失败 (${response.status}): ${error}`);
  }

  const data = await response.json() as any;
  const choice = data.choices?.[0];

  return {
    content: choice?.message?.content || '',
    inputTokens: data.usage?.prompt_tokens || 0,
    outputTokens: data.usage?.completion_tokens || 0,
    model: data.model || options.model,
  };
}
