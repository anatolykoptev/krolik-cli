/**
 * @module mcp/tools
 * @description MCP tools barrel export
 *
 * Adding a new tool:
 * 1. Create tools/my-tool.ts with MCPToolDefinition
 * 2. Add export here
 * 3. Add to ALL_TOOLS array
 * That's it! No other files need modification.
 */

// Tool exports
export { statusTool } from './status';
export { contextTool } from './context';
export { schemaTool } from './schema';
export { routesTool } from './routes';
export { reviewTool } from './review';
export { issueTool } from './issue';
export { auditTool } from './audit';
export { fixTool } from './fix';
export { refactorTool } from './refactor';

// Type exports
export type { MCPToolDefinition, MCPTool, ToolHandler, SchemaProperty } from './types';

// Import for ALL_TOOLS array
import { statusTool } from './status';
import { contextTool } from './context';
import { schemaTool } from './schema';
import { routesTool } from './routes';
import { reviewTool } from './review';
import { issueTool } from './issue';
import { auditTool } from './audit';
import { fixTool } from './fix';
import { refactorTool } from './refactor';
import type { MCPToolDefinition, MCPTool } from './types';

/**
 * All available MCP tools (Single Source of Truth)
 */
export const ALL_TOOLS: readonly MCPToolDefinition[] = [
  statusTool,
  contextTool,
  schemaTool,
  routesTool,
  reviewTool,
  issueTool,
  auditTool,
  fixTool,
  refactorTool,
] as const;

/**
 * Get tool definitions for MCP protocol (without handlers)
 */
export function getToolDefinitions(): MCPTool[] {
  return ALL_TOOLS.map(({ name, description, inputSchema }) => ({
    name,
    description,
    inputSchema,
  }));
}

/**
 * Build handler registry from tools
 */
export function buildHandlerRegistry(): Record<string, MCPToolDefinition['handler']> {
  const registry: Record<string, MCPToolDefinition['handler']> = {};
  for (const tool of ALL_TOOLS) {
    registry[tool.name] = tool.handler;
  }
  return registry;
}

/**
 * Run a tool by name
 */
export function runTool(
  name: string,
  args: Record<string, unknown>,
  projectRoot: string,
): string {
  const tool = ALL_TOOLS.find((t) => t.name === name);
  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }
  return tool.handler(args, projectRoot);
}

/**
 * Check if a tool name is valid
 */
export function isValidTool(name: string): boolean {
  return ALL_TOOLS.some((t) => t.name === name);
}

/**
 * Get list of all tool names
 */
export function getToolNames(): string[] {
  return ALL_TOOLS.map((t) => t.name);
}
