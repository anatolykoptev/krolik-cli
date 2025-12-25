/**
 * @module cli/context
 * @description Command context creation utilities
 */

import type { Command } from 'commander';
import { loadConfig } from '../config';
import { needsSync, syncClaudeMd } from '../lib/@docs/inject';
import { createLogger } from '../lib/@log';
import type { OutputFormat } from '../types';
import type { CommandOptions } from './types';

/**
 * Determine output format from options
 * Priority: --json > --text > default (ai)
 */
function getOutputFormat(globalOpts: CommandOptions, cmdOpts: CommandOptions): OutputFormat {
  if (globalOpts.json || cmdOpts.json) return 'json';
  if (globalOpts.text || cmdOpts.text) return 'text';
  return 'ai'; // Default: AI-friendly XML
}

/**
 * Create command context with config, logger, and merged options
 */
export async function createContext(program: Command, options: CommandOptions) {
  const globalOpts = program.opts();
  // Support --project-root and --cwd (alias) options
  const projectRoot = globalOpts.projectRoot || globalOpts.cwd || process.env.KROLIK_PROJECT_ROOT;
  const config = await loadConfig({ projectRoot });
  const logger = createLogger({ level: globalOpts.verbose ? 'debug' : 'info' });
  const format = getOutputFormat(globalOpts, options);

  // Auto-sync CLAUDE.md documentation (silent mode)
  // Skip for mcp and sync commands to avoid recursion
  const command = process.argv[2];
  if (command !== 'mcp' && command !== 'sync' && !globalOpts.noSync) {
    try {
      if (needsSync(config.projectRoot)) {
        const result = syncClaudeMd(config.projectRoot, { silent: true });
        if (globalOpts.verbose && result.action !== 'skipped') {
          logger.debug(`CLAUDE.md ${result.action}: ${result.path}`);
        }
      }
    } catch {
      // Silently ignore sync errors
    }
  }

  return { config, logger, options: { ...globalOpts, ...options, format } };
}
