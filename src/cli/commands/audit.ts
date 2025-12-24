/**
 * @module cli/commands/audit
 * @description Audit command registration
 */

import type { Command } from 'commander';

/** Command options type */
interface CommandOptions {
  [key: string]: unknown;
}

/** Helper to create command context */
async function createContext(program: Command, options: CommandOptions) {
  const { createContext: createCtx } = await import('../context');
  return createCtx(program, options);
}

/**
 * Register audit command
 */
export function registerAuditCommand(program: Command): void {
  program
    .command('audit')
    .description(
      'Code quality audit — generates AI-REPORT.md with issues, priorities, and action plan',
    )
    .option('--path <path>', 'Path to analyze (default: project root)')
    .option('--show-fixes', 'Show fix previews (diffs) for quick wins')
    .action(async (options: CommandOptions) => {
      const { runAudit } = await import('../../commands/audit');
      const ctx = await createContext(program, {
        ...options,
        showFixes: options.showFixes,
      });
      await runAudit(ctx);
    });
}
