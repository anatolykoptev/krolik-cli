/**
 * @module cli/commands/codegen
 * @description Codegen command registration
 *
 * Usage:
 *   krolik codegen trpc-route --name booking --path apps/web/src/server/routers
 *   krolik codegen zod-schema --name Booking --output packages/shared/src/schemas
 *   krolik codegen ts-zod --from-type UserInput --file src/types.ts
 *   krolik codegen test --file apps/web/src/components/Button.tsx
 *   krolik codegen bundle --bundle react-component --name Button --path src/components
 *   krolik codegen bundle --bundle react-hook --name useAuth --path src/hooks
 *   krolik codegen bundle --bundle api-route --name users --path src/app/api
 *   krolik codegen trpc-route --name booking --no-docs  # Disable docs enhancement
 *   krolik codegen --list  # List available generators
 *
 * Note: Docs enhancement is enabled by default. Use --no-docs to disable.
 */

import type { Command } from 'commander';
import { addDryRunOption, addForceOption, addPathOption, addProjectOption } from '../builders';
import type { CommandOptions } from '../types';
import { createContext, handleProjectOption } from './helpers';

/**
 * Register codegen command
 */
export function registerCodegenCommand(program: Command): void {
  const cmd = program
    .command('codegen [target]')
    .description('Generate code (trpc-route, zod-schema, ts-zod, test, bundle)');

  // Common options using builders
  addProjectOption(cmd);
  addPathOption(cmd);
  addDryRunOption(cmd);
  addForceOption(cmd);

  // Command-specific options
  cmd
    .option('--list', 'List available generators')
    .option('--name <name>', 'Name for generated code (e.g., booking, user, Button)')
    .option('--output <path>', 'Alias for --path')
    .option('--file <file>', 'Source file (for test/ts-zod generator)')
    .option('--from-type <type>', 'TypeScript interface/type name (for ts-zod generator)')
    .option('--from-model <model>', 'Prisma model name (for prisma-zod generator)')
    .option(
      '--bundle <type>',
      'Bundle type: react-component, react-hook, api-route (for bundle generator)',
    )
    .option('--no-docs', 'Disable docs enhancement (enabled by default)')
    .action(async (target: string | undefined, options: CommandOptions) => {
      const { runCodegen } = await import('../../commands/codegen');
      handleProjectOption(options);
      const ctx = await createContext(program, { ...options, target });
      await runCodegen(ctx);
    });
}
