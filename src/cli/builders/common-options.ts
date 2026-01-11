/**
 * @module cli/builders/common-options
 * @description Common option builders for CLI commands
 */

import type { Command } from 'commander';

/**
 * Add --project option for multi-project workspaces
 */
export function addProjectOption(cmd: Command): Command {
  return cmd.option('-p, --project <name>', 'Project folder name (for multi-project workspaces)');
}

/**
 * Add --path option for path-based commands
 */
export function addPathOption(cmd: Command): Command {
  return cmd.option('--path <path>', 'Path to analyze (default: project root)');
}

/**
 * Add common options: --project and --path
 */
export function addCommonOptions(cmd: Command): Command {
  addProjectOption(cmd);
  addPathOption(cmd);
  return cmd;
}
