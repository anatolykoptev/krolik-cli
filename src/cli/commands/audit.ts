/**
 * @module cli/commands/audit
 * @description Audit command registration
 */

import type { Command } from 'commander';
import type { CommandOptions } from '../types';
import { createContext } from './helpers';

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
    .option('--feature <name>', 'Filter to specific feature/domain (e.g., booking, auth)')
    .option('--mode <mode>', 'Filter by mode: all (default), release, refactor', 'all')
    .option('--summary', 'Show only executive summary (~50 tokens)')
    .option('--full', 'Show full report (all issues)')
    .action(async (options: CommandOptions) => {
      const { runAudit } = await import('../../commands/audit');
      const ctx = await createContext(program, {
        ...options,
        showFixes: options.showFixes,
        feature: options.feature,
        mode: options.mode,
        outputLevel: options.summary ? 'summary' : options.full ? 'full' : 'default',
      });
      await runAudit(ctx);
    });
}
