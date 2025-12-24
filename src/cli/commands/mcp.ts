/**
 * @module cli/commands/mcp
 * @description MCP server command registration
 */

import type { Command } from 'commander';
import { loadConfig } from '../../config';

/**
 * Register MCP server command
 */
export function registerMcpCommand(program: Command): void {
  program
    .command('mcp')
    .description('Start MCP server for Claude Code integration (stdio transport)')
    .action(async () => {
      const { startMCPServer } = await import('../../mcp/server');
      const config = await loadConfig();
      await startMCPServer(config);
    });
}
