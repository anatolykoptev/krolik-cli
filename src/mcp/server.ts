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

import type { ResolvedConfig } from '../types';
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
   */
  handleRequest(message: MCPMessage): MCPMessage {
    const response: MCPMessage = { jsonrpc: '2.0' };
    if (message.id !== undefined) {
      response.id = message.id;
    }

    try {
      response.result = this.routeMethod(message.method, message.params);
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
   */
  private routeMethod(method: string | undefined, params: unknown): MCPResult {
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
   */
  private processMessage(message: MCPMessage, onResponse: (response: MCPMessage) => void): void {
    // Guard: ignore notification messages
    if (message.method?.startsWith('notifications/')) {
      return;
    }

    const response = this.handleRequest(message);

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
        this.processMessage(message, (response) => {
          console.log(JSON.stringify(response));
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

// Tools are now exported from ./tools/index
