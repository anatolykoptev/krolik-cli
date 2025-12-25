/**
 * @module cli/options
 * @description Global CLI options
 */

import type { Command } from 'commander';
import { KROLIK_VERSION } from '@/version';

/**
 * Add global options to the program
 */
export function addGlobalOptions(program: Command): void {
  program
    .name('krolik')
    .description('KROLIK — fast AI-assisted development toolkit (AI-friendly output by default)')
    .version(KROLIK_VERSION, '-V, --version', 'Output version number')
    .option('-c, --config <path>', 'Path to config file')
    .option('--project-root <path>', 'Project root directory')
    .option('--cwd <path>', 'Project root directory (alias for --project-root)')
    .option('-t, --text', 'Human-readable text output (default: AI-friendly XML)')
    .option('--json', 'Output as JSON')
    .option('-v, --verbose', 'Verbose output')
    .option('--no-color', 'Disable colored output')
    .option('--no-sync', 'Disable auto-sync of CLAUDE.md documentation');
}
