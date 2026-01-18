/**
 * @module lib/@ralph/tools/shell
 * @description Shell execution tools for Ralph Agent
 */

import { exec } from 'node:child_process';
import { logger } from '@/lib/@core/logger/logger';

/**
 * Run shell command
 */
export function runCommand(projectRoot: string, command: string): Promise<string> {
  logger.info(`[ralph:shell] Executing: ${command}`);

  return new Promise((resolve) => {
    exec(command, { cwd: projectRoot, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        // Return stderr/error as result, don't reject promise so agent can see failure
        resolve(`Command failed: ${error.message}\nStderr: ${stderr}\nStdout: ${stdout}`);
        return;
      }
      resolve(stdout || stderr || '(No output)');
    });
  });
}
