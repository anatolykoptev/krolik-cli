/**
 * @module commands/refactor/analyzers/architecture/namespace/types
 * @description TypeScript interfaces for namespace analysis
 */

import type { DirectoryInfo } from '../../../core';

/**
 * Represents a single move operation in namespace migration
 */
export interface NamespaceMigrationMove {
  from: string;
  to: string;
  reason: string;
}

/**
 * Represents an import path update during namespace migration
 */
export interface NamespaceImportUpdate {
  oldPath: string;
  newPath: string;
}

/**
 * Complete migration plan for namespace organization
 */
export interface NamespaceMigrationPlan {
  moves: NamespaceMigrationMove[];
  importUpdates: NamespaceImportUpdate[];
  score: { before: number; after: number };
}

/**
 * Result of namespace structure analysis
 */
export interface NamespaceAnalysisResult {
  projectRoot: string;
  libDir: string | null;
  directories: DirectoryInfo[];
  currentScore: number;
  suggestedScore: number;
  plan: NamespaceMigrationPlan;
  timestamp: string;
}
