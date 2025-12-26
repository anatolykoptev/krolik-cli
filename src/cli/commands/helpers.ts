/**
 * @module cli/commands/helpers
 * @description Shared helpers for CLI commands
 */

import type { Command } from 'commander';
import type { CommandOptions } from '../types';

/**
 * Helper to create command context
 * Dynamically imports context module to avoid circular dependencies
 */
export async function createContext(program: Command, options: CommandOptions) {
  const { createContext: createCtx } = await import('../context');
  return createCtx(program, options);
}
