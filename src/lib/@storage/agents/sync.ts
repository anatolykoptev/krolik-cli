/**
 * @module lib/@storage/agents/sync
 * @description Sync agents from file system to SQLite
 *
 * Uses content hash for change detection to enable incremental sync.
 * Only re-parses and updates agents that have changed.
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { parseAgentCapabilities } from '@/commands/agent/capabilities/parser';
import {
  findAgentsPath,
  findWorkspaceAgentsPath,
  loadAllAgents,
  loadWorkspaceAgents,
} from '@/commands/agent/loader';
import type { AgentDefinition } from '@/commands/agent/types';
import { logger } from '@/lib/@core/logger';

import { getGlobalDatabase, prepareStatement } from '../database';
import type { AgentRow, AgentSyncResult, StoredAgent } from './types';

/**
 * Compute content hash for change detection
 */
function computeHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

/**
 * Convert AgentRow to StoredAgent
 */
function rowToAgent(row: AgentRow): StoredAgent {
  return {
    id: row.id,
    uniqueId: row.unique_id,
    name: row.name,
    description: row.description,
    content: row.content,
    category: row.category as StoredAgent['category'],
    plugin: row.plugin,
    filePath: row.file_path,
    contentHash: row.content_hash,
    model: row.model as StoredAgent['model'],
    keywords: JSON.parse(row.keywords),
    techStack: JSON.parse(row.tech_stack),
    projectTypes: JSON.parse(row.project_types),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncedAt: row.synced_at,
  };
}

/**
 * Get all agents from database
 */
export function getAllAgents(): StoredAgent[] {
  const db = getGlobalDatabase();
  const sql = 'SELECT * FROM agent_agents ORDER BY name';
  const rows = prepareStatement<[], AgentRow>(db, sql).all();
  return rows.map(rowToAgent);
}

/**
 * Get agent by unique_id (plugin:name)
 */
export function getAgentByUniqueId(uniqueId: string): StoredAgent | null {
  const db = getGlobalDatabase();
  const sql = 'SELECT * FROM agent_agents WHERE unique_id = ?';
  const row = prepareStatement<[string], AgentRow>(db, sql).get(uniqueId);
  return row ? rowToAgent(row) : null;
}

/**
 * Get agent by name (returns first match if multiple exist)
 * For specific plugin, use getAgentByUniqueId with 'plugin:name'
 */
export function getAgentByName(name: string): StoredAgent | null {
  const db = getGlobalDatabase();
  const sql = 'SELECT * FROM agent_agents WHERE name = ? ORDER BY id LIMIT 1';
  const row = prepareStatement<[string], AgentRow>(db, sql).get(name);
  return row ? rowToAgent(row) : null;
}

/**
 * Get all agents with a given name (from different plugins)
 */
export function getAgentsByName(name: string): StoredAgent[] {
  const db = getGlobalDatabase();
  const sql = 'SELECT * FROM agent_agents WHERE name = ? ORDER BY plugin';
  const rows = prepareStatement<[string], AgentRow>(db, sql).all(name);
  return rows.map(rowToAgent);
}

/**
 * Get agents by category
 */
export function getAgentsByCategory(category: string): StoredAgent[] {
  const db = getGlobalDatabase();
  const sql = 'SELECT * FROM agent_agents WHERE category = ? ORDER BY name';
  const rows = prepareStatement<[string], AgentRow>(db, sql).all(category);
  return rows.map(rowToAgent);
}

/**
 * Get agent count
 */
export function getAgentCount(): number {
  const db = getGlobalDatabase();
  const sql = 'SELECT COUNT(*) as count FROM agent_agents';
  const row = prepareStatement<[], { count: number }>(db, sql).get();
  return row?.count ?? 0;
}

/**
 * Upsert an agent into the database
 * Uses unique_id (plugin:name) as the key for deduplication
 */
