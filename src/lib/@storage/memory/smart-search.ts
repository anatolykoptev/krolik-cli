/**
 * @module lib/@storage/memory/smart-search
 * @description Google-style smart memory retrieval with context-aware ranking
 *
 * Implements relevance scoring based on:
 * - BM25 text similarity (base score)
 * - Time decay (newer = more relevant)
 * - Importance weighting (critical > high > medium > low)
 * - Context boosting (feature/file match)
 * - Freshness bonus (recent memories get priority)
 */

import { getDatabase } from '../database';
import { BM25_RELEVANCE_MULTIPLIER, DEFAULT_SEARCH_LIMIT } from './constants';
import { rowToMemory } from './converters';
import type { Memory, MemoryImportance, MemorySearchResult, MemoryType } from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Time decay half-life in days
 * After this many days, relevance is halved
 */
const TIME_DECAY_HALF_LIFE_DAYS = 30;

/**
 * Importance multipliers for ranking
 */
const IMPORTANCE_MULTIPLIERS: Record<MemoryImportance, number> = {
  critical: 2.0,
  high: 1.5,
  medium: 1.0,
  low: 0.5,
};

/**
 * Type multipliers (some memory types are more actionable)
 */
const TYPE_MULTIPLIERS: Record<MemoryType, number> = {
  decision: 1.3, // Decisions are highly relevant
  pattern: 1.2, // Patterns inform architecture
  bugfix: 1.1, // Bugfixes prevent regressions
  feature: 1.0, // Features are context
  observation: 0.9, // Observations are background
};

/**
 * Freshness bonus thresholds (hours)
 */
const FRESHNESS_THRESHOLDS = {
  veryRecent: 24, // Last 24 hours: 1.5x
  recent: 168, // Last week: 1.2x
  normal: 720, // Last month: 1.0x
  old: Infinity, // Older: 0.8x
};

// ============================================================================
// SMART SEARCH OPTIONS
// ============================================================================

/**
 * Enhanced search options with context
 */
export interface SmartSearchOptions {
  /** Search query (FTS5) */
  query?: string | undefined;
  /** Filter by memory type */
  type?: MemoryType | undefined;
  /** Filter by importance level */
  importance?: MemoryImportance | undefined;
  /** Filter by project */
  project?: string | undefined;
  /** Filter/boost by tags */
  tags?: string[] | undefined;
  /** Filter/boost by features */
  features?: string[] | undefined;
  /** Current file context (for boosting) */
  currentFile?: string | undefined;
  /** Current feature context (for boosting) */
  currentFeature?: string | undefined;
  /** Maximum results */
  limit?: number | undefined;
  /** Minimum relevance score (0-100) */
  minRelevance?: number | undefined;
  /** Include reasoning for relevance */
  includeReasoning?: boolean | undefined;
}

/**
 * Enhanced search result with reasoning
 */
export interface SmartSearchResult extends MemorySearchResult {
  /** Breakdown of relevance factors */
  reasoning?: RelevanceBreakdown | undefined;
}

/**
 * Breakdown of relevance factors for transparency
 */
export interface RelevanceBreakdown {
  /** Base BM25 score */
  textMatch: number;
  /** Time decay factor (0-1) */
  timeDecay: number;
  /** Importance multiplier */
  importanceBoost: number;
  /** Type multiplier */
  typeBoost: number;
  /** Context match boost */
  contextBoost: number;
  /** Freshness bonus */
  freshnessBonus: number;
  /** Final combined score */
  final: number;
}

// ============================================================================
// SMART SEARCH
// ============================================================================

/**
 * Smart search with context-aware ranking
 *
 * @example
 * ```typescript
 * const results = smartSearch({
 *   query: 'authentication',
 *   currentFeature: 'auth',
 *   project: 'piternow-wt-fix',
 *   limit: 5,
 * });
 * ```
 */
