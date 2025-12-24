/**
 * @module mcp/tools/registry
 * @description Self-registering tool registry - add a tool in one place only!
 *
 * Benefits:
 * - Adding a new tool requires only creating the tool file and one import line
 * - No need to modify multiple arrays or exports
 * - Type-safe and explicit
 */

import type { MCPTool, MCPToolDefinition } from './types';

/**
 * Internal registry of all tools
 */
const toolRegistry: MCPToolDefinition[] = [];

/**
 * Register a tool (called by each tool file on import)
 */
export function registerTool(tool: MCPToolDefinition): void {
  // Validate tool name is unique
  if (toolRegistry.some((t) => t.name === tool.name)) {
    throw new Error(`Tool "${tool.name}" is already registered`);
  }
  toolRegistry.push(tool);
}

/**
 * Get all registered tools (Single Source of Truth)
 */
export function getAllTools(): readonly MCPToolDefinition[] {
  return [...toolRegistry] as const;
}

/**
 * Get tool definitions for MCP protocol (without handlers)
 */
export function getToolDefinitions(): MCPTool[] {
  return toolRegistry.map(({ name, description, inputSchema }) => ({
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
  for (const tool of toolRegistry) {
    registry[tool.name] = tool.handler;
  }
  return registry;
}

/**
 * Run a tool by name
 */
export function runTool(name: string, args: Record<string, unknown>, projectRoot: string): string {
  const tool = toolRegistry.find((t) => t.name === name);
  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }
  return tool.handler(args, projectRoot);
}

/**
 * Check if a tool name is valid
 */
export function isValidTool(name: string): boolean {
  return toolRegistry.some((t) => t.name === name);
}

/**
 * Get list of all tool names
 */
export function getToolNames(): string[] {
  return toolRegistry.map((t) => t.name);
}
