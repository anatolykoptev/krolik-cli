/**
 * @module types/commands/review
 * @description Review command result types
 */

import type { QualitySeverity } from '../../commands/fix/types';

// Type alias for backwards compatibility (ReviewSeverity = QualitySeverity)
export type ReviewSeverity = QualitySeverity;

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
}
