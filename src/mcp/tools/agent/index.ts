/**
 * @module mcp/tools/agent
 * @description krolik_agent tool - Run specialized AI agents with orchestration support
 *
 * This tool provides two modes:
 * 1. Direct agent execution: Run a specific agent by name
 * 2. Orchestration mode: Analyze task and coordinate multiple agents
 *
 * When orchestrate=true, the tool acts as a multi-agent coordinator,
 * analyzing the user's task and creating an execution plan for multiple
 * specialized agents.
 */

import { withProjectDetection } from '../core/projects';
import { registerTool } from '../core/registry';
import { PROJECT_PROPERTY } from '../core/shared';
import type { MCPToolDefinition, SchemaProperty } from '../core/types';
import { runKrolik, TIMEOUT_60S, TIMEOUT_120S } from '../core/utils';

/**
 * Agent tool input schema
 */
const inputSchema: Record<string, SchemaProperty> = {
  ...PROJECT_PROPERTY,
  name: {
    type: 'string',
    description:
      'Agent name to run (e.g., "security-auditor", "backend-architect") or category name (e.g., "security", "quality")',
  },
  orchestrate: {
    type: 'boolean',
    description:
      'Enable orchestration mode. Analyzes the task and coordinates multiple specialized agents. Use when user says "use multi-agents" or "мультиагенты".',
  },
  task: {
    type: 'string',
    description:
      'Task description for orchestration mode (e.g., "analyze security and performance", "review code quality")',
  },
  category: {
    type: 'string',
    description:
      'Filter agents by category: security, performance, architecture, quality, debugging, docs, etc.',
  },
  file: {
    type: 'string',
    description: 'Target file for agent analysis',
  },
  feature: {
    type: 'string',
    description: 'Feature or domain to focus on (e.g., "booking", "auth", "CRM")',
  },
  list: {
    type: 'boolean',
    description: 'List all available agents',
  },
  maxAgents: {
    type: 'number',
    description: 'Maximum number of agents to run in orchestration mode (default: 5)',
  },
  parallel: {
    type: 'boolean',
    description: 'Prefer parallel execution of agents in orchestration mode',
  },
  dryRun: {
    type: 'boolean',
    description: 'Show orchestration plan without executing agents',
  },
};

/**
 * Build agent command with proper arguments
 */
function buildAgentCommand(args: Record<string, unknown>): string {
  const parts: string[] = ['agent'];

  // Add agent name as positional argument if provided and not orchestrating
  if (args.name && !args.orchestrate) {
    const name = String(args.name).replace(/[^a-zA-Z0-9_-]/g, '');
    parts.push(name);
  }

  // Add flags
  if (args.orchestrate) {
    parts.push('--orchestrate');
    if (args.task) {
      // Escape and quote the task
      const task = String(args.task).replace(/"/g, '\\"');
      parts.push(`--task "${task}"`);
    }
    if (args.maxAgents) {
      parts.push(`--max-agents ${Number(args.maxAgents)}`);
    }
    if (args.parallel) {
      parts.push('--parallel');
    }
  }

  if (args.category) {
    const category = String(args.category).replace(/[^a-zA-Z0-9_-]/g, '');
    parts.push(`--category ${category}`);
  }

  if (args.file) {
    const file = String(args.file).replace(/[^a-zA-Z0-9_./-]/g, '');
    parts.push(`--file ${file}`);
  }

  if (args.feature) {
    const feature = String(args.feature).replace(/[^a-zA-Z0-9_-]/g, '');
    parts.push(`--feature ${feature}`);
  }

  if (args.list) {
    parts.push('--list');
  }

  if (args.dryRun) {
    parts.push('--dry-run');
  }

  return parts.join(' ');
}

/**
 * Agent tool definition
 */
export const agentTool: MCPToolDefinition = {
  name: 'krolik_agent',
  description: `Run specialized AI agents with project context. Supports orchestration mode for multi-agent coordination.

ORCHESTRATION MODE (orchestrate=true):
When user says "use multi-agents", "мультиагенты", or needs multiple expert analyses:
1. Set orchestrate=true and provide task description
2. The orchestrator analyzes the task and identifies needed agents
3. Creates execution plan (parallel/sequential)
4. Returns XML for Claude to execute with Task tool

DIRECT MODE (default):
Run a specific agent by name or category.

Examples:
- { "name": "security-auditor" } → Run security agent
- { "category": "quality" } → Run all quality agents
- { "orchestrate": true, "task": "analyze security and performance" } → Multi-agent orchestration
- { "list": true } → List all available agents`,

  inputSchema: {
    type: 'object',
    properties: inputSchema,
  },
  template: { when: 'Multi-agent orchestration', params: '`orchestrate: true, task: "..."`' },
  category: 'advanced',

  handler: (args, workspaceRoot) => {
    return withProjectDetection(args, workspaceRoot, (projectPath) => {
      const command = buildAgentCommand(args);
      const timeout = args.orchestrate ? TIMEOUT_120S : TIMEOUT_60S;
      return runKrolik(command, projectPath, timeout);
    });
  },
};

// Register the tool
registerTool(agentTool);
