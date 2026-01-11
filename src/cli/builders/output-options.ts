/**
 * @module cli/builders/output-options
 * @description Output format builders for CLI commands
 */

import type { Command } from 'commander';

/**
 * Add --compact/--full output level options
 */
export function addOutputLevelOptions(cmd: Command): Command {
  return cmd
    .option('-c, --compact', 'Compact output (overview only)')
    .option('-f, --full', 'Full verbose output');
}

/**
 * Add --json output option
 */
export function addJsonOption(cmd: Command): Command {
  return cmd.option('--json', 'Output as JSON');
}

/**
 * Add --summary option for brief output
 */
export function addSummaryOption(cmd: Command): Command {
  return cmd.option('--summary', 'Show summary only');
}
