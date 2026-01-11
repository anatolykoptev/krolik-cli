/**
 * @module cli/commands/mcp
 * @description MCP server command registration
 */

import type { Command } from 'commander';
import { loadConfig } from '../../config';
import { addProjectOption } from '../builders';
import type { CommandOptions } from '../types';
import { handleProjectOption } from './helpers';

/**
 * Register MCP server command
 */
export function registerMcpCommand(program: Command): void {
  const cmd = program
    .command('mcp')
    .description('Start MCP server for Claude Code integration (stdio transport)');
  addProjectOption(cmd);
  cmd.action(async (options: CommandOptions) => {
    handleProjectOption(options);
    const { startMCPServer } = await import('../../mcp/server');
    const config = await loadConfig();
    await startMCPServer(config);
  });
}
