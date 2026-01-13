/**
 * @module commands/agent/selection/scoring
 * @description Smart scoring system for agent selection
 *
 * Scoring breakdown:
 * - Keyword match: 0-40 points
 * - Semantic match: 0-15 points (NEW - uses embeddings)
 * - Context boost: 0-30 points
 * - History boost: 0-20 points
 * - Freshness bonus: 0-10 points
 * Total: 0-100 points (normalized from 0-115)
 */

import type { ProjectProfile } from '@/lib/@context/project-profile';
import { logger } from '@/lib/@core/logger';
import type { AgentCapabilities } from '../capabilities/types';
import { calculateSemanticSimilarity } from './embeddings';
import type { AgentSuccessHistory } from './history';

/**
 * Stopwords to exclude from keyword matching
 * These common words inflate scores without adding relevance
 */
const STOPWORDS = new Set([
  // English
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'from',
  'have',
  'will',
  'can',
  'use',
  'your',
  'all',
  'any',
  'how',
  'when',
  'what',
  'which',
  'are',
  'was',
  'were',
  'been',
  'being',
  'has',
  'had',
  'does',
  'did',
  'but',
  'not',
  'you',
  'they',
  'them',
  'their',
  'its',
  'into',
  'over',
  'such',
  'only',
  'other',
  'than',
  'then',
  'also',
  'just',
  'more',
  'some',
  'could',
  'would',
  'should',
  'about',
  'after',
  'before',
  // Common tech stopwords
  'code',
  'file',
  'data',
  'make',
  'like',
  'work',
  'need',
  'want',
]);

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check if word is a stopword
 */
function isStopword(word: string): boolean {
  return STOPWORDS.has(word.toLowerCase());
}

/**
 * Check if task contains keyword as whole word (word boundary match)
 */
function containsWholeWord(text: string, word: string): boolean {
  const pattern = new RegExp(`\\b${escapeRegex(word)}\\b`, 'i');
  return pattern.test(text);
}

/**
 * Score breakdown for transparency
 */
export interface ScoreBreakdown {
  /** Keyword match score (0-40) */
  keywordMatch: number;
  /** Semantic match score (0-15) - uses embeddings */
  semanticMatch: number;
  /** Context boost score (0-30) */
  contextBoost: number;
  /** History boost score (0-20) */
  historyBoost: number;
  /** Freshness bonus (0-10) */
  freshnessBonus: number;
  /** Total score (0-100, normalized) */
  total: number;
  /** Matched keywords for transparency */
  matchedKeywords: string[];
  /** Matched tech stack for transparency */
  matchedTechStack: string[];
  /** Semantic similarity score (0-1) for debugging */
  semanticSimilarity?: number | undefined;
}

/**
 * Scored agent with breakdown
 */
export interface ScoredAgent {
  /** Agent capabilities */
  agent: AgentCapabilities;
  /** Total score */
  score: number;
  /** Score breakdown */
  breakdown: ScoreBreakdown;
}

/**
 * Score all agents against a task
 *
 * @param task - Task description
 * @param capabilities - All agent capabilities
 * @param projectProfile - Project profile for context boosting
 * @param history - Agent success history for history boosting
 * @param currentFeature - Optional current feature for extra boosting
 * @param taskEmbedding - Pre-computed task embedding for semantic matching
 * @returns Sorted array of scored agents (highest first)
 */
export async function scoreAgents(
  task: string,
  capabilities: AgentCapabilities[],
  projectProfile: ProjectProfile,
  history: Map<string, AgentSuccessHistory>,
  currentFeature?: string,
  taskEmbedding?: Float32Array | null,
): Promise<ScoredAgent[]> {
  const normalizedTask = task.toLowerCase();

  // Use Promise.allSettled to handle individual agent scoring failures gracefully
  const results = await Promise.allSettled(
    capabilities.map(async (agent) => {
      const breakdown = await calculateScoreBreakdown(
        agent,
        normalizedTask,
        taskEmbedding ?? null,
        projectProfile,
        history,
        currentFeature,
      );

      return {
        agent,
        score: breakdown.total,
        breakdown,
      };
    }),
  );

  // Filter out rejected promises and extract successful results
  const scored: ScoredAgent[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      scored.push(result.value);
    } else {
      // Log rejection for debugging (agent name not available in rejection)
      logger.debug(
        `Agent scoring failed: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`,
      );
    }
  }

  // Sort by score descending
  return scored.sort((a, b) => b.score - a.score);
}

