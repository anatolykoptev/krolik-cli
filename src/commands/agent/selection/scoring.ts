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

  const scored = await Promise.all(
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

  // Total raw score (0-115), normalize to 0-100
  const rawTotal = keywordMatch + semanticMatch + contextBoost + historyBoost + freshnessBonus;
  const total = Math.round((rawTotal / 115) * 100);

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

/**
 * Score semantic match using embeddings (0-15 points)
 *
 * Note: MiniLM-L6-v2 produces lower similarity scores for short texts.
 * Thresholds are calibrated for agent description matching:
 *
 * Similarity thresholds:
 * - 0.50+ = 15 points (very similar)
 * - 0.35-0.50 = 10 points (similar)
 * - 0.25-0.35 = 5 points (somewhat similar)
 * - <0.25 = 0 points (not similar enough)
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
  const similarity = await calculateSemanticSimilarity(
    taskEmbedding,
    agent.name,
    agent.description,
    agent.embedding, // Pre-computed from capabilities index
  );

  // No agent embedding available
  if (similarity === 0) {
    return { score: 0, similarity: undefined };
  }

  // Score based on similarity thresholds (calibrated for MiniLM-L6-v2)
  let score = 0;
  if (similarity > 0.5) {
    score = 15;
  } else if (similarity > 0.35) {
    score = 10;
  } else if (similarity > 0.25) {
    score = 5;
  }

  return { score, similarity };
}

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
  const matchedKeywords: string[] = [];
  let score = 0;

  // Match against agent keywords (word boundary, skip stopwords)
  for (const kw of keywords) {
    // Skip stopwords - they inflate scores without relevance
    if (isStopword(kw)) continue;

    // Use word boundary match instead of substring
    if (containsWholeWord(task, kw)) {
      matchedKeywords.push(kw);
      score += 8;
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
    // Skip already matched keywords
    if (matchedKeywords.includes(word)) continue;

    // Use word boundary match
    if (containsWholeWord(task, word)) {
      descMatches++;
      if (descMatches <= 4) {
        score += 2;
      }
    }
  }

  // Also check agent name match (word boundary, skip stopwords)
  const agentNameParts = description
    .split(/[-\s]+/)
    .filter((p) => p.length > 2 && !isStopword(p))
    .map((p) => p.toLowerCase());

  for (const part of agentNameParts) {
    if (matchedKeywords.includes(part)) continue;

    if (containsWholeWord(task, part)) {
      matchedKeywords.push(part);
      score += 4;
    }
  }

  return {
    score: Math.min(score, 40),
    matchedKeywords,
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
      score += 5;
      if (matchedTechStack.length >= 3) break; // Cap at 3 matches
    }
  }

  // Project type match (15 points)
  if (agent.projectTypes.includes(profile.type)) {
    score += 15;
  } else if (agent.projectTypes.includes('fullstack')) {
    // Fullstack agents get partial credit
    score += 8;
  }

  return {
    score: Math.min(score, 30),
    matchedTechStack,
  };
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
  const hist = history.get(agent.name);
  if (!hist) return 0;

  // Base score from success history (0-15)
  let score = hist.successScore * 0.15;

  // Feature match bonus (5 points)
  if (
    currentFeature &&
    hist.features.some((f) => f.toLowerCase().includes(currentFeature.toLowerCase()))
  ) {
    score += 5;
  }

  return Math.min(score, 20);
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
  const hist = history.get(agent.name);
  if (!hist) return 0;

  // Agents used recently get bonus
  if (hist.recentUses > 5) return 10;
  if (hist.recentUses > 2) return 7;
  if (hist.recentUses > 0) return 4;

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
