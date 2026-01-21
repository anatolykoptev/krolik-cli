/**
 * @module lib/@storage/skills/sync
 * @description Sync plugin skills from file system to SQLite
 *
 * Loads SKILL.md files from plugins/{plugin}/skills/{skill-name}/SKILL.md
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { getAgentsPluginsDir } from '@/lib/@agents';
import { logger } from '@/lib/@core/logger';
import { parseFrontmatter } from '@/lib/@format';

import { getGlobalDatabase, prepareStatement } from '../database';
import type { SkillDefinition, SkillRow, SkillSyncResult, StoredSkill } from './types';

/**
 * Compute content hash for change detection
 */
function computeHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

/**
 * Convert SkillRow to StoredSkill
 */
function rowToSkill(row: SkillRow): StoredSkill {
  return {
    id: row.id,
    uniqueId: row.unique_id,
    name: row.name,
    description: row.description,
    content: row.content,
    plugin: row.plugin,
    filePath: row.file_path,
    contentHash: row.content_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncedAt: row.synced_at,
  };
}

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

/**
 * Get all skills from database
 */
export function getAllSkills(): StoredSkill[] {
  const db = getGlobalDatabase();
  const sql = 'SELECT * FROM plugin_skills ORDER BY plugin, name';
  const rows = prepareStatement<[], SkillRow>(db, sql).all();
  return rows.map(rowToSkill);
}

/**
 * Get skill by unique_id (plugin:name)
 */
export function getSkillByUniqueId(uniqueId: string): StoredSkill | null {
  const db = getGlobalDatabase();
  const sql = 'SELECT * FROM plugin_skills WHERE unique_id = ?';
  const row = prepareStatement<[string], SkillRow>(db, sql).get(uniqueId);
  return row ? rowToSkill(row) : null;
}

/**
 * Get all skills for a plugin
 */
export function getSkillsByPlugin(plugin: string): StoredSkill[] {
  const db = getGlobalDatabase();
  const sql = 'SELECT * FROM plugin_skills WHERE plugin = ? ORDER BY name';
  const rows = prepareStatement<[string], SkillRow>(db, sql).all(plugin);
  return rows.map(rowToSkill);
}

/**
 * Get skill count
 */
export function getSkillCount(): number {
  const db = getGlobalDatabase();
  const sql = 'SELECT COUNT(*) as count FROM plugin_skills';
  const row = prepareStatement<[], { count: number }>(db, sql).get();
  return row?.count ?? 0;
}

/**
 * Search skills by task description using FTS5
 * Returns skills ranked by relevance to the task
 */
export function searchSkillsByTask(task: string, limit = 5): StoredSkill[] {
  const db = getGlobalDatabase();

  // Clean and prepare search query
  // FTS5 uses AND by default, we want OR for flexibility
  const words = task
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 10); // Limit to 10 words

  if (words.length === 0) return [];

  // Build FTS5 query with OR
  const ftsQuery = words.join(' OR ');

  const sql = `
    SELECT ps.*, bm25(plugin_skills_fts, 1, 2) as rank
    FROM plugin_skills ps
    JOIN plugin_skills_fts fts ON ps.id = fts.rowid
    WHERE plugin_skills_fts MATCH ?
    ORDER BY rank
    LIMIT ?
  `;

  try {
    const rows = prepareStatement<[string, number], SkillRow & { rank: number }>(db, sql).all(
      ftsQuery,
      limit,
    );
    return rows.map(rowToSkill);
  } catch (error) {
    logger.debug(`FTS search failed: ${error}`);
    return [];
  }
}

/**
 * Select relevant skills from a plugin's skills based on task
 * Uses FTS5 to match task against skill descriptions
 *
 * @param task - The task description or feature name
 * @param pluginSkills - Skills from the agent's plugin
 * @param limit - Max skills to return (default 3)
 */
