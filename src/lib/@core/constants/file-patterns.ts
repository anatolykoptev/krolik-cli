/**
 * @module lib/@core/constants/file-patterns
 * @description File extension constants
 *
 * NOTE: Most file pattern utilities have moved to @detectors/file-context
 * This file only contains CODE_FILE_EXTENSIONS for backward compatibility
 */

// ============================================================================
// FILE EXTENSIONS (for validation)
// ============================================================================

/**
 * Common code file extensions for validation and filtering
 * Used by parsers, analyzers, and file detection utilities
 */
export const CODE_FILE_EXTENSIONS = new Set([
  // TypeScript
  'ts',
  'tsx',
  'mts',
  'cts',
  // JavaScript
  'js',
  'jsx',
  'mjs',
  'cjs',
  // Web
  'css',
  'scss',
  'less',
  'html',
  // Data
  'json',
  'yaml',
  'yml',
  // Docs
  'md',
  'mdx',
  // Database
  'prisma',
  'graphql',
  'gql',
  'sql',
  // Config
  'sh',
  'bash',
  'env',
]);
