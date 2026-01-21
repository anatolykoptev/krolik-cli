/**
 * @module lib/@storage/agents/types
 * @description Types for agent storage with hybrid search
 */

import type { AgentCategory } from '@/commands/agent/types';

/**
 * Agent stored in SQLite database
 */
export interface StoredAgent {
  /** Database ID */
  id: number;
  /** Unique ID = plugin:name */
  uniqueId: string;
  /** Agent name (may have duplicates across plugins) */
  name: string;
  /** Agent description */
  description: string;
  /** Full agent content (prompt) */
  content: string;
  /** Agent category */
  category: AgentCategory;
  /** Plugin name */
  plugin: string;
  /** Path to agent file */
  filePath: string;
  /** Content hash for change detection */
  contentHash: string;
  /** Model preference */
  model: 'sonnet' | 'opus' | 'haiku' | 'inherit' | null;
  /** Extracted keywords */
  keywords: string[];
  /** Tech stack mentions */
  techStack: string[];
  /** Suitable project types */
  projectTypes: ('monorepo' | 'single' | 'backend' | 'frontend' | 'fullstack')[];
  /** When agent was first added */
  createdAt: string;
  /** When agent was last updated */
  updatedAt: string;
  /** When agent was last synced from file system */
  syncedAt: string;
}

/**
 * Agent row from database (raw)
 */
export interface AgentRow {
  id: number;
  unique_id: string;
  name: string;
  description: string;
  content: string;
  category: string;
  plugin: string;
  file_path: string;
  content_hash: string;
  model: string | null;
  keywords: string;
  tech_stack: string;
  project_types: string;
  created_at: string;
  updated_at: string;
  synced_at: string;
}

/**
 * Agent with embedding (for semantic search)
 */
export interface AgentWithEmbedding extends StoredAgent {
  /** Pre-computed embedding vector */
  embedding?: Float32Array;
}

/**
 * Search result with relevance scores
 */
export interface AgentSearchResult {
  /** Agent data */
  agent: StoredAgent;
  /** Combined relevance score (0-100) */
  relevance: number;
  /** Score breakdown */
  breakdown: AgentScoreBreakdown;
}

/**
 * Score breakdown for transparency
 */
export interface AgentScoreBreakdown {
  /** BM25 keyword score (0-40) */
  bm25Score: number;
  /** Semantic similarity score (0-40) */
  semanticScore: number;
  /** Category match boost (0-10) */
  categoryBoost: number;
  /** Usage history boost (0-10) */
  historyBoost: number;
  /** Raw similarity for debugging */
  similarity?: number;
}

/**
 * Agent usage record
 */
export interface AgentUsage {
  id: number;
  agentId: number;
  project: string;
  feature?: string;
  usedAt: string;
  success: boolean;
  feedback?: string;
}

/**
 * Sync result from file system
 */
export interface AgentSyncResult {
  /** Number of agents added */
  added: number;
  /** Number of agents updated */
  updated: number;
  /** Number of agents deleted */
  deleted: number;
  /** Number of agents unchanged */
  unchanged: number;
  /** Total agents after sync */
  total: number;
  /** Sync duration in ms */
  durationMs: number;
  /** Errors encountered */
  errors: string[];
}

/**
 * Search options
 */
export interface AgentSearchOptions {
  /** Maximum results to return */
  limit?: number;
  /** Minimum relevance score (0-100) */
  minScore?: number;
  /** Filter by category */
  category?: AgentCategory;
  /** Weight for BM25 search (0-1) */
  bm25Weight?: number;
  /** Weight for semantic search (0-1) */
  semanticWeight?: number;
  /** Current project for history boosting */
  project?: string;
  /** Current feature for context boosting */
  feature?: string;
}

/**
 * Default search options
 */
export const DEFAULT_SEARCH_OPTIONS: Required<AgentSearchOptions> = {
  limit: 10,
  minScore: 20,
  category: undefined as unknown as AgentCategory,
  bm25Weight: 0.4,
  semanticWeight: 0.4,
  project: '',
  feature: '',
};
