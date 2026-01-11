/**
 * @module cli/commands/audit
 * @description Audit command registration
 */

import type { Command } from 'commander';
import { addCommonOptions, addSummaryOption } from '../builders';
import type { CommandOptions } from '../types';
import { createContext, handleProjectOption } from './helpers';

/**
 * Register audit command
 */
export function registerAuditCommand(program: Command): void {
  const cmd = program
    .command('audit')
    .description(
      'Code quality audit — generates AI-REPORT.md with issues, priorities, and action plan',
    );

  // Common options from builders
  addCommonOptions(cmd);
  addSummaryOption(cmd);

  // Command-specific options
  cmd
    .option('--show-fixes', 'Show fix previews (diffs) for quick wins')
    .option('--feature <name>', 'Filter to specific feature/domain (e.g., booking, auth)')
    .option('--mode <mode>', 'Filter by mode: all (default), release, refactor', 'all')
    .option('--full', 'Show full report (all issues)')
    .action(async (options: CommandOptions) => {
      const { runAudit } = await import('../../commands/audit');
      handleProjectOption(options);

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
