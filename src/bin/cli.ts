/**
 * @module bin/cli
 * @description KROLIK CLI entry point
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createProgram } from '../cli/program';
import { createLogger } from '../lib/@core/logger';

// Load .env from krolik-cli directory (not cwd)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const krolikRoot = join(__dirname, '..', '..');
dotenv.config({ path: join(krolikRoot, '.env') });

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
