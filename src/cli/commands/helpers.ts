/**
 * @module cli/commands/helpers
 * @description Shared helpers for CLI commands
 */

import type { Command } from 'commander';
import { resolveProjectPath } from '../../mcp/tools/core/projects';
import { addProjectOption } from '../builders';
import type { CommandOptionDef, CommandOptions, SimpleCommandConfig } from '../types';

/**
 * Handle --project option for smart project detection
 * Sets KROLIK_PROJECT_ROOT env variable if project is specified
 * Exits with error if project not found
 * Returns the resolved project path
 */
export function handleProjectOption(options: CommandOptions): string | undefined {
  if (options.project) {
    const resolved = resolveProjectPath(process.cwd(), options.project as string);
    if ('error' in resolved) {
      console.error(resolved.error);
      process.exit(1);
    }
    process.env.KROLIK_PROJECT_ROOT = resolved.path;
    return resolved.path;
  }
  return undefined;
}

/**
 * Helper to create command context
 * Dynamically imports context module to avoid circular dependencies
 */
export async function createContext(program: Command, options: CommandOptions) {
  const { createContext: createCtx } = await import('../context');
  return createCtx(program, options);
}

/**
 * Factory for creating simple commands with consistent structure
 * Uses builders for common options
 */
export function registerSimpleCommand(program: Command, config: SimpleCommandConfig): void {
  const cmd = program.command(config.name).description(config.description);

  // Use builder for --project option
  addProjectOption(cmd);

  // Add custom options
  if (config.options) {
    for (const opt of config.options) {
      if (opt.defaultValue !== undefined) {
        cmd.option(opt.flags, opt.description, String(opt.defaultValue));
      } else {
        cmd.option(opt.flags, opt.description);
      }
    }
  }

  cmd.action(async (options: CommandOptions) => {
    const module = await import(config.importPath);
    const runner = module[config.runnerName];
    handleProjectOption(options);
    const ctx = await createContext(program, options);
    await runner(ctx);
  });
}

// Re-export types for backward compatibility
export type { CommandOptionDef, SimpleCommandConfig };
