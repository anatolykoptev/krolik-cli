/**
 * @module cli/commands/context
 * @description Context command registration
 */

import type { Command } from 'commander';
import { resolveProjectPath } from '../../mcp/tools/core/projects';
import type { CommandOptions } from '../types';
import { createContext } from './helpers';

/**
 * Register context command
 */
export function registerContextCommand(program: Command): void {
  program
    .command('context')
    .description(
      `Generate AI context for a task

Modes:
  -m, --minimal  Ultra-compact: summary, git, memory only (~1500 tokens)
  -q, --quick    Compact: architecture, git, tree, schema, routes, repo-map (~3500 tokens)
  -d, --deep     Heavy analysis: imports, types, env, contracts (~5s)
  --full         All sections + quality audit (~10s)

Filters:
  -s, --search <pattern>  Include files/code matching pattern
  --changed-only          Include only changed files (from git status)

Examples:
  krolik context --feature auth              # Context for auth feature
  krolik context --issue 42                  # Context from GitHub issue
  krolik context --quick                     # Compact mode with repo-map
  krolik context --search "tRPC"             # Context with search for tRPC
  krolik context --changed-only              # Only context from changed files`,
    )
    .option('-p, --project <name>', 'Project folder name (for multi-project workspaces)')
    .option('--issue <number>', 'Context for GitHub issue')
    .option('--feature <name>', 'Context for feature')
    .option('--file <path>', 'Context for file')
    .option(
      '-m, --minimal',
      'Minimal mode: ultra-compact (~1500 tokens) - summary, git, memory only',
    )
    .option('-q, --quick', 'Quick mode: compact (~3500 tokens) - includes repo-map')
    .option('-d, --deep', 'Deep mode: imports, types, env, contracts')
    .option('--full', 'Full mode: all sections + quality audit')
    .option('--with-issues', 'Include GitHub issues from gh CLI')
    .option('--budget <number>', 'Token budget for smart context (default: 4000)', (val) =>
      parseInt(val, 10),
    )
    .option('-s, --search <pattern>', 'Search pattern - include files/code matching pattern')
    .option('--changed-only', 'Include only changed files (from git status)')
    .action(async (options: CommandOptions) => {
      const { runContext } = await import('../../commands/context');

      // Architecture is always ON (simplified from --no-architecture)
      options.architecture = true;

      // --full enables --with-audit
      if (options.full) {
        options.withAudit = true;
      }

      // Handle --project option
      if (options.project) {
        const resolved = resolveProjectPath(process.cwd(), options.project as string);
        if ('error' in resolved) {
          console.error(resolved.error);
          process.exit(1);
        }
        // Override project root via environment variable (used by loadConfig)
        process.env.KROLIK_PROJECT_ROOT = resolved.path;
      }

      const ctx = await createContext(program, options);
      await runContext(ctx);
    });
}