/**
 * Calculate full score breakdown for an agent
 */
async function calculateScoreBreakdown(
  agent: AgentCapabilities,
  normalizedTask: string,
  taskEmbedding: Float32Array | null,
  profile: ProjectProfile,
  history: Map<string, AgentSuccessHistory>,
  currentFeature?: string,
): Promise<ScoreBreakdown> {
  const { score: keywordMatch, matchedKeywords } = scoreKeywordMatch(
    agent.keywords,
    agent.description,
    normalizedTask,
  );

  // Semantic match using embeddings (0-15 points)
  const { score: semanticMatch, similarity: semanticSimilarity } = await scoreSemanticMatch(
    agent,
    taskEmbedding,
  );

  const { score: contextBoost, matchedTechStack } = scoreContextMatch(agent, profile);

  const historyBoost = scoreHistory(agent, history, currentFeature);
  const freshnessBonus = scoreFreshness(agent, history);

  // Total raw score, normalize to 0-100
  const rawTotal = keywordMatch + semanticMatch + contextBoost + historyBoost + freshnessBonus;
  const total = Math.round((rawTotal / MAX_RAW_SCORE) * 100);

  return {
    keywordMatch: Math.round(keywordMatch),
    semanticMatch: Math.round(semanticMatch),
    contextBoost: Math.round(contextBoost),
    historyBoost: Math.round(historyBoost),
    freshnessBonus: Math.round(freshnessBonus),
    total: Math.min(total, 100),
    matchedKeywords,
    matchedTechStack,
    semanticSimilarity,
  };
}

// ============================================================================
// SCORING THRESHOLDS (calibrated for MiniLM-L6-v2)
// ============================================================================

/**
 * Semantic similarity thresholds for scoring
 * Calibrated for MiniLM-L6-v2 model with short technical texts
 */
const SEMANTIC_THRESHOLDS = {
  /** Very similar - agent highly relevant to task */
  HIGH: 0.5,
  /** Similar - agent relevant to task */
  MEDIUM: 0.35,
  /** Somewhat similar - agent might be relevant */
  LOW: 0.25,
} as const;

/** Points awarded for each semantic similarity tier */
const SEMANTIC_SCORES = {
  HIGH: 15,
  MEDIUM: 10,
  LOW: 5,
  NONE: 0,
} as const;

/**
 * Score semantic match using embeddings (0-15 points)
 *
 * Note: MiniLM-L6-v2 produces lower similarity scores for short texts.
 * Thresholds are calibrated for agent description matching.
 *
 * Performance: Uses pre-computed embeddings from capabilities index
 * when available (instant), falls back to on-demand generation (~7ms).
 */
async function scoreSemanticMatch(
  agent: AgentCapabilities,
  taskEmbedding: Float32Array | null,
): Promise<{ score: number; similarity: number | undefined }> {
  // No task embedding = no semantic score (graceful fallback)
  if (!taskEmbedding) {
    return { score: 0, similarity: undefined };
  }

  // Pass pre-computed embedding if available (instant path)
  const result = await calculateSemanticSimilarity(
    taskEmbedding,
    agent.name,
    agent.description,
    agent.embedding, // Pre-computed from capabilities index
  );

  // No embedding available (null means unavailable, 0 is valid similarity)
  if (result.similarity === null) {
    return { score: 0, similarity: undefined };
  }

  const similarity = result.similarity;

  // Score based on similarity thresholds (calibrated for MiniLM-L6-v2)
  let score = SEMANTIC_SCORES.NONE;
  if (similarity > SEMANTIC_THRESHOLDS.HIGH) {
    score = SEMANTIC_SCORES.HIGH;
  } else if (similarity > SEMANTIC_THRESHOLDS.MEDIUM) {
    score = SEMANTIC_SCORES.MEDIUM;
  } else if (similarity > SEMANTIC_THRESHOLDS.LOW) {
    score = SEMANTIC_SCORES.LOW;
  }

  return { score, similarity };
}

