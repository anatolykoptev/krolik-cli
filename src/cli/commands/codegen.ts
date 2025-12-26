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
    .command('codegen [target]')
    .description('Generate code (trpc-route, zod-schema, ts-zod, test, bundle)')
    .option('--list', 'List available generators')
    .option('--name <name>', 'Name for generated code (e.g., booking, user, Button)')
    .option('--path <path>', 'Output path for generated files')
    .option('--output <path>', 'Alias for --path')
    .option('--file <file>', 'Source file (for test/ts-zod generator)')
    .option('--from-type <type>', 'TypeScript interface/type name (for ts-zod generator)')
    .option('--from-model <model>', 'Prisma model name (for prisma-zod generator)')
    .option(
      '--bundle <type>',
      'Bundle type: react-component, react-hook, api-route (for bundle generator)',
    )
    .option('--dry-run', 'Preview without creating files')
    .option('--force', 'Overwrite existing files')
    .option('--no-docs', 'Disable docs enhancement (enabled by default)')
    .action(async (target: string | undefined, options: CommandOptions) => {
      const { runCodegen } = await import('../../commands/codegen');
      const ctx = await createContext(program, { ...options, target });
      await runCodegen(ctx);
    });
}
