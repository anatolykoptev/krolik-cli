/**
 * @module cli/parsers/output-format
 * @description Output format resolution for CLI commands
 */

import type { CommandOptions } from '../types';

export type OutputFormat = 'json' | 'text' | 'ai';

interface GlobalOptions {
  json?: boolean;
  text?: boolean;
}

/**
 * Resolve output format from global and command options
 */
export function resolveOutputFormat(
  globalOpts: GlobalOptions,
  cmdOpts?: CommandOptions,
): OutputFormat {
  // Command-level takes precedence
  if (cmdOpts?.json) return 'json';
  if (cmdOpts?.text) return 'text';

  // Then global options
  if (globalOpts.json) return 'json';
  if (globalOpts.text) return 'text';

  return 'ai'; // default for AI-friendly XML
}

/**
 * Check if output should be JSON
 */
export function isJsonOutput(globalOpts: GlobalOptions, cmdOpts?: CommandOptions): boolean {
  return resolveOutputFormat(globalOpts, cmdOpts) === 'json';
}
