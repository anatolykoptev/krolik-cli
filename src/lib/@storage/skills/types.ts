/**
 * @module lib/@storage/skills/types
 * @description Types for plugin skills storage
 */

/**
 * Skill definition from SKILL.md file
 */
export interface SkillDefinition {
  name: string;
  description: string;
  content: string;
  plugin: string;
  filePath: string;
}

/**
 * Stored skill in SQLite
 */
export interface StoredSkill {
  id: number;
  uniqueId: string; // plugin:name
  name: string;
  description: string;
  content: string;
  plugin: string;
  filePath: string;
  contentHash: string;
  createdAt: string;
  updatedAt: string;
  syncedAt: string;
}

/**
 * Database row for skill
 */
export interface SkillRow {
  id: number;
  unique_id: string;
  name: string;
  description: string;
  content: string;
  plugin: string;
  file_path: string;
  content_hash: string;
  created_at: string;
  updated_at: string;
  synced_at: string;
}

/**
 * Skill sync result
 */
export interface SkillSyncResult {
  added: number;
  updated: number;
  deleted: number;
  unchanged: number;
  total: number;
  durationMs: number;
  errors: string[];
}
