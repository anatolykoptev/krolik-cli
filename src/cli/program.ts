/**
 * @module cli/program
 * @description CLI program creation
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { registerCommands } from './commands';
import { addGlobalOptions } from './options';

const VERSION = '1.0.0';

/**
 * ASCII art logo
 */
const LOGO = `
${chalk.green('   (\\(\\ ')}
${chalk.green('   (-.-) ')}  ${chalk.bold.white('KROLIK CLI')} ${chalk.dim(`v${VERSION}`)}
${chalk.green('   o_(")(")')} ${chalk.dim('Fast AI-assisted development toolkit')}
`;

/**
 * Create main CLI program with all commands registered
 */
export function createProgram(): Command {
  const program = new Command();

  // Add global options
  addGlobalOptions(program);

  // Register all commands
  registerCommands(program);

  // Default action (show help with logo)
  program.action(() => {
    console.log(LOGO);
    program.help();
  });

  return program;
}
