/**
 * @module commands/setup/diagnostics
 * @description Diagnostics for setup command (--check, --list)
 */

import * as fs from 'node:fs';
import type { DiagnosticsResult } from '../core/types';
import { PLUGINS, MCP_SERVERS } from '../core/config';
import { MARKETPLACES_DIR, AGENTS_PLUGINS_DIR } from '../core/paths';
import { getAgentsVersion, getAgentsRepoStats } from '../installers/utils';
import { getInstalledMcpServers } from '../installers/mcp-server';

/**
 * Run diagnostics and return results
 */
export function runDiagnostics(): DiagnosticsResult {
  const result: DiagnosticsResult = {
    plugins: {
      claudeMem: { installed: false },
      agents: { installed: false },
    },
    mcpServers: {
      installed: [],
      missing: [],
      recommended: [],
    },
    recommendations: [],
  };

  // Check claude-mem
  const claudeMemPlugin = PLUGINS.find((p) => p.id === 'claude-mem');
  if (claudeMemPlugin) {
    const claudeMemPath = `${MARKETPLACES_DIR}/${claudeMemPlugin.marketplace}/${claudeMemPlugin.pluginPath}`;
    if (fs.existsSync(claudeMemPath)) {
      result.plugins.claudeMem = { installed: true, path: claudeMemPath };
    } else {
      result.recommendations.push('krolik setup --mem     # Install persistent memory');
    }
  }

  // Check agents
  if (fs.existsSync(AGENTS_PLUGINS_DIR)) {
    const versionInfo = getAgentsVersion();
    const stats = getAgentsRepoStats();
    result.plugins.agents = {
      installed: true,
      ...(versionInfo?.version ? { version: versionInfo.version } : {}),
      stats,
    };
  } else {
    result.recommendations.push('krolik setup --agents  # Install AI agents');
  }

  // Check MCP servers
  const installedServers = getInstalledMcpServers();
  result.mcpServers.installed = installedServers;

  for (const server of MCP_SERVERS) {
    const isInstalled = installedServers.some(
      (s) => s.toLowerCase() === server.id.toLowerCase() || s.toLowerCase().includes(server.id.toLowerCase()),
    );

    if (!isInstalled) {
      result.mcpServers.missing.push(server.id);
      if (server.category === 'essential' || server.category === 'recommended') {
        result.mcpServers.recommended.push(server.id);
        result.recommendations.push(`krolik setup --mcp ${server.id}  # ${server.description}`);
      }
    }
  }

  return result;
}

/**
 * Print diagnostics report
 */