function upsertAgent(
  agent: AgentDefinition,
  contentHash: string,
): 'added' | 'updated' | 'unchanged' {
  const db = getGlobalDatabase();
  const uniqueId = `${agent.plugin}:${agent.name}`;

  // Parse capabilities
  const capabilities = parseAgentCapabilities(agent);

  // Check if agent exists by unique_id and if hash changed
  const existingSql = 'SELECT id, content_hash FROM agent_agents WHERE unique_id = ?';
  const existing = prepareStatement<[string], { id: number; content_hash: string }>(
    db,
    existingSql,
  ).get(uniqueId);

  if (existing) {
    // Agent exists - check if content changed
    if (existing.content_hash === contentHash) {
      return 'unchanged';
    }

    // Content changed - update
    const updateSql = `
      UPDATE agent_agents SET
        name = ?,
        description = ?,
        content = ?,
        category = ?,
        plugin = ?,
        file_path = ?,
        content_hash = ?,
        model = ?,
        keywords = ?,
        tech_stack = ?,
        project_types = ?,
        updated_at = datetime('now'),
        synced_at = datetime('now')
      WHERE id = ?
    `;
    prepareStatement<
      [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string | null,
        string,
        string,
        string,
        number,
      ]
    >(db, updateSql).run(
      agent.name,
      agent.description,
      agent.content,
      agent.category,
      agent.plugin,
      agent.filePath,
      contentHash,
      agent.model ?? null,
      JSON.stringify(capabilities.keywords),
      JSON.stringify(capabilities.techStack),
      JSON.stringify(capabilities.projectTypes),
      existing.id,
    );

    return 'updated';
  }

  // New agent - insert with unique_id
  const insertSql = `
    INSERT INTO agent_agents (
      unique_id, name, description, content, category, plugin, file_path,
      content_hash, model, keywords, tech_stack, project_types
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  prepareStatement<
    [
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string | null,
      string,
      string,
      string,
    ]
  >(db, insertSql).run(
    uniqueId,
    agent.name,
    agent.description,
    agent.content,
    agent.category,
    agent.plugin,
    agent.filePath,
    contentHash,
    agent.model ?? null,
    JSON.stringify(capabilities.keywords),
    JSON.stringify(capabilities.techStack),
    JSON.stringify(capabilities.projectTypes),
  );

  return 'added';
}

/**
 * Remove agents that no longer exist in file system
 * Uses unique_id (plugin:name) for identification
 */
function removeStaleAgents(currentAgentUniqueIds: Set<string>): number {
  const db = getGlobalDatabase();

  // Get all unique_ids in database
  const allIdsSql = 'SELECT unique_id FROM agent_agents';
  const allIds = prepareStatement<[], { unique_id: string }>(db, allIdsSql).all();

  let deleted = 0;
  for (const { unique_id } of allIds) {
    if (!currentAgentUniqueIds.has(unique_id)) {
      const deleteSql = 'DELETE FROM agent_agents WHERE unique_id = ?';
      prepareStatement<[string]>(db, deleteSql).run(unique_id);
      deleted++;
      logger.debug(`Removed stale agent: ${unique_id}`);
    }
  }

  return deleted;
}

/**
 * Sync agents from file system to SQLite database
 *
 * This function:
 * 1. Loads all agents from marketplace (wshobson/agents)
 * 2. Loads agents from workspace (.agent/agents/)
 * 3. Computes content hashes for change detection
 * 4. Upserts new/changed agents
 * 5. Removes stale agents that no longer exist
 *
 * @param projectRoot - Project root for finding agents path
 * @returns Sync result with statistics
 */
export function syncAgentsToDatabase(projectRoot: string): AgentSyncResult {
  const startTime = Date.now();
  const errors: string[] = [];

  // Collect all agents from all sources
  const allAgents: AgentDefinition[] = [];

  // Load marketplace agents
  const agentsPath = findAgentsPath(projectRoot);
  if (agentsPath) {
    allAgents.push(...loadAllAgents(agentsPath));
  }

  // Load workspace agents (.agent/agents/)
  const workspaceAgentsPath = findWorkspaceAgentsPath(projectRoot);
  if (workspaceAgentsPath) {
    const workspaceAgents = loadWorkspaceAgents(workspaceAgentsPath);
    logger.debug(`Found ${workspaceAgents.length} workspace agents in ${workspaceAgentsPath}`);
    allAgents.push(...workspaceAgents);
  }

  if (allAgents.length === 0) {
    return {
      added: 0,
      updated: 0,
      deleted: 0,
      unchanged: 0,
      total: getAgentCount(),
      durationMs: Date.now() - startTime,
      errors: ['No agents found (neither marketplace nor workspace)'],
    };
  }

  const currentAgentUniqueIds = new Set<string>();

  let added = 0;
  let updated = 0;
  let unchanged = 0;

  // Process each agent
  for (const agent of allAgents) {
    try {
      const uniqueId = `${agent.plugin}:${agent.name}`;
      currentAgentUniqueIds.add(uniqueId);

      // Read file content for hash
      const fileContent = fs.readFileSync(agent.filePath, 'utf-8');
      const contentHash = computeHash(fileContent);

      const result = upsertAgent(agent, contentHash);

      switch (result) {
        case 'added':
          added++;
          logger.debug(`Added agent: ${uniqueId}`);
          break;
        case 'updated':
          updated++;
          logger.debug(`Updated agent: ${uniqueId}`);
          break;
        case 'unchanged':
          unchanged++;
          break;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`Failed to sync ${agent.plugin}:${agent.name}: ${message}`);
      logger.error(`Failed to sync agent ${agent.plugin}:${agent.name}: ${message}`);
    }
  }

  // Remove stale agents
  const deleted = removeStaleAgents(currentAgentUniqueIds);

  const total = getAgentCount();
  const durationMs = Date.now() - startTime;

  logger.info(
    `Agent sync complete: +${added} ~${updated} -${deleted} =${unchanged} (${total} total, ${workspaceAgentsPath ? 'includes workspace' : 'marketplace only'}) in ${durationMs}ms`,
  );

  return {
    added,
    updated,
    deleted,
    unchanged,
    total,
    durationMs,
    errors,
  };
}

/**
 * Check if sync is needed by comparing file mtimes with last sync
 */
export function isSyncNeeded(projectRoot: string): boolean {
  const db = getGlobalDatabase();

  // Get last sync time
  const lastSyncSql = 'SELECT MAX(synced_at) as last_sync FROM agent_agents';
  const lastSyncRow = prepareStatement<[], { last_sync: string | null }>(db, lastSyncSql).get();

  if (!lastSyncRow?.last_sync) {
    return true; // No agents synced yet
  }

  const lastSyncTime = new Date(lastSyncRow.last_sync).getTime();

  // Helper to check directory for modified files
  const checkDir = (dir: string): boolean => {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (checkDir(fullPath)) return true;
        } else if (entry.name.endsWith('.md')) {
          const stat = fs.statSync(fullPath);
          if (stat.mtimeMs > lastSyncTime) {
            return true;
          }
        }
      }
      return false;
    } catch {
      return true; // Error checking, assume sync needed
    }
  };

  // Check marketplace agents
  const agentsPath = findAgentsPath(projectRoot);
  if (agentsPath && checkDir(agentsPath)) {
    return true;
  }

  // Check workspace agents
  const workspaceAgentsPath = findWorkspaceAgentsPath(projectRoot);
  if (workspaceAgentsPath && checkDir(workspaceAgentsPath)) {
    return true;
  }

  return false;
}

/**
 * Sync agents if needed (lazy sync)
 */
export function syncAgentsIfNeeded(projectRoot: string): AgentSyncResult | null {
  if (!isSyncNeeded(projectRoot)) {
    return null; // No sync needed
  }
  return syncAgentsToDatabase(projectRoot);
}

/**
 * Clear all agents from database (for testing/reset)
 */
export function clearAllAgents(): void {
  const db = getGlobalDatabase();
  prepareStatement(db, 'DELETE FROM agent_agents').run();
  logger.info('Cleared all agents from database');
}
