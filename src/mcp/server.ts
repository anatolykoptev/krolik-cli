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

import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';

import type { ResolvedConfig } from '../types';

// ============================================================================
// MCP PROTOCOL TYPES
// ============================================================================

interface MCPMessage {
  jsonrpc: '2.0';
  id?: number | string;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required?: string[];
  };
}

interface MCPResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

// ============================================================================
// TOOLS DEFINITIONS
// ============================================================================

const TOOLS: MCPTool[] = [
  {
    name: 'krolik_status',
    description:
      'Get project diagnostics: git status, typecheck, lint, TODOs. Use this to understand the current state of the project.',
    inputSchema: {
      type: 'object',
      properties: {
        fast: {
          type: 'boolean',
          description: 'Skip slow checks (typecheck, lint) for faster response',
        },
      },
    },
  },
  {
    name: 'krolik_context',
    description:
      'Generate AI-friendly context for a specific task or feature. Returns structured XML with schema, routes, git info, and approach steps.',
    inputSchema: {
      type: 'object',
      properties: {
        feature: {
          type: 'string',
          description: 'The feature or task to analyze (e.g., "booking", "auth", "CRM")',
        },
        issue: {
          type: 'string',
          description: 'GitHub issue number to get context for',
        },
      },
    },
  },
  {
    name: 'krolik_schema',
    description: 'Analyze Prisma database schema. Returns all models, fields, relations, and enums.',
    inputSchema: {
      type: 'object',
      properties: {
        json: {
          type: 'boolean',
          description: 'Return JSON format instead of markdown',
        },
      },
    },
  },
  {
    name: 'krolik_routes',
    description:
      'Analyze tRPC API routes. Returns all procedures with types, inputs, and protection status.',
    inputSchema: {
      type: 'object',
      properties: {
        json: {
          type: 'boolean',
          description: 'Return JSON format instead of markdown',
        },
      },
    },
  },
  {
    name: 'krolik_review',
    description:
      'Review code changes. Analyzes git diff for security issues, performance problems, and risks.',
    inputSchema: {
      type: 'object',
      properties: {
        staged: {
          type: 'boolean',
          description: 'Review only staged changes',
        },
        pr: {
          type: 'string',
          description: 'Review specific PR number',
        },
      },
    },
  },
  {
    name: 'krolik_issue',
    description: 'Parse a GitHub issue and extract context: checklist, mentioned files, priority.',
    inputSchema: {
      type: 'object',
      properties: {
        number: {
          type: 'string',
          description: 'GitHub issue number',
        },
      },
      required: ['number'],
    },
  },
];

// ============================================================================
// RESOURCES DEFINITIONS
// ============================================================================

function getResources(projectRoot: string): MCPResource[] {
  const resources: MCPResource[] = [];

  if (fs.existsSync(path.join(projectRoot, 'CLAUDE.md'))) {
    resources.push({
      uri: 'krolik://project/claude-md',
      name: 'Project Rules (CLAUDE.md)',
      description: 'Instructions and rules for AI agents working on this project',
      mimeType: 'text/markdown',
    });
  }

  if (fs.existsSync(path.join(projectRoot, 'README.md'))) {
    resources.push({
      uri: 'krolik://project/readme',
      name: 'README',
      description: 'Project documentation and setup instructions',
      mimeType: 'text/markdown',
    });
  }

  if (fs.existsSync(path.join(projectRoot, 'package.json'))) {
    resources.push({
      uri: 'krolik://project/package-json',
      name: 'Package.json',
      description: 'Project dependencies and scripts',
      mimeType: 'application/json',
    });
  }

  return resources;
}

// ============================================================================
// TOOL IMPLEMENTATIONS
// ============================================================================

