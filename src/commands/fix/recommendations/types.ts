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
  | 'async'
  | 'simplify';

/**
 * Recommendation severity
 */
export type RecommendationSeverity = 'suggestion' | 'recommendation' | 'best-practice';

/**
 * Result from check function with optional location info
 */
export interface CheckResult {
  detected: boolean;
  line?: number;
  snippet?: string;
  /** Suggested fix (before/after) */
  fix?: {
    before: string;
    after: string;
  };
}

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
  /** Custom check function - can return boolean or rich result with location */
  check?: (content: string, analysis: FileAnalysis) => boolean | CheckResult;
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
  /** Suggested fix (before/after) */
  fix?: {
    before: string;
    after: string;
  };
}
