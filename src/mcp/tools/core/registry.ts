/**
 * @module mcp/tools/registry
 * @description Auto-discovering tool registry - zero-config tool registration!
 *
 * How it works:
 * 1. Create a new tool file: src/mcp/tools/my-tool.ts
 * 2. Export MCPToolDefinition and call registerTool()
 * 3. Run: pnpm generate:tools (or happens automatically on build)
 * 4. Your tool is automatically discovered and registered!
 *
 * Benefits:
 * - Adding a new tool requires ONLY creating the file
 * - NO manual imports needed
 * - NO registration calls in index.ts
 * - Type-safe and explicit
 * - Automatic discovery at build time
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
 * Supports both sync and async handlers
 */
export function runTool(
  name: string,
  args: Record<string, unknown>,
  projectRoot: string,
): string | Promise<string> {
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
