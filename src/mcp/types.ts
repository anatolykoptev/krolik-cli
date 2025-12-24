/**
 * @module mcp/types
 * @description MCP (Model Context Protocol) type definitions
 */

/**
 * MCP JSON-RPC message structure
 */
export interface MCPMessage {
  jsonrpc: "2.0";
  id?: number | string;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

/**
 * MCP Tool definition
 */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<
      string,
      { type: string; description: string; enum?: string[] }
    >;
    required?: string[];
  };
}

/**
 * MCP Resource definition
 */
export interface MCPResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

/**
 * Result type for MCP handlers
 */
export type MCPResult = MCPMessage['result'];

/**
 * MCP error codes
 */
export const MCP_ERROR_CODE = 32601;