/** Points awarded for keyword matches */
const KEYWORD_SCORES = {
  /** Direct keyword match */
  KEYWORD: 8,
  /** Description word match */
  DESCRIPTION: 2,
  /** Agent name part match */
  NAME_PART: 4,
  /** Maximum total keyword score */
  MAX: 40,
  /** Maximum description matches to score */
  MAX_DESC_MATCHES: 4,
} as const;

/** Context scoring constants */
const CONTEXT_SCORES = {
  /** Points per tech stack match */
  TECH_STACK: 5,
  /** Maximum tech stack matches */
  MAX_TECH_MATCHES: 3,
  /** Project type exact match */
  PROJECT_TYPE: 15,
  /** Fullstack agent partial credit */
  FULLSTACK_PARTIAL: 8,
  /** Maximum context score */
  MAX: 30,
} as const;

/** History scoring constants */
const HISTORY_SCORES = {
  /** Multiplier for success score (0.15 = 15% of successScore) */
  SUCCESS_MULTIPLIER: 0.15,
  /** Feature match bonus */
  FEATURE_MATCH: 5,
  /** Maximum history score */
  MAX: 20,
} as const;

/** Freshness scoring constants */
const FRESHNESS_SCORES = {
  /** High recent usage (>5 uses) */
  HIGH: 10,
  /** Medium recent usage (>2 uses) */
  MEDIUM: 7,
  /** Low recent usage (>0 uses) */
  LOW: 4,
  /** Maximum freshness score */
  MAX: 10,
} as const;

/**
 * Maximum possible raw score before normalization.
 * Calculated from individual score maximums.
 */
const MAX_RAW_SCORE =
  KEYWORD_SCORES.MAX +
  SEMANTIC_SCORES.HIGH +
  CONTEXT_SCORES.MAX +
  HISTORY_SCORES.MAX +
  FRESHNESS_SCORES.MAX; // 40 + 15 + 30 + 20 + 10 = 115

/**
 * Score keyword match (0-40 points)
 *
 * - Direct keyword match: 8 points each (max 5 matches = 40)
 * - Description word match: 2 points each (capped at 8)
 *
 * Uses word boundary matching and filters out stopwords
 */
function scoreKeywordMatch(
  keywords: string[],
  description: string,
  task: string,
): { score: number; matchedKeywords: string[] } {
  // Use Set for O(1) lookups instead of array.includes() which is O(n)
  const matchedKeywordsSet = new Set<string>();
  let score = 0;

  // Match against agent keywords (word boundary, skip stopwords)
  for (const kw of keywords) {
    // Skip stopwords - they inflate scores without relevance
    if (isStopword(kw)) continue;

    // Use word boundary match instead of substring
    if (containsWholeWord(task, kw)) {
      matchedKeywordsSet.add(kw);
      score += KEYWORD_SCORES.KEYWORD;
    }
  }

  // Match against description words (lower weight)
  // Filter: length > 3, not a stopword, word boundary match
  const descWords = description
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3 && !isStopword(w));

  let descMatches = 0;

  for (const word of descWords) {
    // Skip already matched keywords (O(1) with Set)
    if (matchedKeywordsSet.has(word)) continue;

    // Use word boundary match
    if (containsWholeWord(task, word)) {
      descMatches++;
      if (descMatches <= KEYWORD_SCORES.MAX_DESC_MATCHES) {
        score += KEYWORD_SCORES.DESCRIPTION;
      }
    }
  }

  // Also check agent name match (word boundary, skip stopwords)
  const agentNameParts = description
    .split(/[-\s]+/)
    .filter((p) => p.length > 2 && !isStopword(p))
    .map((p) => p.toLowerCase());

  for (const part of agentNameParts) {
    // O(1) lookup with Set
    if (matchedKeywordsSet.has(part)) continue;

    if (containsWholeWord(task, part)) {
      matchedKeywordsSet.add(part);
      score += KEYWORD_SCORES.NAME_PART;
    }
  }

  return {
    score: Math.min(score, KEYWORD_SCORES.MAX),
    matchedKeywords: Array.from(matchedKeywordsSet),
  };
}

