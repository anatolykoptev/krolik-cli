/**
 * @module lib/@patterns/skip-patterns
 * @description Centralized file skip patterns for all analyzers
 *
 * This file defines which files/directories should be excluded from analysis.
 * All analyzers should use these patterns to maintain consistency.
 */

/**
 * File patterns to skip for ALL analyzers (lint, type-safety, hardcoded)
 *
 * These files contain pattern definitions, constants, or test infrastructure
 * that would generate false positives when analyzed.
 */
export const ANALYZER_SKIP_PATTERNS = [
  // Test files
  '.test.',
  '.spec.',
  '__tests__',
  '__mocks__',

  // Configuration files
  '.config.',
  'schema',

  // Internal infrastructure (pattern definitions)
  '/constants/', // Constant definition files
  '/@patterns/', // Pattern library files
  '/@swc/', // SWC infrastructure
  '/lib/@', // All lib/@* modules (internal infrastructure)
] as const;

/**
 * Additional patterns to skip for hardcoded value detection only
 */
export const HARDCODED_SKIP_PATTERNS = [
  'tailwind',
  '.css',
  '.scss',
  '.stories.',
] as const;

/**
 * Additional patterns to skip for lint rules only
 */
export const LINT_SKIP_PATTERNS = [
  '/cli/', // CLI files can use console
  'bin/', // Binary entry points can use console
  'logger', // Logger files can use console
] as const;

/**
 * Check if file should be skipped by all analyzers
 */
export function shouldSkipForAnalysis(filepath: string): boolean {
  return ANALYZER_SKIP_PATTERNS.some((pattern) => filepath.includes(pattern));
}

/**
 * Check if file should be skipped for hardcoded detection
 */
export function shouldSkipForHardcoded(filepath: string): boolean {
  return (
    shouldSkipForAnalysis(filepath) ||
    HARDCODED_SKIP_PATTERNS.some((pattern) => filepath.includes(pattern))
  );
}

/**
 * Check if file should be skipped for lint rules
 */
export function shouldSkipForLint(filepath: string): boolean {
  return (
    shouldSkipForAnalysis(filepath) ||
    LINT_SKIP_PATTERNS.some((pattern) => filepath.includes(pattern))
  );
}