function runKrolik(args: string, projectRoot: string, timeout = 30000): string {
  try {
    const output = execSync(`npx krolik ${args}`, {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return output;
  } catch (error: unknown) {
    const err = error as { stdout?: string; stderr?: string; message?: string };
    return err.stdout || err.stderr || err.message || 'Unknown error';
  }
}

function runTool(name: string, args: Record<string, unknown>, projectRoot: string): string {
  switch (name) {
    case 'krolik_status': {
      const flags = args.fast ? '--fast' : '';
      return runKrolik(`status ${flags}`, projectRoot);
    }

    case 'krolik_context': {
      let flags = '--ai';
      if (args.feature) flags += ` --feature="${args.feature}"`;
      if (args.issue) flags += ` --issue=${args.issue}`;
      return runKrolik(`context ${flags}`, projectRoot);
    }

    case 'krolik_schema': {
      const flags = args.json ? '--json' : '';
      return runKrolik(`schema ${flags}`, projectRoot);
    }

    case 'krolik_routes': {
      const flags = args.json ? '--json' : '';
      return runKrolik(`routes ${flags}`, projectRoot);
    }

    case 'krolik_review': {
      let flags = '';
      if (args.staged) flags += ' --staged';
      if (args.pr) flags += ` --pr=${args.pr}`;
      return runKrolik(`review ${flags}`, projectRoot, 60000);
    }

    case 'krolik_issue': {
      return runKrolik(`issue ${args.number}`, projectRoot);
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ============================================================================
// RESOURCE IMPLEMENTATIONS
// ============================================================================

function getResource(uri: string, projectRoot: string): { content: string; mimeType: string } | null {
  switch (uri) {
    case 'krolik://project/claude-md': {
      const filePath = path.join(projectRoot, 'CLAUDE.md');
      if (fs.existsSync(filePath)) {
        return { content: fs.readFileSync(filePath, 'utf-8'), mimeType: 'text/markdown' };
      }
      return null;
    }

    case 'krolik://project/readme': {
      const filePath = path.join(projectRoot, 'README.md');
      if (fs.existsSync(filePath)) {
        return { content: fs.readFileSync(filePath, 'utf-8'), mimeType: 'text/markdown' };
      }
      return null;
    }

    case 'krolik://project/package-json': {
      const filePath = path.join(projectRoot, 'package.json');
      if (fs.existsSync(filePath)) {
        return { content: fs.readFileSync(filePath, 'utf-8'), mimeType: 'application/json' };
      }
      return null;
    }

    default:
      return null;
  }
}

// ============================================================================
// MCP SERVER CLASS
// ============================================================================

export class MCPServer {
  private projectRoot: string;

  constructor(config: ResolvedConfig) {
    this.projectRoot = config.projectRoot;
  }

  handleRequest(message: MCPMessage): MCPMessage {
    const response: MCPMessage = {
      jsonrpc: '2.0',
    };
    if (message.id !== undefined) {
      response.id = message.id;
    }

    try {
      switch (message.method) {
        case 'initialize':
          response.result = {
            protocolVersion: '2024-11-05',
            serverInfo: { name: 'krolik', version: '1.0.0' },
            capabilities: { tools: {}, resources: {} },
          };
          break;

        case 'tools/list':
          response.result = { tools: TOOLS };
          break;

        case 'tools/call': {
          const params = message.params as { name: string; arguments?: Record<string, unknown> };
          const args = params.arguments || {};
          const result = runTool(params.name, args, this.projectRoot);
          response.result = { content: [{ type: 'text', text: result }] };
          break;
        }

        case 'resources/list':
          response.result = { resources: getResources(this.projectRoot) };
          break;

        case 'resources/read': {
          const params = message.params as { uri: string };
          const resource = getResource(params.uri, this.projectRoot);
          if (!resource) {
            throw new Error(`Resource not found: ${params.uri}`);
          }
          response.result = {
            contents: [{ uri: params.uri, mimeType: resource.mimeType, text: resource.content }],
          };
          break;
        }

        case 'notifications/initialized':
          return response;

        default:
          response.error = { code: -32601, message: `Method not found: ${message.method}` };
      }
    } catch (error: unknown) {
      const err = error as { message?: string };
      response.error = { code: -32603, message: err.message || 'Unknown error' };
    }

    return response;
  }

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

        const response = this.handleRequest(message);

        if (message.method?.startsWith('notifications/')) {
          return;
        }

        if (response.id !== undefined) {
          console.log(JSON.stringify(response));
        }
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

export async function startMCPServer(config: ResolvedConfig): Promise<MCPServer> {
  const server = new MCPServer(config);
  await server.start();
  return server;
}

export { TOOLS };
