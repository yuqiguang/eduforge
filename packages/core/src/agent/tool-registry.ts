import { PrismaClient } from '@prisma/client';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>; // JSON Schema
  confirmRequired?: boolean;
  roles: string[];
  execute: (params: any, context: ToolContext) => Promise<any>;
}

export interface ToolContext {
  userId: string;
  role: string;
  schoolId?: string;
  sessionId: string;
  prisma: PrismaClient;
}

const tools = new Map<string, ToolDefinition>();

export function registerTool(tool: ToolDefinition) {
  tools.set(tool.name, tool);
}

export function getTools(role: string): ToolDefinition[] {
  return Array.from(tools.values()).filter(t => t.roles.includes(role));
}

export function getTool(name: string): ToolDefinition | undefined {
  return tools.get(name);
}

export function getToolsAsOpenAIFormat(role: string) {
  return getTools(role).map(t => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

export async function executeTool(name: string, params: any, context: ToolContext): Promise<any> {
  const tool = tools.get(name);
  if (!tool) throw new Error(`Tool not found: ${name}`);
  if (!tool.roles.includes(context.role)) throw new Error(`Permission denied for tool: ${name}`);
  return tool.execute(params, context);
}
