/**
 * @module commands/fix/core/types/analysis
 * @description Types for code quality analysis
 */

import type { QualityCategory, QualitySeverity } from './categories';

/**
 * A single quality issue found in a file
 */
export interface QualityIssue {
  file: string;
  line?: number;
  severity: QualitySeverity;
  category: QualityCategory;
  message: string;
  suggestion?: string;
  /** Code snippet for context */
  snippet?: string;
  /** Fixer ID that detected this issue */
  fixerId?: string;
}

/**
 * Suggested split point for complex functions
 */
export interface SplitSuggestion {
  /** Line number where extractable code starts */
  startLine: number;
  /** Line number where extractable code ends */
  endLine: number;
  /** Type of code block */
  type: 'if-block' | 'loop' | 'switch' | 'try-catch' | 'callback' | 'sequential';
  /** Suggested function name */
  suggestedName: string;
  /** Complexity this block contributes */
  complexity: number;
  /** Brief description */
  reason: string;
}

/**
 * Analysis of a single function
 */
export interface FunctionInfo {
  name: string;
  startLine: number;
  endLine: number;
  lines: number;
  params: number;
  isExported: boolean;
  isAsync: boolean;
  hasJSDoc: boolean;
  /** Cyclomatic complexity (branches count) */
  complexity: number;
  /** Suggested split points for refactoring */
  splitSuggestions?: SplitSuggestion[];
}

/**
 * Analysis of a single file
 */
export interface FileAnalysis {
  path: string;
  relativePath: string;
  lines: number;
  blankLines: number;
  commentLines: number;
  codeLines: number;
  functions: FunctionInfo[];
  exports: number;
  imports: number;
  /** File type classification */
  fileType: 'component' | 'hook' | 'util' | 'router' | 'schema' | 'test' | 'config' | 'unknown';
  issues: QualityIssue[];
}

/**
 * Hardcoded value detected
 */
export interface HardcodedValue {
  value: string | number;
  type: 'number' | 'string' | 'url' | 'color' | 'date';
  line: number;
  context: string;
}

/**
 * Recommendation result
 */
export interface RecommendationItem {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: 'suggestion' | 'recommendation' | 'best-practice';
  file: string;
  line: number | undefined;
  snippet: string | undefined;
  count: number;
  /** Suggested fix (before/after) */
  fix?: {
    before: string;
    after: string;
  };
}

/**
 * Overall quality report
 */
export interface QualityReport {
  timestamp: string;
  projectRoot: string;
  totalFiles: number;
  analyzedFiles: number;
  summary: {
    errors: number;
    warnings: number;
    infos: number;
    byCategory: Record<QualityCategory, number>;
  };
  files: FileAnalysis[];
  /** Top issues sorted by severity */
  topIssues: QualityIssue[];
  /** Files that need refactoring */
  needsRefactoring: Array<{
    file: string;
    reason: string;
    suggestions: string[];
  }>;
  /** Airbnb-style recommendations */
  recommendations: RecommendationItem[];
}
