/**
 * @module lib/@felix/tools/runtime
 * @description Runtime environment for Ralph Actions with telemetry, safety, and observation
 */

import { discoverContextFiles } from '@/lib/@context/discovery';
import { logger } from '@/lib/@core/logger/logger';
import { listDir, readFile, replaceInFile, writeFile } from './fs';
import { runCommand } from './shell';

export interface ActionRuntimeConfig {
  projectRoot: string;
  dryRun?: boolean;
  verbose?: boolean;
}

export class ActionRuntime {
  readonly config: ActionRuntimeConfig;

  constructor(config: ActionRuntimeConfig) {
    this.config = config;
  }

  /**
   * wrapper for all tool executions to handle logging and errors
   */
  async execute<T>(toolName: string, operation: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      if (this.config.verbose) {
        logger.debug(`[Action] ${toolName} - Started`);
      }

      const result = await operation();

      const duration = Math.round(performance.now() - start);
      logger.info(`[Action] ${toolName} - ✅ Success (${duration}ms)`);
      return result;
    } catch (error) {
      const duration = Math.round(performance.now() - start);
      logger.error(
        `[Action] ${toolName} - ❌ Failed (${duration}ms): ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  // --- Tools ---

  async readFile(path: string): Promise<string> {
    return this.execute('read_file', async () => {
      return readFile(this.config.projectRoot, path);
    });
  }

  async writeFile(path: string, content: string): Promise<string> {
    return this.execute('write_file', async () => {
      if (this.config.dryRun) {
        logger.info(`[DryRun] Would write to ${path} (${content.length} bytes)`);
        return `[DryRun] Successfully wrote to ${path}`;
      }
      writeFile(this.config.projectRoot, path, content);
      return `Successfully wrote to ${path}`;
    });
  }

  async replaceInFile(path: string, search: string, replace: string): Promise<string> {
    return this.execute('replace_in_file', async () => {
      if (this.config.dryRun) {
        logger.info(`[DryRun] Would replace text in ${path}`);
        logger.info(`  Search: "${search.substring(0, 50)}..."`);
        logger.info(`  Replace: "${replace.substring(0, 50)}..."`);
        return `[DryRun] Successfully replaced content in ${path}`;
      }
      replaceInFile(this.config.projectRoot, path, search, replace);
      return `Successfully replaced content in ${path}`;
    });
  }

  async listDir(path: string, depth?: number): Promise<string> {
    return this.execute('list_dir', async () => {
      const files = listDir(this.config.projectRoot, path, depth);
      return files.join('\n');
    });
  }

  async runCommand(command: string): Promise<string> {
    return this.execute('run_command', async () => {
      if (this.config.dryRun) {
        // Allow read-only commands? Hard to detect. Block all for safety in strict dry-run.
        // Or maybe allow simple listing. For now, block.
        logger.info(`[DryRun] Would execute command: ${command}`);
        return `[DryRun] Command executed: ${command}`;
      }
      return await runCommand(this.config.projectRoot, command);
    });
  }

  async searchFiles(keywords: string[]): Promise<string> {
    // Safe to run in dryRun
    return this.execute('search_files', async () => {
      const results = discoverContextFiles(this.config.projectRoot, keywords, { limit: 20 });
      return results.map((f) => `${f.path} (${f.reason})`).join('\n');
    });
  }

  // -- Advanced Tools --

  async grepSearch(query: string, includes?: string[]): Promise<string> {
    return this.execute('grep_search', async () => {
      // Basic grep implementation using standard shell tools
      // TODO: Check if ripgrep (rg) is available for better performance?
      // For now, use `grep -r "query" .` with includes filtering if simple

      let command = `grep -n -r "${query.replace(/"/g, '\\"')}" .`;
      if (includes && includes.length > 0) {
        const includePattern = includes.map((i) => `--include="${i}"`).join(' ');
        command = `grep -n -r ${includePattern} "${query.replace(/"/g, '\\"')}" .`;
      }

      // Ignore node_modules and .git
      command += ` --exclude-dir=node_modules --exclude-dir=.git`;

      return await runCommand(this.config.projectRoot, command);
    });
  }
}
