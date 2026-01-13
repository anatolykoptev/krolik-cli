/**
 * @module mcp/tools/agent
 * @description krolik_agent tool - Run specialized AI agents with orchestration support
 *
 * PERFORMANCE: Uses direct function imports instead of subprocess spawn.
 * This is critical for MCP performance - spawnSync caused 10s+ timeouts
 * because it had to start a new Node process each time.
 *
 * Two modes:
 * 1. Direct agent execution: Run a specific agent by name
 * 2. Orchestration mode: Analyze task and coordinate multiple agents
 */

import {
  findAgentsPath,
  formatOrchestrationXML,
  loadAgentByName,
  loadAgentsByCategory,
  loadAllAgents,
  type OrchestrateOptions,
  orchestrate,
} from '@/commands/agent';
import { buildAgentContext, formatContextForPrompt } from '@/commands/agent/context';
import { saveAgentExecution } from '@/commands/agent/memory';
import { escapeXml } from '@/lib/@format';
import { type MCPToolDefinition, PROJECT_PROPERTY, registerTool } from '../core';
import { formatError } from '../core/errors';
import { resolveProjectPath } from '../core/projects';
import type { SchemaProperty } from '../core/types';

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

// ============================================================================
// HANDLERS
// ============================================================================

/**
 * Handle list action - list all available agents
 */
function handleList(projectPath: string, category?: string): string {
  const agentsPath = findAgentsPath(projectPath);
  if (!agentsPath) {
    return '<agent-list error="true"><message>Agents not found. Run: krolik setup agents</message></agent-list>';
  }

  const agents = category
    ? loadAgentsByCategory(agentsPath, category as Parameters<typeof loadAgentsByCategory>[1])
    : loadAllAgents(agentsPath);

  if (agents.length === 0) {
    const filter = category ? ` in category "${category}"` : '';
    return `<agent-list count="0"><message>No agents found${filter}.</message></agent-list>`;
  }

  const lines: string[] = [`<agent-list count="${agents.length}">`];

  for (const agent of agents) {
    lines.push(`  <agent name="${escapeXml(agent.name)}" category="${agent.category}">`);
    lines.push(`    <description>${escapeXml(agent.description)}</description>`);
    if (agent.model) {
      lines.push(`    <model>${agent.model}</model>`);
    }
    lines.push('  </agent>');
  }

  lines.push('</agent-list>');
  return lines.join('\n');
}

/**
 * Handle single agent execution
 */
async function handleSingleAgent(
  projectPath: string,
  agentName: string,
  options: { file?: string; feature?: string },
): Promise<string> {
  const agentsPath = findAgentsPath(projectPath);
  if (!agentsPath) {
    return '<agent-execution error="true"><message>Agents not found. Run: krolik setup agents</message></agent-execution>';
  }

  const agent = loadAgentByName(agentsPath, agentName);
  if (!agent) {
    return `<agent-execution error="true"><message>Agent "${agentName}" not found.</message></agent-execution>`;
  }

  const startTime = Date.now();

  // Build context
  const context = await buildAgentContext(projectPath, {
    file: options.file,
    feature: options.feature,
    includeSchema: true,
    includeRoutes: true,
    includeGit: true,
  });

  const contextPrompt = formatContextForPrompt(context);
  const durationMs = Date.now() - startTime;

  // Build full prompt
  const fullPrompt = `${agent.content}\n\n${contextPrompt}\n\nPlease analyze the project and provide your findings.`;

  // Save execution to memory
  saveAgentExecution(projectPath, agent.name, agent.category, options.feature);

  // Return XML for Claude to execute
  const lines: string[] = [
    `<agent-execution name="${escapeXml(agent.name)}" category="${agent.category}">`,
    `  <description>${escapeXml(agent.description)}</description>`,
  ];

  if (agent.model) {
    lines.push(`  <model>${agent.model}</model>`);
  }

  lines.push('  <prompt>');
  lines.push(escapeXml(fullPrompt));
  lines.push('  </prompt>');
  lines.push(`  <context-duration-ms>${durationMs}</context-duration-ms>`);
  lines.push('</agent-execution>');

  return lines.join('\n');
}