export function printDiagnostics(): void {
  console.log('\n🐰 Krolik Setup — Diagnostics\n');
  console.log('━'.repeat(60));

  const diag = runDiagnostics();

  // Plugins section
  console.log('\n📦 PLUGINS\n');

  // claude-mem
  if (diag.plugins.claudeMem.installed) {
    console.log('  ✅ claude-mem');
    console.log('     Persistent memory for Claude Code sessions');
    console.log(`     Path: ${diag.plugins.claudeMem.path}`);
  } else {
    console.log('  ⬜ claude-mem');
    console.log('     Persistent memory for Claude Code sessions');
    console.log('     Install: krolik setup --mem');
  }

  console.log();

  // wshobson-agents
  if (diag.plugins.agents.installed) {
    console.log(`  ✅ wshobson-agents (${diag.plugins.agents.version || 'unknown'})`);
    console.log('     Claude Code plugins with specialized agents');
    if (diag.plugins.agents.stats) {
      const s = diag.plugins.agents.stats;
      console.log(`     Components: ${s.plugins} plugins, ${s.agents} agents, ${s.commands} commands, ${s.skills} skills`);
    }
  } else {
    console.log('  ⬜ wshobson-agents');
    console.log('     Claude Code plugins with specialized agents');
    console.log('     Install: krolik setup --agents');
  }

  // MCP Servers section
  console.log('\n\n🔌 MCP SERVERS\n');

  // Group by category
  const categories = ['essential', 'recommended', 'optional'] as const;
  const categoryLabels = {
    essential: '🔴 Essential',
    recommended: '🟡 Recommended',
    optional: '🟢 Optional',
  };

  for (const category of categories) {
    const servers = MCP_SERVERS.filter((s) => s.category === category);
    if (servers.length === 0) continue;

    console.log(`  ${categoryLabels[category]}\n`);

    for (const server of servers) {
      const isInstalled = diag.mcpServers.installed.some(
        (s) => s.toLowerCase() === server.id.toLowerCase() || s.toLowerCase().includes(server.id.toLowerCase()),
      );
      const status = isInstalled ? '✅' : '⬜';
      console.log(`    ${status} ${server.id}`);
      console.log(`       ${server.description}`);
      if (!isInstalled) {
        console.log(`       Install: krolik setup --mcp ${server.id}`);
      }
    }
    console.log();
  }

  // Recommendations
  if (diag.recommendations.length > 0) {
    console.log('\n' + '━'.repeat(60));
    console.log('\n💡 RECOMMENDATIONS\n');
    console.log('  Run these commands to complete your setup:\n');
    for (const rec of diag.recommendations.slice(0, 5)) {
      console.log(`    ${rec}`);
    }
    if (diag.recommendations.length > 5) {
      console.log(`    ... and ${diag.recommendations.length - 5} more`);
    }
    console.log();
    console.log('  Or install everything at once:');
    console.log('    krolik setup --all');
  } else {
    console.log('\n' + '━'.repeat(60));
    console.log('\n✅ All components installed!\n');
  }

  console.log();
}

/**
 * List available plugins and agents
 */
export function listPlugins(): void {
  console.log('\n🐰 Krolik Setup — Available components\n');

  // MCP Plugins
  console.log('📦 Claude Code Plugins:\n');
  for (const plugin of PLUGINS) {
    if (plugin.type !== 'mcp-plugin') continue;

    const marketplaceDir = `${MARKETPLACES_DIR}/${plugin.marketplace}`;
    const installed = fs.existsSync(`${marketplaceDir}/${plugin.pluginPath}`);
    const status = installed ? '✅ installed' : '⬜ not installed';

    console.log(`  ${plugin.id}`);
    console.log(`    ${plugin.description}`);
    console.log(`    Status: ${status}`);
    console.log(`    Repo: https://github.com/${plugin.repo}`);
    console.log();
  }

  // Claude Plugins (wshobson/agents)
  console.log('🤖 Claude Code Plugins (wshobson/agents):\n');
  const agentsPlugin = PLUGINS.find((p) => p.id === 'wshobson-agents');
  const agentsInstalled = fs.existsSync(AGENTS_PLUGINS_DIR);
  const version = getAgentsVersion();
  const stats = getAgentsRepoStats();

  if (agentsPlugin) {
    console.log(`  wshobson-agents`);
    console.log(`    ${agentsPlugin.description}`);
    if (agentsInstalled) {
      console.log(`    Status: ✅ installed (${version?.version || 'unknown'})`);
      console.log(`    Components:`);
      console.log(`      ${stats.plugins} plugins`);
      console.log(`      ${stats.agents} agents`);
      console.log(`      ${stats.commands} commands`);
      console.log(`      ${stats.skills} skills`);
    } else {
      console.log(`    Status: ⬜ not installed`);
      console.log(`    Run: krolik setup --agents`);
    }
    console.log(`    Repo: https://github.com/${agentsPlugin.repo}`);
    console.log();
  }

  // Usage
  console.log('📝 Usage:\n');
  console.log('  krolik setup              Install everything');
  console.log('  krolik setup --plugins    Install only MCP plugins');
  console.log('  krolik setup --agents     Install only AI agents');
  console.log('  krolik setup --update     Update all installed components');
  console.log('  krolik setup --force      Reinstall even if installed');
  console.log();
}
