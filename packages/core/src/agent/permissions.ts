import { getTool } from './tool-registry.js';

export function canUseTool(role: string, toolName: string): boolean {
  const tool = getTool(toolName);
  if (!tool) return false;
  return tool.roles.includes(role);
}
