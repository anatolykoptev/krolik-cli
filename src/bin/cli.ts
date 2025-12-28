/**
 * @module bin/cli
 * @description KROLIK CLI entry point
 */

import { createProgram } from '../cli/program';
import { createLogger } from '../lib/core/logger';

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
