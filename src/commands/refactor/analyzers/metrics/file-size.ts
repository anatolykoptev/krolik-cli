/**
 * @module commands/refactor/analyzers/metrics/file-size
 * @description Analyze file sizes to detect oversized files
 *
 * Detects files that are too large and should be split:
 * - Warning: 300+ lines (consider splitting)
 * - Error: 500+ lines (should split)
 * - Critical: 800+ lines (must split immediately)
 *
 * Large files indicate:
 * - Single Responsibility Principle violations
 * - Poor modularity
 * - Maintenance difficulties
 * - Hard to test and review
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { globSync } from 'glob';
import type { FileSizeAnalysis, FileSizeIssue, FileSizeSeverity } from '../../core/types-ai';

// ============================================================================
// THRESHOLDS
// ============================================================================

/** Default thresholds for file size analysis */
export const DEFAULT_THRESHOLDS = {
  /** Lines that trigger a warning */
  warning: 300,
  /** Lines that trigger an error */
  error: 500,
  /** Lines that trigger a critical issue */
  critical: 800,
} as const;

/** Ideal file size for splitting */
const IDEAL_FILE_SIZE = 150;

// ============================================================================
// ANALYSIS
// ============================================================================

/**
 * Analyze file sizes in a directory
 *
 * @param targetPath - Path to analyze
 * @param projectRoot - Project root for relative paths
 * @param thresholds - Custom thresholds (optional)
 * @returns File size analysis result
 */
export function analyzeFileSizes(
  targetPath: string,
  projectRoot: string,
  thresholds: typeof DEFAULT_THRESHOLDS = DEFAULT_THRESHOLDS,
): FileSizeAnalysis {
  // Find all TypeScript files
  const pattern = '**/*.{ts,tsx}';
  const files = globSync(pattern, {
    cwd: targetPath,
    absolute: true,
    ignore: [
      '**/node_modules/**',
      '**/*.d.ts',
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.spec.ts',
      '**/*.spec.tsx',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
    ],
  });

  const issues: FileSizeIssue[] = [];

  for (const file of files) {
    const lines = countLines(file);
    const severity = getSeverity(lines, thresholds);

    if (severity) {
      const relativePath = path.relative(projectRoot, file);
      const suggestedSplitCount = Math.ceil(lines / IDEAL_FILE_SIZE);

      issues.push({
        file: relativePath,
        lines,
        severity,
        suggestion: getSuggestion(severity, lines, suggestedSplitCount),
        suggestedSplitCount,
      });
    }
  }

  // Sort by lines descending (worst first)
  issues.sort((a, b) => b.lines - a.lines);

  // Calculate summary
  const summary = {
    warning: issues.filter((i) => i.severity === 'warning').length,
    error: issues.filter((i) => i.severity === 'error').length,
    critical: issues.filter((i) => i.severity === 'critical').length,
  };

  return {
    totalFiles: files.length,
    issues,
    thresholds,
    summary,
  };
}

/**
 * Count lines in a file (excluding empty lines and comments)
 */
function countLines(filePath: string): number {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    let count = 0;
    let inBlockComment = false;

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines
      if (!trimmed) continue;

      // Handle block comments
      if (inBlockComment) {
        if (trimmed.includes('*/')) {
          inBlockComment = false;
        }
        continue;
      }

      // Start of block comment
      if (trimmed.startsWith('/*')) {
        if (!trimmed.includes('*/')) {
          inBlockComment = true;
        }
        continue;
      }

      // Skip single-line comments
      if (trimmed.startsWith('//')) continue;

      // Count this line
      count++;
    }

    return count;
  } catch {
    return 0;
  }
}

/**
 * Get severity based on line count
 */
function getSeverity(
  lines: number,
  thresholds: typeof DEFAULT_THRESHOLDS,
): FileSizeSeverity | null {
  if (lines >= thresholds.critical) return 'critical';
  if (lines >= thresholds.error) return 'error';
  if (lines >= thresholds.warning) return 'warning';
  return null;
}

/**
 * Get suggestion based on severity
 */
function getSuggestion(severity: FileSizeSeverity, lines: number, splitCount: number): string {
  switch (severity) {
    case 'critical':
      return `CRITICAL: ${lines} lines! Split into ~${splitCount} files immediately. Extract separate concerns.`;
    case 'error':
      return `${lines} lines is too large. Split into ~${splitCount} smaller modules for better maintainability.`;
    case 'warning':
      return `${lines} lines. Consider splitting if file has multiple responsibilities.`;
  }
}

// ============================================================================
// QUICK SCAN
// ============================================================================

/**
 * Quick scan for oversized files (faster, only counts total lines)
 */
export function quickScanFileSizes(
  targetPath: string,
  projectRoot: string,
  threshold = DEFAULT_THRESHOLDS.warning,
): Array<{ file: string; lines: number }> {
  const pattern = '**/*.{ts,tsx}';
  const files = globSync(pattern, {
    cwd: targetPath,
    absolute: true,
    ignore: ['**/node_modules/**', '**/*.d.ts', '**/dist/**', '**/build/**'],
  });

  const results: Array<{ file: string; lines: number }> = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n').length;

      if (lines >= threshold) {
        results.push({
          file: path.relative(projectRoot, file),
          lines,
        });
      }
    } catch {
      // Skip files that can't be read
    }
  }

  return results.sort((a, b) => b.lines - a.lines);
}
