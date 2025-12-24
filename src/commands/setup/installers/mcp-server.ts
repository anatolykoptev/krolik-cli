/**
 * @module commands/setup/installers/mcp-server
 * @description MCP server installer (via claude mcp add)
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import { getMcpServer, getRequiredMcpServers, MCP_SERVERS } from '../core/config';
import { CLAUDE_GLOBAL_CONFIG, getProjectConfigPath } from '../core/paths';
import type { InstallerOptions, InstallResult } from '../core/types';

/**
 * Get installed MCP servers from Claude settings
 */
export function getInstalledMcpServers(): string[] {
  const servers: string[] = [];

  // Check global config
  if (fs.existsSync(CLAUDE_GLOBAL_CONFIG)) {
    try {
      const config = JSON.parse(fs.readFileSync(CLAUDE_GLOBAL_CONFIG, 'utf8'));
      if (config.mcpServers) {
        servers.push(...Object.keys(config.mcpServers));
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Check project config (cwd)
  const projectConfigPath = getProjectConfigPath();
  if (fs.existsSync(projectConfigPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(projectConfigPath, 'utf8'));
      if (config.mcpServers) {
        servers.push(...Object.keys(config.mcpServers));
      }
      if (config.enabledMcpjsonServers) {
        servers.push(...config.enabledMcpjsonServers);
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Check via claude mcp list (more reliable)
  try {
    const result = spawnSync('claude', ['mcp', 'list'], {
      stdio: 'pipe',
      encoding: 'utf8',
      timeout: 10000,
    });
    if (result.status === 0 && result.stdout) {
      // Parse output: each line is "name: command args..."
      const lines = result.stdout.split('\n').filter((l) => l.trim());
      for (const line of lines) {
        const match = line.match(/^(\S+):/);
        if (match?.[1]) {
          servers.push(match[1]);
        }
      }
    }
  } catch {
    // claude command not available
  }

  return [...new Set(servers)]; // Deduplicate
}

/**
 * Check if an MCP server is installed
 */
export function isMcpServerInstalled(serverId: string): boolean {
  const installed = getInstalledMcpServers();
  return installed.some(
    (s) =>
      s.toLowerCase() === serverId.toLowerCase() ||
      s.toLowerCase().includes(serverId.toLowerCase()),
  );
}

/**
 * Install MCP server using claude mcp add
 */
export async function installMcpServer(
  serverId: string,
  opts: InstallerOptions,
): Promise<InstallResult> {
  const { dryRun, logger } = opts;
  const server = getMcpServer(serverId);

  if (!server) {
    logger.error(`Unknown MCP server: ${serverId}`);
    logger.info('Available servers:');
    for (const s of MCP_SERVERS) {
      logger.info(`  ${s.id} — ${s.description}`);
    }
    return { success: false, error: `Unknown server: ${serverId}` };
  }

  logger.info(`  🔌 ${server.name}`);
  logger.info(`     ${server.description}`);

  // Check if already installed
  if (isMcpServerInstalled(serverId)) {
    logger.info('     ⏭️  Already installed');
    return { success: true, message: 'Already installed' };
  }

  if (dryRun) {
    logger.info(
      `     [DRY RUN] Would run: claude mcp add ${server.name} -- ${server.command} ${server.args.join(' ')}`,
    );
    return { success: true, message: 'Dry run' };
  }

  try {
    logger.info('     Installing via claude mcp add...');

    const result = spawnSync(
      'claude',
      ['mcp', 'add', server.name, '--', server.command, ...server.args],
      {
        stdio: 'pipe',
        encoding: 'utf8',
        timeout: 30000,
      },
    );

    if (result.status !== 0) {
      throw new Error(result.stderr || 'Installation failed');
    }

    logger.info('     ✅ Installed successfully');
    return { success: true, message: 'Installed' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`     ❌ Failed: ${message}`);
    logger.info(
      '     Try manually: claude mcp add ' +
        server.name +
        ' -- ' +
        server.command +
        ' ' +
        server.args.join(' '),
    );
    return { success: false, error: message };
  }
}

/**
 * Install all recommended MCP servers
 */
export async function installAllMcpServers(opts: InstallerOptions): Promise<void> {
  const { dryRun, logger } = opts;
  const installed = getInstalledMcpServers();

  logger.info('🔌 Installing MCP servers...\n');

  for (const server of getRequiredMcpServers()) {
    const isInstalled = installed.some((s) => s.toLowerCase() === server.id.toLowerCase());

    if (!isInstalled) {
      await installMcpServer(server.id, { dryRun, logger });
    }
  }
}
