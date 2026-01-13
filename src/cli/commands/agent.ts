/**
 * @module cli/commands/agent
 * @description Agent command registration with orchestration support
 *
 * Supports two modes:
 * 1. Direct mode: Run a specific agent by name
 * 2. Orchestration mode: Analyze task and coordinate multiple agents
 */

import type { Command } from 'commander';
import { addDryRunOption, addProjectOption } from '../builders';
import type { CommandOptions } from '../types';
import { createContext, handleProjectOption } from './helpers';

// Preload embeddings in background when agent command is registered
// This ensures semantic matching is ready when orchestration is called
let embeddingsPreloaded = false;
function preloadEmbeddingsAsync() {
  if (embeddingsPreloaded) return;
  embeddingsPreloaded = true;
  // Dynamic import to avoid loading heavy modules at CLI startup
  import('@/lib/@storage/memory/embeddings').then(({ preloadEmbeddingPool }) => {
    preloadEmbeddingPool();
  });
}

/**
 * Register agent command
 */
export function registerAgentCommand(program: Command): void {
  const cmd = program
    .command('agent [name]')
    .description(
      'Run specialized AI agents with project context. Use --orchestrate for multi-agent coordination.',
    );

  // Common options using builders
  addProjectOption(cmd);
  addDryRunOption(cmd);

  // Command-specific options
  cmd
    .option('--list', 'List all available agents')
    .option('--install', 'Install agents from wshobson/agents to ~/.krolik/agents')
    .option('--update', 'Update installed agents to latest version')
    .option('--category <cat>', 'Filter by category: security, perf, arch, quality, debug, docs')
    .option('--file <path>', 'Target file for analysis')
    .option('--feature <name>', 'Feature/domain to focus on')
    .option('--no-schema', 'Skip including Prisma schema')
    .option('--no-routes', 'Skip including tRPC routes')
    .option('--no-git', 'Skip including git info')
    // Orchestration options
    .option(
      '--orchestrate',
      'Enable orchestration mode: analyze task and coordinate multiple agents',
    )
    .option('--task <description>', 'Task description for orchestration (what to analyze)')
    .option('--max-agents <n>', 'Maximum agents to run in orchestration (default: 5)', parseInt)
    .option('--parallel', 'Prefer parallel execution of agents')
    .action(async (name: string | undefined, options: CommandOptions) => {
      // Start embedding preload immediately for faster semantic matching
      preloadEmbeddingsAsync();
      const { runAgent } = await import('../../commands/agent');
      handleProjectOption(options);
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
