/**
 * @module commands/quality/recommendations/checker
 * @description Recommendation checking logic
 */

import type { FileAnalysis } from '../core';
import { ALL_RECOMMENDATIONS } from './rules';
import type { Recommendation, RecommendationResult } from './types';

/**
 * Find line number and snippet for a pattern match
 */
function findMatchLocation(
  content: string,
  pattern: RegExp,
): { line: number; snippet: string } | undefined {
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    if (pattern.test(line)) {
      return {
        line: i + 1,
        snippet: line.trim().slice(0, 60),
      };
    }
  }

  return undefined;
}

/**
 * Check a single recommendation against content
 */
function checkSingleRecommendation(
  rec: Recommendation,
  content: string,
  analysis: FileAnalysis,
): RecommendationResult | null {
  let triggered = false;
  let location:
    | { line: number; snippet: string; fix?: { before: string; after: string } }
    | undefined;

  // Check using pattern
  if (rec.pattern) {
    rec.pattern.lastIndex = 0;
    if (rec.pattern.test(content)) {
      triggered = true;
      location = findMatchLocation(content, rec.pattern);
    }
  }

  // Check using anti-pattern
  if (rec.antiPattern && !triggered) {
    rec.antiPattern.lastIndex = 0;
    if (rec.antiPattern.test(content)) {
      triggered = true;
      location = findMatchLocation(content, rec.antiPattern);
    }
  }

  // Check using custom function
  if (rec.check && !triggered) {
    const checkResult = rec.check(content, analysis);
    // Handle rich CheckResult or simple boolean
    if (typeof checkResult === 'object') {
      triggered = checkResult.detected;
      if (checkResult.line || checkResult.snippet) {
        location = {
          line: checkResult.line ?? 0,
          snippet: checkResult.snippet ?? '',
          ...(checkResult.fix && { fix: checkResult.fix }),
        };
      }
    } else {
      triggered = checkResult;
    }
  }

  if (triggered) {
    return {
      recommendation: rec,
      file: analysis.relativePath,
      ...(location?.line !== undefined && location.line > 0 ? { line: location.line } : {}),
      ...(location?.snippet !== undefined && location.snippet ? { snippet: location.snippet } : {}),
      ...(location?.fix !== undefined ? { fix: location.fix } : {}),
    };
  }

  return null;
}

/**
 * Check file for all recommendations
 */
export function checkRecommendations(
  content: string,
  analysis: FileAnalysis,
): RecommendationResult[] {
  const results: RecommendationResult[] = [];

  for (const rec of ALL_RECOMMENDATIONS) {
    const result = checkSingleRecommendation(rec, content, analysis);
    if (result) {
      results.push(result);
    }
  }

  return results;
}

/**
 * Generate summary of recommendations by category
 */
export function summarizeRecommendations(
  results: RecommendationResult[],
): Record<string, { count: number; items: string[] }> {
  const summary: Record<string, { count: number; items: string[] }> = {};

  for (const result of results) {
    const cat = result.recommendation.category;
    if (!summary[cat]) {
      summary[cat] = { count: 0, items: [] };
    }
    summary[cat].count++;
    if (!summary[cat].items.includes(result.recommendation.title)) {
      summary[cat].items.push(result.recommendation.title);
    }
  }

  return summary;
}

/**
 * Get top recommendations sorted by frequency and severity
 */
export function getTopRecommendations(
  results: RecommendationResult[],
  limit: number = 10,
): Recommendation[] {
  // Count occurrences
  const counts = new Map<string, number>();
  for (const result of results) {
    const id = result.recommendation.id;
    counts.set(id, (counts.get(id) || 0) + 1);
  }

  // Sort by count and severity
  const severityOrder = { 'best-practice': 0, recommendation: 1, suggestion: 2 };
  const sorted = [...new Set(results.map((r) => r.recommendation))].sort((a, b) => {
    const countDiff = (counts.get(b.id) || 0) - (counts.get(a.id) || 0);
    if (countDiff !== 0) return countDiff;
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  return sorted.slice(0, limit);
}
