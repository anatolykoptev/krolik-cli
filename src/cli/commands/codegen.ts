/**
 * @module cli/commands/codegen
 * @description Codegen command registration
 */

import type { Command } from 'commander';
import type { CommandOptions } from '../types';

/** Helper to create command context */
async function createContext(program: Command, options: CommandOptions) {
  const { createContext: createCtx } = await import('../context');
  return createCtx(program, options);
}

/**
 * Register codegen command
 */
export function registerCodegenCommand(program: Command): void {
  program
    .command('codegen <target>')
    .description('Generate code (hooks, schemas, tests, barrels, docs)')
    .option('--path <path>', 'Target path')
    .option('--dry-run', 'Preview without changes')
    .option('--force', 'Overwrite existing files')
    .action(async (target: string, options: CommandOptions) => {
      const { runCodegen } = await import('../../commands/codegen');
      const ctx = await createContext(program, { ...options, target });
      await runCodegen(ctx);
    });
}
