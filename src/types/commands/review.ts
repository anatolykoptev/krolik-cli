/**
 * @module types/commands/review
 * @description Review command result types
 */

import type { Severity } from '../severity';

// Type alias for backwards compatibility (ReviewSeverity = Severity)
export type ReviewSeverity = Severity;

/**
 * Review issue categories
 */
export type ReviewCategory = 'security' | 'performance' | 'style' | 'logic' | 'test' | 'docs';

/**
 * Single review issue
 */
export interface ReviewIssue {
  file: string;
  line?: number;
  severity: ReviewSeverity;
  category: ReviewCategory;
  message: string;
  suggestion?: string;
}

/**
 * File change information
 */
export interface FileChange {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  binary: boolean;
}

/**
 * Documentation reference from library docs cache
 */
export interface DocReference {
  library: string;
  title: string;
  snippet: string;
}

/**
 * Review result
 */
export interface ReviewResult {
  title: string;
  description: string;
  baseBranch: string;
  headBranch: string;
  files: FileChange[];
  issues: ReviewIssue[];
  affectedFeatures: string[];
  summary: {
    totalFiles: number;
    additions: number;
    deletions: number;
    riskLevel: 'low' | 'medium' | 'high';
    testsRequired: boolean;
    docsRequired: boolean;
  };
  /** Relevant documentation references from cached library docs */
  docsReferences?: DocReference[];
}
