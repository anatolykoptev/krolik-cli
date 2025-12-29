/**
 * @module commands/fix/fixers/duplicate
 * @description Duplicate function fixer
 *
 * Handles merging of duplicate functions detected by refactor analysis.
 * This fixer works with recommendations from `krolik refactor` and
 * delegates to the existing merge-handler infrastructure.
 *
 * Analysis is NOT performed here - duplicates are detected by refactor command.
 * This fixer only handles the fixing of pre-analyzed issues via --from-refactor.
 *
 * @see commands/refactor/analyzers/metrics/recommendations.ts
 * @see commands/refactor/migration/handlers/merge-handler.ts
 */

import { createFixerMetadata } from '../../core/registry';
import type { Fixer, FixOperation, QualityIssue } from '../../core/types';

// ============================================================================
// METADATA
// ============================================================================

export const metadata = createFixerMetadata('duplicate', 'Duplicate Functions', 'lint', {
  description: 'Merge duplicate functions from refactor analysis',
  difficulty: 'safe',
  cliFlag: '--fix-duplicate',
  tags: ['safe', 'refactoring', 'deduplication'],
});

// ============================================================================
// ANALYZER
// ============================================================================

/**
 * Analyze for duplicate functions
 *
 * NOTE: This fixer does NOT perform duplicate detection directly.
 * Duplicates are detected by refactor command's findDuplicates() function
 * using AST-based similarity analysis.
 *
 * When used with --from-refactor, issues are pre-populated from recommendations.
 * Direct analysis returns empty array to avoid redundant processing.
 *
 * @param _content - File content (unused - analysis done by refactor)
 * @param _file - File path (unused)
 * @returns Empty array - duplicates come from refactor analysis
 */
function analyzeDuplicates(_content: string, _file: string): QualityIssue[] {
  // Duplicate detection requires cross-file analysis which is done by refactor command.
  // This fixer only handles pre-analyzed issues from --from-refactor.
  return [];
}

// ============================================================================
// FIXER
// ============================================================================

/**
 * Fix duplicate function issue
 *
 * Delegates to refactor's merge infrastructure for actual merging.
 * Since duplicates involve multiple files, the fix operation uses
 * a special 'composite' pattern that the applier handles.
 *
 * @param issue - Duplicate function issue from refactor analysis
 * @param _content - Current file content (unused for duplicate fixes)
 * @returns Fix operation or null if cannot fix
 */
function fixDuplicate(issue: QualityIssue, _content: string): FixOperation | null {
  // Validate this is a duplicate issue
  if (!issue.message.includes('duplicate') && !issue.message.includes('Merge')) {
    return null;
  }

  // Extract function name from message (format: "Merge duplicate function: <name>")
  const nameMatch = issue.message.match(/function:\s*(\w+)/);
  const functionName = nameMatch?.[1] ?? 'unknown';

  // Parse affected files from snippet if available
  const affectedFiles = parseAffectedFiles(issue.snippet);

  // For duplicate merging, we need to:
  // 1. Keep one canonical location
  // 2. Update imports in all other locations
  // 3. Remove duplicate definitions
  //
  // This is a multi-file operation, so we return a composite operation
  // that the parallel executor will handle specially.

  if (affectedFiles.length < 2) {
    // Need at least 2 files to merge
    return null;
  }

  const [canonical, ...duplicates] = affectedFiles;

  return {
    action: 'replace-range', // Placeholder - actual merge uses migration handlers
    file: issue.file || canonical || '',
    oldCode: `// Duplicate: ${functionName}`,
    newCode: `// Merged to: ${canonical}`,
    // Store additional context for the executor
    // @ts-expect-error - extending FixOperation for composite handling
    _meta: {
      type: 'duplicate-merge',
      functionName,
      canonicalFile: canonical,
      duplicateFiles: duplicates,
      suggestion: issue.suggestion,
    },
  };
}

/**
 * Parse affected files from issue snippet
 *
 * Snippet format from recommendation-adapter:
 * ```
 * Affected files:
 *   - src/lib/utils/parse.ts
 *   - src/lib/domain/user/parse.ts
 * ```
 */
function parseAffectedFiles(snippet: string | undefined): string[] {
  if (!snippet) return [];

  const files: string[] = [];
  const lines = snippet.split('\n');

  for (const line of lines) {
    const match = line.match(/^\s*-\s*(.+)$/);
    if (match?.[1]) {
      files.push(match[1].trim());
    }
  }

  return files;
}

/**
 * Check if issue should be skipped
 *
 * Skip if:
 * - File is in node_modules
 * - File is a test file
 * - Issue doesn't have required context
 */
function shouldSkipDuplicate(issue: QualityIssue, _content: string): boolean {
  const file = issue.file;

  // Skip node_modules
  if (file.includes('node_modules')) return true;

  // Skip test files
  if (file.includes('.test.') || file.includes('.spec.')) return true;

  // Skip if no affected files context
  if (!issue.snippet?.includes('Affected files:')) return true;

  return false;
}

// ============================================================================
// EXPORT
// ============================================================================

export const duplicateFixer: Fixer = {
  metadata,
  analyze: analyzeDuplicates,
  fix: fixDuplicate,
  shouldSkip: shouldSkipDuplicate,
};
