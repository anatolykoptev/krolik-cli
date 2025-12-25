/**
 * @module cli/commands/agent
 * @description Agent command registration with orchestration support
 *
 * Supports two modes:
 * 1. Direct mode: Run a specific agent by name
 * 2. Orchestration mode: Analyze task and coordinate multiple agents
 */

import type { Command } from 'commander';
import type { CommandOptions } from '../types';

/** Helper to create command context */
async function createContext(program: Command, options: CommandOptions) {
  const { createContext: createCtx } = await import('../context');
  return createCtx(program, options);
}

/**
 * Register agent command
 */
export function registerAgentCommand(program: Command): void {
  program
    .command('agent [name]')
    .description(
      'Run specialized AI agents with project context. Use --orchestrate for multi-agent coordination.',
    )
    .option('--list', 'List all available agents')
    .option('--install', 'Install agents from wshobson/agents to ~/.krolik/agents')
    .option('--update', 'Update installed agents to latest version')
    .option('--category <cat>', 'Filter by category: security, perf, arch, quality, debug, docs')
    .option('--file <path>', 'Target file for analysis')
    .option('--feature <name>', 'Feature/domain to focus on')
    .option('--no-schema', 'Skip including Prisma schema')
    .option('--no-routes', 'Skip including tRPC routes')
    .option('--no-git', 'Skip including git info')
    .option('--dry-run', 'Show agent prompt without executing')
    // Orchestration options
    .option(
      '--orchestrate',
      'Enable orchestration mode: analyze task and coordinate multiple agents',
    )
    .option('--task <description>', 'Task description for orchestration (what to analyze)')
    .option('--max-agents <n>', 'Maximum agents to run in orchestration (default: 5)', parseInt)
    .option('--parallel', 'Prefer parallel execution of agents')
    .action(async (name: string | undefined, options: CommandOptions) => {
      const { runAgent } = await import('../../commands/agent');
      const ctx = await createContext(program, {
        ...options,
        agentName: name,
        install: options.install,
        update: options.update,
        includeSchema: options.schema !== false,
        includeRoutes: options.routes !== false,
        includeGit: options.git !== false,
        // Orchestration options
        orchestrate: options.orchestrate,
        task: options.task,
        maxAgents: options.maxAgents,
        preferParallel: options.parallel,
      });
      await runAgent(ctx);
    });
}
