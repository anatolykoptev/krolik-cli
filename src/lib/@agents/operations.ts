/**
 * @module lib/@agents/operations
 * @description Agent repository operations (clone, update)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { cloneRepo, isGitAvailable, pullRepo } from '../@vcs';
import { AGENTS_REPO_URL, getAgentsHome, getKrolikHome } from './paths';

/**
 * Clone agents repository to ~/.krolik/agents
 */
export function cloneAgentsRepo(): { success: boolean; path: string; error?: string } {
  const agentsHome = getAgentsHome();
  const krolikHome = getKrolikHome();

  // Ensure ~/.krolik exists
  if (!fs.existsSync(krolikHome)) {
    fs.mkdirSync(krolikHome, { recursive: true });
  }

  // Check if already cloned
  if (fs.existsSync(path.join(agentsHome, 'plugins'))) {
    return { success: true, path: path.join(agentsHome, 'plugins') };
  }

  // Check git availability
  if (!isGitAvailable()) {
    return {
      success: false,
      path: '',
      error: 'Git is not installed. Please install git and try again.',
    };
  }

  const result = cloneRepo(AGENTS_REPO_URL, agentsHome);

  if (result.success) {
    return { success: true, path: path.join(agentsHome, 'plugins') };
  }

  return { success: false, path: '', error: `Failed to clone agents: ${result.error}` };
}

/**
 * Update agents repository
 */
export function updateAgentsRepo(): { success: boolean; updated: boolean; error?: string } {
  const agentsHome = getAgentsHome();

  if (!fs.existsSync(path.join(agentsHome, '.git'))) {
    return {
      success: false,
      updated: false,
      error: 'Agents not installed. Run krolik agent --install first.',
    };
  }

  return pullRepo(agentsHome);
}
