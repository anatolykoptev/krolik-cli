/**
 * @module lib/@agents/paths
 * @description Path utilities for agents marketplace
 */

import { homedir } from 'node:os';
import * as path from 'node:path';

/**
 * Agents repository constants
 */
export const AGENTS_REPO_URL = 'https://github.com/wshobson/agents.git';
export const AGENTS_REPO_NAME = 'wshobson/agents';

/**
 * Get krolik home directory (~/.krolik)
 */
export function getKrolikHome(): string {
  return path.join(homedir(), '.krolik');
}

/**
 * Get agents repository home (~/.krolik/agents)
 */
export function getAgentsHome(): string {
  return path.join(getKrolikHome(), 'agents');
}

/**
 * Get agents plugins directory (~/.krolik/agents/plugins)
 */
export function getAgentsPluginsDir(): string {
  return path.join(getAgentsHome(), 'plugins');
}
