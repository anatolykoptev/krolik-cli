/**
 * @module mcp
 * @description MCP (Model Context Protocol) server module
 *
 * Provides integration with Claude Code and other MCP-compatible clients.
 */

export { MCPServer, startMCPServer, TOOLS } from './server';
export type { MCPMessage, MCPTool, MCPResource, MCPResult } from './types';
export { MCP_ERROR_CODE } from './types';
