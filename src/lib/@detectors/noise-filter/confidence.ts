/**
 * @module lib/@detectors/noise-filter/confidence
 * @description Stage 3: Confidence scoring for findings
 *
 * Scoring factors:
 * - Ownership: user (1.0), generated (0.1), vendor (0.0)
 * - Freshness: recently modified (1.2x), stale (1.0x)
 * - Relevance: matches feature (1.5x), neutral (1.0x)
 * - Quality: specific (1.0), moderate (0.6), generic (0.3)
 * - Actionability: has fixer (1.3x), manual (1.0x)
 */

import type { Finding, ScoredFinding, ScoringBreakdown, ScoringContext } from './types';

/** Generic TODO patterns (low quality) */
const GENERIC_PATTERNS = [
  /^implement$/i,
  /^fix$/i,
  /^todo$/i,
  /^later$/i,
  /^wip$/i,
  /^add tests?$/i,
  /^needs? implementation$/i,
];

/** Types that typically have auto-fixers */
const FIXABLE_TYPES = ['console', 'any', 'hardcoded', 'lint'];

/** Check if TODO text is generic (low quality) */
export function isGenericTodo(text: string): boolean {
  const trimmed = text.trim();
  return GENERIC_PATTERNS.some((p) => p.test(trimmed));
}

/** Calculate quality score: 0.3 (generic), 0.6 (moderate), 1.0 (specific) */
export function calculateQuality(text: string): number {
  if (isGenericTodo(text)) return 0.3;
  const trimmed = text.trim();
  if (trimmed.length < 15 || /^[a-z]+\s+[a-z]+$/i.test(trimmed)) return 0.6;
  return 1.0;
}

/** Determine ownership score from file path */
function getOwnership(path: string): number {
  if (path.includes('node_modules/')) return 0.0;
  if (path.includes('/generated/') || path.includes('__generated__')) return 0.1;
  return 1.0;
}

/** Calculate freshness multiplier */
function getFreshness(path: string, recentFiles?: string[]): number {
  return recentFiles?.includes(path) ? 1.2 : 1.0;
}

/** Calculate relevance multiplier based on feature context */
function getRelevance(path: string, text: string, feature?: string): number {
  if (!feature) return 1.0;
  const lf = feature.toLowerCase();
  return path.toLowerCase().includes(lf) || text.toLowerCase().includes(lf) ? 1.5 : 1.0;
}

/** Calculate actionability multiplier */
function getActionability(type?: string): number {
  return type && FIXABLE_TYPES.some((t) => type.includes(t)) ? 1.3 : 1.0;
}

/** Score a single finding */
function scoreFinding<T extends Finding>(finding: T, ctx?: ScoringContext): ScoredFinding<T> {
  const ownership = getOwnership(finding.file);
  const freshness = getFreshness(finding.file, ctx?.recentFiles);
  const relevance = getRelevance(finding.file, finding.text, ctx?.feature);
  const quality = calculateQuality(finding.text);
  const actionability = getActionability(finding.type);

  const factors: ScoringBreakdown = { ownership, freshness, relevance, quality, actionability };

  // Final score: base (ownership * quality) * multipliers
  const score = ownership * quality * freshness * relevance * actionability;
  const confidence = Math.min(ownership * quality, 1.0);
  const relevanceScore = relevance > 1.0 ? 1.0 : 0.5;

  return { finding, score, confidence, relevance: relevanceScore, factors };
}

/**
 * Score and rank findings based on multiple factors
 * @param findings - Array of findings to score
 * @param context - Optional scoring context (feature, recent files)
 * @returns Scored findings sorted by score (highest first)
 */
export function scoreFindings<T extends Finding>(
  findings: T[],
  context?: ScoringContext,
): ScoredFinding<T>[] {
  return findings.map((f) => scoreFinding(f, context)).sort((a, b) => b.score - a.score);
}