export function smartSearch(options: SmartSearchOptions): SmartSearchResult[] {
  const db = getDatabase();
  const params: unknown[] = [];
  const conditions: string[] = [];

  // Build WHERE conditions
  if (options.project) {
    conditions.push('m.project = ?');
    params.push(options.project);
  }

  if (options.type) {
    conditions.push('m.type = ?');
    params.push(options.type);
  }

  if (options.importance) {
    conditions.push('m.importance = ?');
    params.push(options.importance);
  }

  const limit = options.limit ?? DEFAULT_SEARCH_LIMIT;
  const now = Date.now();

  // If query provided, use FTS5
  if (options.query?.trim()) {
    const whereClause = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';

    // Escape FTS5 special characters and add prefix matching
    const ftsQuery = options.query
      .replace(/['"]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 0)
      .map((word) => `${word}*`)
      .join(' OR ');

    const sql = `
      SELECT m.*, bm25(memories_fts) as rank
      FROM memories_fts
      JOIN memories m ON memories_fts.rowid = m.id
      WHERE memories_fts MATCH ?
      ${whereClause}
      ORDER BY rank
      LIMIT ?
    `;

    params.unshift(ftsQuery);
    params.push(limit * 3); // Fetch more, then re-rank

    try {
      const rows = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;

      // Re-rank with smart scoring
      const results = rows.map((row) => {
        const memory = rowToMemory(row);
        const baseScore = Math.abs(row.rank as number) * BM25_RELEVANCE_MULTIPLIER;
        return calculateSmartRelevance(memory, baseScore, options, now);
      });

      // Sort by final relevance
      results.sort((a, b) => b.relevance - a.relevance);

      // Apply minimum relevance filter
      const filtered = options.minRelevance
        ? results.filter((r) => r.relevance >= options.minRelevance!)
        : results;

      // Limit results
      return filtered.slice(0, limit);
    } catch {
      // FTS query failed, fall back to smart recency search
      return smartRecentSearch(options);
    }
  }

  // No query - smart recency search
  return smartRecentSearch(options);
}

/**
 * Smart recency-based search (no query)
 */
function smartRecentSearch(options: SmartSearchOptions): SmartSearchResult[] {
  const db = getDatabase();
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (options.project) {
    conditions.push('project = ?');
    params.push(options.project);
  }

  if (options.type) {
    conditions.push('type = ?');
    params.push(options.type);
  }

  if (options.importance) {
    conditions.push('importance = ?');
    params.push(options.importance);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = options.limit ?? DEFAULT_SEARCH_LIMIT;
  const now = Date.now();

  const sql = `
    SELECT *
    FROM memories
    ${whereClause}
    ORDER BY created_at_epoch DESC
    LIMIT ?
  `;

  params.push(limit * 2); // Fetch more, then re-rank

  const rows = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;

  // Calculate smart relevance for each
  const results = rows.map((row) => {
    const memory = rowToMemory(row);
    return calculateSmartRelevance(memory, 50, options, now); // Base score 50 for recency
  });

  // Sort by final relevance
  results.sort((a, b) => b.relevance - a.relevance);

  // Apply minimum relevance filter
  const filtered = options.minRelevance
    ? results.filter((r) => r.relevance >= options.minRelevance!)
    : results;

  return filtered.slice(0, limit);
}

// ============================================================================
// RELEVANCE CALCULATION
// ============================================================================

/**
 * Calculate smart relevance score with all factors
 */
function calculateSmartRelevance(
  memory: Memory,
  baseScore: number,
  options: SmartSearchOptions,
  now: number,
): SmartSearchResult {
  // 1. Time decay (exponential decay based on age)
  const createdAt = new Date(memory.createdAt).getTime();
  const ageInDays = (now - createdAt) / (1000 * 60 * 60 * 24);
  const timeDecay = 0.5 ** (ageInDays / TIME_DECAY_HALF_LIFE_DAYS);

  // 2. Importance boost
  const importanceBoost = IMPORTANCE_MULTIPLIERS[memory.importance] ?? 1.0;

  // 3. Type boost
  const typeBoost = TYPE_MULTIPLIERS[memory.type] ?? 1.0;

  // 4. Freshness bonus
  const ageInHours = ageInDays * 24;
  let freshnessBonus = 1.0;
  if (ageInHours < FRESHNESS_THRESHOLDS.veryRecent) {
    freshnessBonus = 1.5;
  } else if (ageInHours < FRESHNESS_THRESHOLDS.recent) {
    freshnessBonus = 1.2;
  } else if (ageInHours > FRESHNESS_THRESHOLDS.normal) {
    freshnessBonus = 0.8;
  }

  // 5. Context boost (feature/file match)
  let contextBoost = 1.0;

  // Check feature match
  if (options.currentFeature && memory.features) {
    const featureMatch = memory.features.some(
      (f) =>
        f.toLowerCase().includes(options.currentFeature!.toLowerCase()) ||
        options.currentFeature!.toLowerCase().includes(f.toLowerCase()),
    );
    if (featureMatch) {
      contextBoost *= 1.5;
    }
  }

  // Check file match
  if (options.currentFile && memory.files) {
    const fileMatch = memory.files.some(
      (f) =>
        f.includes(options.currentFile!) || options.currentFile!.includes(f.split('/').pop() ?? ''),
    );
    if (fileMatch) {
      contextBoost *= 1.3;
    }
  }

  // Check tag match
  if (options.tags && options.tags.length > 0) {
    const tagMatch = options.tags.some((tag) =>
      memory.tags.some((t) => t.toLowerCase() === tag.toLowerCase()),
    );
    if (tagMatch) {
      contextBoost *= 1.2;
    }
  }

  // Calculate final score
  const finalScore =
    baseScore * timeDecay * importanceBoost * typeBoost * freshnessBonus * contextBoost;

  // Normalize to 0-100 range
  const normalizedScore = Math.min(100, Math.max(0, finalScore));

  const result: SmartSearchResult = {
    memory,
    relevance: Math.round(normalizedScore * 10) / 10,
  };

  // Add reasoning if requested
  if (options.includeReasoning) {
    result.reasoning = {
      textMatch: Math.round(baseScore * 10) / 10,
      timeDecay: Math.round(timeDecay * 100) / 100,
      importanceBoost,
      typeBoost,
      contextBoost: Math.round(contextBoost * 100) / 100,
      freshnessBonus,
      final: result.relevance,
    };
  }

  return result;
}

// ============================================================================
// CONTEXT INJECTION
// ============================================================================

/**
 * Get memories relevant to current context for AI injection
 *
 * @example
 * ```typescript
 * const context = getContextMemories({
 *   project: 'piternow-wt-fix',
 *   currentFeature: 'booking',
 *   limit: 5,
 * });
 * // Returns formatted context for AI
 * ```
 */
export function getContextMemories(options: SmartSearchOptions): string {
  const results = smartSearch({
    ...options,
    minRelevance: 30,
    includeReasoning: false,
  });

  if (results.length === 0) {
    return '';
  }

  // Format as XML for AI consumption
  const lines: string[] = [];
  lines.push('<memory-context>');

  for (const result of results) {
    const { memory, relevance } = result;
    lines.push(
      `  <memory type="${memory.type}" relevance="${relevance}" importance="${memory.importance}">`,
    );
    lines.push(`    <title>${escapeXml(memory.title)}</title>`);
    lines.push(`    <description>${escapeXml(memory.description)}</description>`);

    if (memory.features && memory.features.length > 0) {
      lines.push(`    <features>${memory.features.join(', ')}</features>`);
    }

    if (memory.tags.length > 0) {
      lines.push(`    <tags>${memory.tags.join(', ')}</tags>`);
    }

    lines.push(`    <created>${formatRelativeTime(memory.createdAt)}</created>`);
    lines.push('  </memory>');
  }

  lines.push('</memory-context>');
  return lines.join('\n');
}

/**
 * Get high-priority memories that should always surface
 */
export function getCriticalMemories(project: string, limit = 3): SmartSearchResult[] {
  return smartSearch({
    project,
    importance: 'critical',
    limit,
    includeReasoning: false,
  });
}

/**
 * Get recent decisions for current context
 */
export function getRecentDecisions(
  project: string,
  feature?: string,
  limit = 5,
): SmartSearchResult[] {
  return smartSearch({
    project,
    type: 'decision',
    currentFeature: feature,
    limit,
    includeReasoning: false,
  });
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Format date as relative time
 */
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}
