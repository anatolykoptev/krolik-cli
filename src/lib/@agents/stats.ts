/**
 * @module lib/@agents/stats
 * @description Repository statistics for agents
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Repository statistics
 */
export interface RepoStats {
  plugins: number;
  agents: number;
  commands: number;
  skills: number;
}

/**
 * Get repository statistics
 */
export function getRepoStats(pluginsDir: string): RepoStats {
  const stats: RepoStats = {
    plugins: 0,
    agents: 0,
    commands: 0,
    skills: 0,
  };

  if (!fs.existsSync(pluginsDir)) {
    return stats;
  }

  const plugins = fs.readdirSync(pluginsDir, { withFileTypes: true });

  for (const plugin of plugins) {
    if (!plugin.isDirectory()) continue;
    stats.plugins++;

    const pluginPath = path.join(pluginsDir, plugin.name);

    // Count agents
    const agentsDir = path.join(pluginPath, 'agents');
    if (fs.existsSync(agentsDir)) {
      const files = fs.readdirSync(agentsDir);
      stats.agents += files.filter((f) => f.endsWith('.md') && f !== 'SKILL.md').length;
    }

    // Count commands
    const commandsDir = path.join(pluginPath, 'commands');
    if (fs.existsSync(commandsDir)) {
      const files = fs.readdirSync(commandsDir);
      stats.commands += files.filter((f) => f.endsWith('.md')).length;
    }

    // Count skills
    const skillsDir = path.join(pluginPath, 'skills');
    if (fs.existsSync(skillsDir)) {
      const dirs = fs.readdirSync(skillsDir, { withFileTypes: true });
      stats.skills += dirs.filter((d) => d.isDirectory()).length;
    }
  }

  return stats;
}
