/**
 * @module mcp/server
 * @description MCP (Model Context Protocol) server for Claude Code integration
 *
 * Setup in Claude Code:
 *   claude mcp add krolik -- npx krolik mcp
 *
 * Or add to .claude/settings.json:
 *   {
 *     "mcpServers": {
 *       "krolik": {
 *         "command": "npx",
 *         "args": ["krolik", "mcp"],
 *         "cwd": "/path/to/your/project"
 *       }
 *     }
 *   }
 */

import * as readline from 'node:readline';

import { preloadEmbeddingPool } from '../lib/@storage/memory/embedding-pool';
import type { ResolvedConfig } from '../types/config';
import {
  handleInitialize,
  handleResourcesList,
  handleResourcesRead,
  handleToolsCall,
  handleToolsList,
} from './handlers';
import type { MCPMessage, MCPResult } from './types';
import { MCP_ERROR_CODE } from './types';

// ============================================================================
// MCP SERVER CLASS
// ============================================================================

/**
 * MCP Server for krolik CLI
 *
 * Handles JSON-RPC communication with Claude Code via stdin/stdout
 */
export class MCPServer {
  private projectRoot: string;

  constructor(config: ResolvedConfig) {
    this.projectRoot = config.projectRoot;
  }

  /**
   * Handle MCP request message
   * Supports async handlers for tools/call
   */
  async handleRequest(message: MCPMessage): Promise<MCPMessage> {
    const response: MCPMessage = { jsonrpc: '2.0' };
    if (message.id !== undefined) {
      response.id = message.id;
    }

    try {
      response.result = await this.routeMethod(message.method, message.params);
    } catch (error: unknown) {
      const err = error as { message?: string };
      response.error = {
        code: -MCP_ERROR_CODE,
        message: err.message || 'Unknown error',
      };
    }

    return response;
  }

  /**
   * Route method to appropriate handler
   * Returns Promise for tools/call (async), MCPResult for others
   */
  private routeMethod(method: string | undefined, params: unknown): MCPResult | Promise<MCPResult> {
    switch (method) {
      case 'initialize':
        return handleInitialize();
      case 'tools/list':
        return handleToolsList();
      case 'tools/call':
        return handleToolsCall(params, this.projectRoot);
      case 'resources/list':
        return handleResourcesList(this.projectRoot);
      case 'resources/read':
        return handleResourcesRead(params, this.projectRoot);
      case 'notifications/initialized':
        return undefined;
      default:
        throw new Error(`Method not found: ${method}`);
    }
  }

  /**
   * Process a complete JSON-RPC message
   * Handles async tool calls properly
   */
  private async processMessage(
    message: MCPMessage,
    onResponse: (response: MCPMessage) => void,
  ): Promise<void> {
    // Guard: ignore notification messages
    if (message.method?.startsWith('notifications/')) {
      return;
    }

    const response = await this.handleRequest(message);

    // Guard: only send response if message has ID
    if (response.id === undefined) {
      return;
    }

    onResponse(response);
  }

  /**
   * Start the MCP server
   *
   * Listens for JSON-RPC messages on stdin and responds on stdout
   */
  async start(): Promise<void> {
    // Preload embedding model in background (non-blocking)
    // This starts worker thread and loads model while server handles other requests
    preloadEmbeddingPool();

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });

    let buffer = '';

    rl.on('line', (line) => {
      buffer += line;

      try {
        const message = JSON.parse(buffer) as MCPMessage;
        buffer = '';
        // Handle async processMessage with proper error handling
        this.processMessage(message, (response) => {
          console.log(JSON.stringify(response));
        }).catch((e) => {
          process.stderr.write(`Error processing message: ${e}\n`);
        });
      } catch (e) {
        if (!(e instanceof SyntaxError)) {
          process.stderr.write(`Error: ${e}\n`);
        }
      }
    });

    rl.on('close', () => {
      process.exit(0);
    });
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Start MCP server with given config
 *
 * @param config - Resolved krolik configuration
 * @returns Started MCP server instance
 */
export async function startMCPServer(config: ResolvedConfig): Promise<MCPServer> {
  const server = new MCPServer(config);
  await server.start();
  return server;
}

// Re-export tools for backward compatibility
// Import triggers side-effect registrations in ./tools/index.ts
import { getToolDefinitions } from './tools';

/**
 * All registered MCP tools (for testing and introspection)
 */
export const TOOLS = getToolDefinitions();