/**
 * Score context match (0-30 points)
 *
 * - Tech stack match: 5 points each (max 15)
 * - Project type match: 15 points
 */
function scoreContextMatch(
  agent: AgentCapabilities,
  profile: ProjectProfile,
): { score: number; matchedTechStack: string[] } {
  let score = 0;
  const matchedTechStack: string[] = [];

  // Tech stack match (15 points max)
  for (const tech of agent.techStack) {
    if (profile.techStack.includes(tech)) {
      matchedTechStack.push(tech);
      score += CONTEXT_SCORES.TECH_STACK;
      if (matchedTechStack.length >= CONTEXT_SCORES.MAX_TECH_MATCHES) break;
    }
  }

  // Project type match
  if (agent.projectTypes.includes(profile.type)) {
    score += CONTEXT_SCORES.PROJECT_TYPE;
  } else if (agent.projectTypes.includes('fullstack')) {
    // Fullstack agents get partial credit
    score += CONTEXT_SCORES.FULLSTACK_PARTIAL;
  }

  return {
    score: Math.min(score, CONTEXT_SCORES.MAX),
    matchedTechStack,
  };
}

/**
 * Get agent history entry (helper to avoid repeated lookups)
 */
function getAgentHistory(
  agent: AgentCapabilities,
  history: Map<string, AgentSuccessHistory>,
): AgentSuccessHistory | undefined {
  return history.get(agent.name);
}

/**
 * Score history boost (0-20 points)
 *
 * - Success score contribution: 0-15 points
 * - Feature match bonus: 5 points
 */
function scoreHistory(
  agent: AgentCapabilities,
  history: Map<string, AgentSuccessHistory>,
  currentFeature?: string,
): number {
  const hist = getAgentHistory(agent, history);
  if (!hist) return 0;

  // Base score from success history (0-15)
  let score = hist.successScore * HISTORY_SCORES.SUCCESS_MULTIPLIER;

  // Feature match bonus
  if (
    currentFeature &&
    hist.features.some((f) => f.toLowerCase().includes(currentFeature.toLowerCase()))
  ) {
    score += HISTORY_SCORES.FEATURE_MATCH;
  }

  return Math.min(score, HISTORY_SCORES.MAX);
}

/**
 * Score freshness bonus (0-10 points)
 *
 * Recent usage indicates relevance
 */
function scoreFreshness(
  agent: AgentCapabilities,
  history: Map<string, AgentSuccessHistory>,
): number {
  const hist = getAgentHistory(agent, history);
  if (!hist) return 0;

  // Agents used recently get bonus (tiered)
  if (hist.recentUses > 5) return FRESHNESS_SCORES.HIGH;
  if (hist.recentUses > 2) return FRESHNESS_SCORES.MEDIUM;
  if (hist.recentUses > 0) return FRESHNESS_SCORES.LOW;

  return 0;
}

/**
 * Filter agents by minimum score
 */
export function filterByMinScore(scored: ScoredAgent[], minScore: number): ScoredAgent[] {
  return scored.filter((s) => s.score >= minScore);
}

/**
 * Get top N agents
 */
export function getTopAgents(scored: ScoredAgent[], limit: number): ScoredAgent[] {
  return scored.slice(0, limit);
}

/**
 * Format score breakdown as human-readable string
 */
export function formatScoreBreakdown(breakdown: ScoreBreakdown): string {
  const parts: string[] = [];

  if (breakdown.keywordMatch > 0) {
    parts.push(`Keyword: ${breakdown.keywordMatch}`);
  }
  if (breakdown.semanticMatch > 0) {
    const sim = breakdown.semanticSimilarity
      ? ` (${(breakdown.semanticSimilarity * 100).toFixed(0)}%)`
      : '';
    parts.push(`Semantic: ${breakdown.semanticMatch}${sim}`);
  }
  if (breakdown.contextBoost > 0) {
    parts.push(`Context: ${breakdown.contextBoost}`);
  }
  if (breakdown.historyBoost > 0) {
    parts.push(`History: ${breakdown.historyBoost}`);
  }
  if (breakdown.freshnessBonus > 0) {
    parts.push(`Fresh: ${breakdown.freshnessBonus}`);
  }

  return `${parts.join(' + ')} = ${breakdown.total}`;
}
