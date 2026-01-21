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

// Preload embeddings immediately when this module is imported
// This gives embeddings a head start while CLI parses arguments
let embeddingsPreloaded = false;
function preloadEmbeddingsAsync() {
  if (embeddingsPreloaded) return;
  embeddingsPreloaded = true;
  // Dynamic import to avoid loading heavy modules at CLI startup
  import('@/lib/@storage/memory/embeddings').then(({ preloadEmbeddingPool }) => {
    preloadEmbeddingPool();
  });
}

// Start preloading immediately when module is imported
// This runs in parallel with CLI argument parsing
preloadEmbeddingsAsync();

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
    .option(
      '--consilium',
      'Enable consilium mode: dynamically generate specialized agents using Agent Architect',
    )
    .option(
      '--task <description>',
      'Task description for orchestration/consilium (what to analyze)',
    )
    .option('--max-agents <n>', 'Maximum agents to run (default: 5)', parseInt)
    .option('--parallel', 'Prefer parallel execution of agents')
    .option('--focus <areas>', 'Focus areas for consilium (comma-separated)')
    // LLM options
    .option('--model <name>', 'LLM model to use (gemini-2.0-flash, opus, sonnet)')
    .option('--backend <type>', 'LLM backend type (cli, api)')
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
        consilium: options.consilium,
        task: options.task,
        maxAgents: options.maxAgents,
        preferParallel: options.parallel,
        focusAreas: options.focus
          ? (options.focus as string).split(',').map((s: string) => s.trim())
          : undefined,
        model: options.model,
        backend: options.backend,
      });
      await runAgent(ctx);
    });
}
