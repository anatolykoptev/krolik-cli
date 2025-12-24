/**
 * @module bin/cli
 * @description KROLIK CLI entry point
 */

import { createLogger } from '../lib/@log';
import { createProgram } from '../cli/program';

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const program = createProgram();

  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    const logger = createLogger();
    if (error instanceof Error) {
      logger.error(`Error: ${error.message}`);
    } else {
      logger.error('An unexpected error occurred');
    }
    process.exit(1);
  }
}

main();