/**
 * Handle orchestration mode
 */
async function handleOrchestration(
  projectPath: string,
  task: string,
  options: {
    maxAgents?: number;
    parallel?: boolean;
    dryRun?: boolean;
    file?: string;
    feature?: string;
  },
): Promise<string> {
  const orchestrateOptions: OrchestrateOptions = {
    maxAgents: options.maxAgents,
    preferParallel: options.parallel,
    // Context not needed for orchestration plan - agents will load their own context
    includeContext: false,
    file: options.file,
    feature: options.feature,
    dryRun: options.dryRun,
    format: 'xml',
  };

  const result = await orchestrate(task, projectPath, orchestrateOptions);

  // Save orchestration to memory
  const agentNames = result.plan.phases
    .flatMap((p) => p.agents.map((a) => a.agent.name))
    .slice(0, 10);
  saveAgentExecution(
    projectPath,
    `orchestrator:${result.analysis.taskType}`,
    'orchestration',
    options.feature,
    `${task} → agents: ${agentNames.join(', ')}`,
  );

  return formatOrchestrationXML(result);
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const agentTool: MCPToolDefinition = {
  name: 'krolik_agent',
  description:
    'Run specialized AI agents with project context. Supports orchestration mode for multi-agent coordination.\n\nORCHESTRATION MODE (orchestrate=true):\nWhen user says "use multi-agents", "мультиагенты", or needs multiple expert analyses:\n1. Set orchestrate=true and provide task description\n2. The orchestrator analyzes the task and identifies needed agents\n3. Creates execution plan (parallel/sequential)\n4. Returns XML for Claude to execute with Task tool\n\nDIRECT MODE (default):\nRun a specific agent by name or category.\n\nExamples:\n- { "name": "security-auditor" } → Run security agent\n- { "category": "quality" } → Run all quality agents\n- { "orchestrate": true, "task": "analyze security and performance" } → Multi-agent orchestration\n- { "list": true } → List all available agents',

  inputSchema: {
    type: 'object',
    properties: inputSchema,
  },
  template: { when: 'Multi-agent orchestration', params: '`orchestrate: true, task: "..."`' },
  category: 'advanced',

  handler: async (args, workspaceRoot) => {
    const projectArg = typeof args.project === 'string' ? args.project : undefined;
    const resolved = resolveProjectPath(workspaceRoot, projectArg);

    if ('error' in resolved) {
      if (resolved.error.includes('not found')) {
        return `<agent error="true"><message>Project "${projectArg}" not found.</message></agent>`;
      }
      return resolved.error;
    }

    const projectPath = resolved.path;

    try {
      // Handle list action
      if (args.list === true) {
        return handleList(projectPath, args.category as string | undefined);
      }

      // Handle orchestration mode
      if (args.orchestrate === true) {
        const task = args.task as string;
        if (!task) {
          return '<agent error="true"><message>Task description is required for orchestration mode.</message></agent>';
        }
        return await handleOrchestration(projectPath, task, {
          maxAgents: args.maxAgents as number | undefined,
          parallel: args.parallel as boolean | undefined,
          dryRun: args.dryRun as boolean | undefined,
          file: args.file as string | undefined,
          feature: args.feature as string | undefined,
        });
      }

      // Handle single agent execution
      if (args.name) {
        return await handleSingleAgent(projectPath, args.name as string, {
          file: args.file as string | undefined,
          feature: args.feature as string | undefined,
        });
      }

      // Handle category filter (list agents in category)
      if (args.category) {
        return handleList(projectPath, args.category as string);
      }

      return '<agent error="true"><message>Please specify an agent name, category, or use orchestrate mode.</message></agent>';
    } catch (error) {
      return formatError(error);
    }
  },
};

// Register the tool
registerTool(agentTool);
