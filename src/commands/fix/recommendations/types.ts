/**
 * @module commands/quality/recommendations/types
 * @description Types for recommendations system
 */

import type { FileAnalysis } from '../core';

/**
 * Recommendation category
 */
export type RecommendationCategory =
  | 'naming'
  | 'structure'
  | 'typescript'
  | 'react'
  | 'performance'
  | 'imports'
  | 'testing'
  | 'security'
  | 'async';

/**
 * Recommendation severity
 */
export type RecommendationSeverity = 'suggestion' | 'recommendation' | 'best-practice';

/**
 * A single recommendation rule
 */
export interface Recommendation {
  id: string;
  title: string;
  description: string;
  category: RecommendationCategory;
  severity: RecommendationSeverity;
  /** Pattern that triggers the recommendation */
  pattern?: RegExp;
  /** Anti-pattern that triggers the recommendation */
  antiPattern?: RegExp;
  /** Custom check function */
  check?: (content: string, analysis: FileAnalysis) => boolean;
  /** Link to documentation */
  link?: string;
}

/**
 * Result of checking a recommendation
 */
export interface RecommendationResult {
  recommendation: Recommendation;
  file: string;
  line?: number;
  snippet?: string;
}