export function selectRelevantSkills(
  task: string,
  pluginSkills: StoredSkill[],
  limit = 3,
): StoredSkill[] {
  if (pluginSkills.length === 0) return [];
  if (pluginSkills.length <= limit) return pluginSkills; // Return all if under limit

  const db = getGlobalDatabase();

  // Get unique_ids of plugin skills for filtering
  const pluginSkillIds = new Set(pluginSkills.map((s) => s.uniqueId));

  // Clean and prepare search query
  const words = task
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 10);

  if (words.length === 0) {
    // No searchable words, return first N skills
    return pluginSkills.slice(0, limit);
  }

  const ftsQuery = words.join(' OR ');

  // Build placeholders for IN clause
  const placeholders = pluginSkills.map(() => '?').join(',');

  const sql = `
    SELECT ps.*, bm25(plugin_skills_fts, 1, 2) as rank
    FROM plugin_skills ps
    JOIN plugin_skills_fts fts ON ps.id = fts.rowid
    WHERE plugin_skills_fts MATCH ?
      AND ps.unique_id IN (${placeholders})
    ORDER BY rank
    LIMIT ?
  `;

  try {
    const params: (string | number)[] = [ftsQuery, ...pluginSkillIds, limit];
    const rows = prepareStatement<(string | number)[], SkillRow & { rank: number }>(db, sql).all(
      ...params,
    );

    const selectedSkills = rows.map(rowToSkill);

    // If FTS found fewer skills than limit, add remaining skills
    if (selectedSkills.length < limit) {
      const selectedIds = new Set(selectedSkills.map((s) => s.uniqueId));
      const remaining = pluginSkills.filter((s) => !selectedIds.has(s.uniqueId));
      const needed = limit - selectedSkills.length;
      selectedSkills.push(...remaining.slice(0, needed));
    }

    return selectedSkills;
  } catch (error) {
    logger.debug(`Skill selection failed: ${error}, returning first ${limit} skills`);
    return pluginSkills.slice(0, limit);
  }
}

// ============================================================================
// LOADER FUNCTIONS
// ============================================================================

/**
 * Parse a skill .md file
 * Extracts name from:
 * 1. frontmatter `name` field
 * 2. filename (without .md) for direct .md files
 * 3. parent directory name for SKILL.md files
 */
function parseSkillFile(filePath: string, pluginName: string): SkillDefinition | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = parseFrontmatter(content);
    const fileName = path.basename(filePath);

    // Determine name: frontmatter > filename > parent dir
    let name = parsed.data.name as string | undefined;
    if (!name) {
      if (fileName === 'SKILL.md') {
        name = path.basename(path.dirname(filePath));
      } else {
        name = fileName.replace(/\.md$/, '');
      }
    }

    return {
      name,
      description: (parsed.data.description as string) ?? '',
      content: parsed.body.trim(),
      plugin: pluginName,
      filePath,
    };
  } catch (error) {
    logger.debug(`Failed to parse skill file ${filePath}: ${error}`);
    return null;
  }
}

/**
 * Load skills from a single plugin
 * Supports two formats:
 * 1. skills/skill-name.md (krolik format - direct .md files)
 * 2. skills/skill-name/SKILL.md (awesome-claude-skills format)
 */
function loadSkillsFromPlugin(pluginsPath: string, pluginName: string): SkillDefinition[] {
  const skillsDir = path.join(pluginsPath, pluginName, 'skills');
  if (!fs.existsSync(skillsDir)) return [];

  const skills: SkillDefinition[] = [];
  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });

  for (const entry of entries) {
    // Format 1: Direct .md files (krolik format)
    if (entry.isFile() && entry.name.endsWith('.md')) {
      const skillFile = path.join(skillsDir, entry.name);
      const skill = parseSkillFile(skillFile, pluginName);
      if (skill) skills.push(skill);
      continue;
    }

    // Format 2: SKILL.md inside folder (awesome-claude-skills format)
    if (entry.isDirectory()) {
      const skillFile = path.join(skillsDir, entry.name, 'SKILL.md');
      if (fs.existsSync(skillFile)) {
        const skill = parseSkillFile(skillFile, pluginName);
        if (skill) skills.push(skill);
      }
    }
  }

  return skills;
}

/**
 * Load all skills from all plugins
 */
export function loadAllSkills(pluginsPath: string): SkillDefinition[] {
  if (!fs.existsSync(pluginsPath)) return [];

  const plugins = fs.readdirSync(pluginsPath, { withFileTypes: true });
  const skills: SkillDefinition[] = [];

  for (const plugin of plugins) {
    if (!plugin.isDirectory()) continue;
    skills.push(...loadSkillsFromPlugin(pluginsPath, plugin.name));
  }

  return skills;
}

// ============================================================================
// SYNC FUNCTIONS
// ============================================================================

/**
 * Upsert a skill into the database
 */
