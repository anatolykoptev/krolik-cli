/**
 * @module mcp/tools/types
 * @description Type definitions for MCP tools with co-located handlers
 */

/**
 * Handler function signature
 */
export type ToolHandler = (args: Record<string, unknown>, workspaceRoot: string) => string;

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
  /** Template config for CLAUDE.md auto-generation */
  template?: {
    /** When to use (e.g., "Session start") — shown in "When" column */
    when: string;
    /** Example params (e.g., "`fast: true`") — shown in "Params" column */
    params: string;
    /** Exclude from template (default: false) */
    exclude?: boolean;
  };
  /** Workflow trigger for auto-execution hints */
  workflow?: {
    /** Trigger event */
    trigger:
      | 'session_start'
      | 'before_task'
      | 'after_code'
      | 'before_commit'
      | 'on_decision'
      | 'on_bugfix'
      | 'on_refactor';
    /** Execution order within same trigger (lower = first) */
    order?: number;
  };
  /** Category for grouping in docs */
  category?: 'start' | 'context' | 'code' | 'memory' | 'advanced';
}

/**
 * MCP Tool without handler (for protocol responses)
 */
export type MCPTool = Omit<MCPToolDefinition, 'handler'>;
