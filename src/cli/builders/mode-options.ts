/**
 * @module cli/builders/mode-options
 * @description Mode option builders for CLI commands
 */

import type { Command } from 'commander';

/**
 * Add --quick/--deep mode switches
 */
export function addModeSwitch(
  cmd: Command,
  modes: ('quick' | 'deep' | 'all')[] = ['quick', 'deep'],
): Command {
  if (modes.includes('quick')) {
    cmd.option('--quick', 'Quick mode: faster, less thorough');
  }
  if (modes.includes('deep')) {
    cmd.option('--deep', 'Deep mode: slower, more thorough');
  }
  if (modes.includes('all')) {
    cmd.option('--all', 'Include all items (including risky)');
  }
  return cmd;
}

/**
 * Add --dry-run option
 */
export function addDryRunOption(cmd: Command): Command {
  return cmd.option('--dry-run', 'Preview changes without applying');
}

/**
 * Add --force option
 */
export function addForceOption(cmd: Command): Command {
  return cmd.option('--force', 'Force operation (overwrite, skip confirmations)');
}
