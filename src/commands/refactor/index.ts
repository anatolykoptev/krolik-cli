/**
 * @module commands/refactor
 * @description Analyze and refactor module structure
 *
 * Features:
 * - Detect duplicate functions using AST analysis
 * - Detect duplicate types/interfaces by structure comparison
 * - Analyze module structure for consistency
 * - Generate migration plan with import updates
 * - Apply migrations safely with rollback support
 * - AI-native output with dependency graphs and navigation hints
 *
 * Usage:
 *   krolik refactor                    # Analyze lib/
 *   krolik refactor --path src/utils   # Analyze specific path
 *   krolik refactor --duplicates-only  # Only find function duplicates
 *   krolik refactor --types-only       # Only find type/interface duplicates
 *   krolik refactor --include-types    # Include type duplicates in analysis
 *   krolik refactor --structure-only   # Only analyze structure
 *   krolik refactor --dry-run          # Show plan without applying
 *   krolik refactor --apply            # Apply migrations
 *   krolik refactor --ai               # AI-native output (default for XML)
 */

// Re-export from analyzers
export {
  analyzeStructure,
  findDuplicates,
  findTypeDuplicates,
  visualizeStructure,
} from './analyzers';
// Command handler
export { refactorCommand } from './command';
// Re-export types from core
export type * from './core';
// Re-export from migration
export {
  createMigrationPlan,
  createTypeMigrationPlan,
  executeMigrationPlan,
  executeTypeMigrationPlan,
} from './migration';
// Re-export from output
export { formatAiNativeXml, formatMigrationPreview, formatRefactor } from './output';
// Path resolution
export {
  findLibPath,
  type ResolvedPathsWithPackage,
  resolveLibPath,
  resolvePackagePaths,
  resolvePaths,
} from './paths';
// Runner functions
export {
  applyMigrations,
  applyTypeFixes,
  type MigrationOptions,
  type MigrationResult,
  printAnalysis,
  runRefactor,
  type TypeFixOptions,
  type TypeFixResult,
} from './runner';
// Utility functions
export { printSummaryReport, runTypecheck, type TypecheckResult } from './utils';
