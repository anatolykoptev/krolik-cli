/**
 * @module mcp
 * @description MCP (Model Context Protocol) server module
 *
 * Provides integration with Claude Code and other MCP-compatible clients.
 */

export { MCPServer, startMCPServer } from './server';
export { ALL_TOOLS as TOOLS } from './tools';
export type { MCPMessage, MCPResource, MCPResult, MCPTool } from './types';
export { MCP_ERROR_CODE } from './types';
