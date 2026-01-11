/**
 * @module cli/commands/security
 * @description Security command registration
 */

import type { Command } from 'commander';
import { registerSimpleCommand } from './helpers';

/**
 * Register security command
 */
export function registerSecurityCommand(program: Command): void {
  registerSimpleCommand(program, {
    name: 'security',
    description: 'Run security audit',
    options: [{ flags: '--fix', description: 'Attempt to fix issues' }],
    importPath: '../../commands/security',
    runnerName: 'runSecurity',
  });
}