function upsertSkill(
  skill: SkillDefinition,
  contentHash: string,
): 'added' | 'updated' | 'unchanged' {
  const db = getGlobalDatabase();
  const uniqueId = `${skill.plugin}:${skill.name}`;

  // Check if skill exists
  const existingSql = 'SELECT id, content_hash FROM plugin_skills WHERE unique_id = ?';
  const existing = prepareStatement<[string], { id: number; content_hash: string }>(
    db,
    existingSql,
  ).get(uniqueId);

  if (existing) {
    if (existing.content_hash === contentHash) {
      return 'unchanged';
    }

    // Update
    const updateSql = `
      UPDATE plugin_skills SET
        name = ?,
        description = ?,
        content = ?,
        plugin = ?,
        file_path = ?,
        content_hash = ?,
        updated_at = datetime('now'),
        synced_at = datetime('now')
      WHERE id = ?
    `;
    prepareStatement<[string, string, string, string, string, string, number]>(db, updateSql).run(
      skill.name,
      skill.description,
      skill.content,
      skill.plugin,
      skill.filePath,
      contentHash,
      existing.id,
    );

    return 'updated';
  }

  // Insert
  const insertSql = `
    INSERT INTO plugin_skills (
      unique_id, name, description, content, plugin, file_path, content_hash
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  prepareStatement<[string, string, string, string, string, string, string]>(db, insertSql).run(
    uniqueId,
    skill.name,
    skill.description,
    skill.content,
    skill.plugin,
    skill.filePath,
    contentHash,
  );

  return 'added';
}

/**
 * Remove stale skills
 */
function removeStaleSkills(currentSkillUniqueIds: Set<string>): number {
  const db = getGlobalDatabase();

  const allIdsSql = 'SELECT unique_id FROM plugin_skills';
  const allIds = prepareStatement<[], { unique_id: string }>(db, allIdsSql).all();

  let deleted = 0;
  for (const { unique_id } of allIds) {
    if (!currentSkillUniqueIds.has(unique_id)) {
      const deleteSql = 'DELETE FROM plugin_skills WHERE unique_id = ?';
      prepareStatement<[string]>(db, deleteSql).run(unique_id);
      deleted++;
      logger.debug(`Removed stale skill: ${unique_id}`);
    }
  }

  return deleted;
}

/**
 * Sync skills from file system to SQLite
 */
export function syncSkillsToDatabase(): SkillSyncResult {
  const startTime = Date.now();
  const errors: string[] = [];

  // Get plugins path
  const pluginsPath = getAgentsPluginsDir();
  if (!fs.existsSync(pluginsPath)) {
    return {
      added: 0,
      updated: 0,
      deleted: 0,
      unchanged: 0,
      total: getSkillCount(),
      durationMs: Date.now() - startTime,
      errors: ['Plugins directory not found'],
    };
  }

  // Load all skills
  const allSkills = loadAllSkills(pluginsPath);

  if (allSkills.length === 0) {
    return {
      added: 0,
      updated: 0,
      deleted: 0,
      unchanged: 0,
      total: getSkillCount(),
      durationMs: Date.now() - startTime,
      errors: [],
    };
  }

  const currentSkillUniqueIds = new Set<string>();

  let added = 0;
  let updated = 0;
  let unchanged = 0;

  // Process each skill
  for (const skill of allSkills) {
    try {
      const uniqueId = `${skill.plugin}:${skill.name}`;
      currentSkillUniqueIds.add(uniqueId);

      const fileContent = fs.readFileSync(skill.filePath, 'utf-8');
      const contentHash = computeHash(fileContent);

      const result = upsertSkill(skill, contentHash);

      switch (result) {
        case 'added':
          added++;
          logger.debug(`Added skill: ${uniqueId}`);
          break;
        case 'updated':
          updated++;
          logger.debug(`Updated skill: ${uniqueId}`);
          break;
        case 'unchanged':
          unchanged++;
          break;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`Failed to sync ${skill.plugin}:${skill.name}: ${message}`);
      logger.error(`Failed to sync skill ${skill.plugin}:${skill.name}: ${message}`);
    }
  }

  // Remove stale skills
  const deleted = removeStaleSkills(currentSkillUniqueIds);

  const total = getSkillCount();
  const durationMs = Date.now() - startTime;

  logger.info(
    `Skill sync complete: +${added} ~${updated} -${deleted} =${unchanged} (${total} total) in ${durationMs}ms`,
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
 * Sync skills if needed
 */
export function syncSkillsIfNeeded(): SkillSyncResult | null {
  const db = getGlobalDatabase();

  // Check if any skills exist
  const countSql = 'SELECT COUNT(*) as count FROM plugin_skills';
  const row = prepareStatement<[], { count: number }>(db, countSql).get();

  if (row?.count === 0) {
    return syncSkillsToDatabase();
  }

  // TODO: Add mtime-based check like agents
  return null;
}

/**
 * Clear all skills
 */
export function clearAllSkills(): void {
  const db = getGlobalDatabase();
  prepareStatement(db, 'DELETE FROM plugin_skills').run();
  logger.info('Cleared all skills from database');
}
