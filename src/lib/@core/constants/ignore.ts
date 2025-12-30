/**
 * @module lib/@core/constants/ignore
 * @description Centralized ignore patterns for krolik audit and analysis
 *
 * Used by:
 * - commands/fix/analyze.ts (file selection)
 * - Any other analysis commands
 */

// ============================================================================
// ALWAYS IGNORED (infrastructure/build artifacts)
// ============================================================================

/**
 * Directories and files that should always be ignored during analysis
 */
export const ALWAYS_IGNORE_PATTERNS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/.next/**',
  '**/coverage/**',
  '**/*.d.ts',
  '**/generated/**',
  '**/.git/**',
  '**/build/**',
  '**/.turbo/**',
] as const;

// ============================================================================
// TEST FILE PATTERNS
// ============================================================================

/**
 * Test file patterns - excluded by default from audit
 * Use --include-tests flag to include them
 */
export const TEST_IGNORE_PATTERNS = [
  // Standard test patterns
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/*.spec.ts',
  '**/*.spec.tsx',
  '**/__tests__/**',
  // Legacy test naming (test-*.ts at any level)
  '**/test-*.ts',
  '**/test-*.tsx',
  // Debug scripts
  '**/debug-*.ts',
  '**/debug-*.tsx',
  // Example files
  '**/EXAMPLE-*.ts',
  '**/example-*.ts',
  // Scripts folder (development utilities)
  '**/scripts/**',
] as const;

// ============================================================================
// COMBINED PATTERNS
// ============================================================================

/**
 * Default ignore patterns for audit (without tests)
 */
export const DEFAULT_IGNORE_PATTERNS = [...ALWAYS_IGNORE_PATTERNS] as const;

/**
 * Get ignore patterns based on options
 */
export function getIgnorePatterns(options: { includeTests?: boolean | undefined } = {}): string[] {
  const patterns: string[] = [...ALWAYS_IGNORE_PATTERNS];

  if (!options.includeTests) {
    patterns.push(...TEST_IGNORE_PATTERNS);
  }

  return patterns;
}
