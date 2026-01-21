/**
 * @module commands/refactor/analyzers/modules/dead-code.analyzer
 * @description Dead Code Analyzer for the registry-based architecture
 *
 * Detects unused code that can be safely removed:
 * - Unused imports
 * - Unused variables (future)
 * - Unreachable code (future)
 *
 * **PERFORMANCE:** Reuses audit's unused-imports analyzer (ts-morph based).
 * No external dependencies (Biome) required.
 *
 * @example
 * ```typescript
 * import { deadCodeAnalyzer } from './modules/dead-code.analyzer';
 * import { analyzerRegistry } from '../registry';
 *
 * // Register the analyzer
 * analyzerRegistry.register(deadCodeAnalyzer);
 *
 * // Run with context
 * const results = await analyzerRegistry.runAll(ctx);
 * const deadCodeResult = results.get('dead-code');
 * ```
 */

import { glob } from 'glob';
import { analyzeUnusedImports } from '@/commands/fix/fixers/unused-imports';
import { fileCache } from '@/lib/@cache';
import { getIgnorePatterns } from '@/lib/@core/constants';
import type { Analyzer } from '../registry';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Type of dead code detected
 */
export type DeadCodeType = 'unused-import' | 'unused-variable' | 'unreachable-code';

/**
 * A dead code issue
 */
export interface DeadCodeIssue {
  /** Type of dead code */
  type: DeadCodeType;
  /** Absolute file path */
  file: string;
  /** Line number (1-based) */
  line: number;
  /** Column number (1-based), undefined if unknown */
  column: number | undefined;
  /** The identifier that is unused */
  identifier: string;
  /** Human-readable message */
  message: string;
  /** Can be automatically fixed */
  autoFixable: boolean;
}

/**
 * Dead code analysis result
 */
export interface DeadCodeAnalysis {
  /** All dead code issues found */
  issues: DeadCodeIssue[];
  /** Issues grouped by type */
  byType: {
    'unused-import': DeadCodeIssue[];
    'unused-variable': DeadCodeIssue[];
    'unreachable-code': DeadCodeIssue[];
  };
  /** Issues grouped by file */
  byFile: Map<string, DeadCodeIssue[]>;
  /** Summary counts */
  summary: {
    total: number;
    unusedImports: number;
    unusedVariables: number;
    unreachableCode: number;
    autoFixable: number;
  };
  /** Detection method used */
  method: 'ts-morph' | 'skipped';
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Extract identifier name from quality issue message
 *
 * Message formats:
 * - "Unused import: entire import from 'module' is unused"
 * - "Unused import: 'identifier' from 'module'"
 *
 * @param message - The quality issue message
 * @returns The extracted identifier or 'unknown'
 */
function extractIdentifier(message: string): string {
  // Try to extract from quoted identifier: 'identifier'
  const match = message.match(/'([^']+)'/);
  if (match?.[1]) {
    return match[1];
  }

  // Handle "entire import" case
  if (message.includes('entire import')) {
    return '*';
  }

  return 'unknown';
}

// ============================================================================
// DEAD CODE ANALYZER
// ============================================================================

/**
 * Analyzer for detecting dead code (unused imports).
 *
 * **REUSES AUDIT ANALYZER:** Uses the production-ready unused-imports analyzer
 * from the audit command. No external dependencies required.
 *
 * Features:
 * - Fast detection via ts-morph AST
 * - Production-ready (already used in krolik audit)
 * - Auto-fix capability via audit's fixer
 * - Incremental cache support
 * - Groups issues by file for easy remediation
 *
 * Future: Can be extended to detect unused variables and unreachable code.
 */
export const deadCodeAnalyzer: Analyzer<DeadCodeAnalysis> = {
  metadata: {
    id: 'dead-code',
    name: 'Dead Code Detection',
    description: 'Detects unused imports via ts-morph AST analysis',
    defaultEnabled: true,
    // No dependencies - independent analyzer
  },

  /**
   * Determines if the analyzer should run.
   *
   * Always runs unless explicitly disabled.
   *
   * @param ctx - The analyzer context
   * @returns true unless explicitly disabled
   */
  shouldRun(ctx) {
    return ctx.options.includeDeadCode !== false;
  },

  /**
   * Detects dead code in the project using audit's unused-imports analyzer.
   *
   * @param ctx - The analyzer context
   * @returns Promise resolving to the analysis result
   */
  async analyze(ctx) {
    const { targetPath } = ctx;

    try {
      // Find all TypeScript files
      const ignore = getIgnorePatterns({ includeTests: false });
      const files = await glob('**/*.{ts,tsx}', {
        cwd: targetPath,
        ignore,
        absolute: true,
      });

      if (files.length === 0) {
        return {
          status: 'success',
          data: {
            issues: [],
            byType: {
              'unused-import': [],
              'unused-variable': [],
              'unreachable-code': [],
            },
            byFile: new Map(),
            summary: {
              total: 0,
              unusedImports: 0,
              unusedVariables: 0,
              unreachableCode: 0,
              autoFixable: 0,
            },
            method: 'ts-morph',
          },
        };
      }

      const allIssues: DeadCodeIssue[] = [];

      // Analyze each file for unused imports
      for (const file of files) {
        // Read file content (using cache)
        const content = fileCache.get(file);

        // Run audit's unused-imports analyzer
        const qualityIssues = analyzeUnusedImports(content, file);

        // Convert quality issues to dead code issues
        for (const issue of qualityIssues) {
          const identifier = extractIdentifier(issue.message);

          allIssues.push({
            type: 'unused-import',
            file: issue.file,
            line: issue.line ?? 1,
            column: undefined, // ts-morph doesn't provide column
            identifier,
            message: issue.message,
            autoFixable: true, // Unused imports can be auto-removed
          });
        }
      }

      // Group by type
      const byType: DeadCodeAnalysis['byType'] = {
        'unused-import': [],
        'unused-variable': [],
        'unreachable-code': [],
      };

      // Group by file
      const byFile = new Map<string, DeadCodeIssue[]>();

      for (const issue of allIssues) {
        byType[issue.type].push(issue);

        const fileIssues = byFile.get(issue.file) ?? [];
        fileIssues.push(issue);
        byFile.set(issue.file, fileIssues);
      }

      const autoFixableCount = allIssues.filter((i) => i.autoFixable).length;

      return {
        status: 'success',
        data: {
          issues: allIssues,
          byType,
          byFile,
          summary: {
            total: allIssues.length,
            unusedImports: byType['unused-import'].length,
            unusedVariables: 0, // Not implemented yet
            unreachableCode: 0, // Not implemented yet
            autoFixable: autoFixableCount,
          },
          method: 'ts-morph',
        },
      };
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to analyze unused imports',
      };
    }
  },
};
