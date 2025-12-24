/**
 * @module mcp/tools/types
 * @description Type definitions for MCP tools with co-located handlers
 */

/**
 * Handler function signature
 */
export type ToolHandler = (
  args: Record<string, unknown>,
  workspaceRoot: string,
) => string;

/**
 * JSON Schema property definition
 */
export interface SchemaProperty {
  type: string;
  description: string;
  enum?: string[];
}

/**
 * MCP Tool definition with co-located handler
 * Single source of truth: schema + handler in one object
 */
export interface MCPToolDefinition {
  /** Tool name (e.g., 'krolik_status') */
  name: string;
  /** Tool description for AI */
  description: string;
  /** JSON Schema for input validation */
  inputSchema: {
    type: 'object';
    properties: Record<string, SchemaProperty>;
    required?: string[];
  };
  /** Handler function */
  handler: ToolHandler;
}

/**
 * MCP Tool without handler (for protocol responses)
 */
export type MCPTool = Omit<MCPToolDefinition, 'handler'>;
