/**
 * @module lib/constants/file-patterns
 * @description Unified file patterns for detection and matching - single source of truth
 *
 * Provides BOTH regex patterns (for detectors) and string patterns (for glob matching).
 *
 * Used by:
 * - lib/@context/detectors.ts (file type detection)
 * - commands/fix/strategies/lint/constants.ts (lint skip logic)
 * - quality/analyzers (file classification)
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

// ============================================================================
// REGEX PATTERNS (for detectors)
// ============================================================================

/**
 * CLI file patterns for auto-detection (regex)
 */
export const CLI_FILE_PATTERNS_REGEX = [
  // Direct CLI indicators
  /[/\\]bin[/\\]/,
  /[/\\]cli[/\\]/,
  /\.cli\.(ts|js)$/,
  /cli\.(ts|js)$/,
  /bin\.(ts|js)$/,
  // Command handlers often need console output
  /[/\\]commands[/\\].*[/\\]index\.(ts|js)$/,
  // MCP servers communicate via stdout
  /[/\\]mcp[/\\]/,
  // Scripts directory
  /[/\\]scripts[/\\]/,
] as const;

/**
 * Test file patterns (regex)
 */
export const TEST_FILE_PATTERNS_REGEX = [
  /\.test\.(ts|tsx|js|jsx)$/,
  /\.spec\.(ts|tsx|js|jsx)$/,
  /[/\\]__tests__[/\\]/,
  /[/\\]test[/\\]/,
  /[/\\]tests[/\\]/,
] as const;

/**
 * Config file patterns (regex)
 */
export const CONFIG_FILE_PATTERNS_REGEX = [
  /\.config\.(ts|js|mjs|cjs)$/,
  /webpack\./,
  /vite\.config/,
  /next\.config/,
  /tailwind\.config/,
  /postcss\.config/,
  /eslint/,
  /prettier/,
  /tsconfig/,
  /package\.json$/,
] as const;

/**
 * Output/logger file patterns (console is intentional)
 */
export const OUTPUT_FILE_PATTERNS_REGEX = [
  /[/\\]output\./,
  /[/\\]output[/\\]/,
  /[/\\]logger\./,
  /[/\\]logger[/\\]/,
  /[/\\]logging[/\\]/,
  /output\.(ts|js)$/,
  /logger\.(ts|js)$/,
] as const;

/**
 * Component file patterns (React/Vue/Svelte)
 */
export const COMPONENT_FILE_PATTERNS_REGEX = [
  /[/\\]components[/\\]/,
  /\.component\.(ts|tsx|js|jsx)$/,
  /\.(tsx|jsx)$/,
] as const;

/**
 * Hook file patterns (React)
 */
export const HOOK_FILE_PATTERNS_REGEX = [/[/\\]hooks[/\\]/, /use[A-Z][a-zA-Z]+\.(ts|js)$/] as const;

/**
 * Utility file patterns
 */
export const UTIL_FILE_PATTERNS_REGEX = [
  /[/\\]utils[/\\]/,
  /[/\\]lib[/\\]/,
  /[/\\]helpers[/\\]/,
  /\.util\.(ts|js)$/,
  /\.helper\.(ts|js)$/,
] as const;

/**
 * API/Router file patterns
 */
export const API_FILE_PATTERNS_REGEX = [
  /[/\\]api[/\\]/,
  /[/\\]routers[/\\]/,
  /[/\\]routes[/\\]/,
  /\.router\.(ts|js)$/,
  /\.api\.(ts|js)$/,
] as const;

/**
 * Schema file patterns
 */
export const SCHEMA_FILE_PATTERNS_REGEX = [
  /\.schema\.(ts|js)$/,
  /[/\\]schemas[/\\]/,
  /\.prisma$/,
  /\.graphql$/,
  /\.gql$/,
] as const;

// ============================================================================
// STRING PATTERNS (for glob matching and includes checks)
// ============================================================================

/**
 * CLI file patterns (strings for simple matching)
 */
export const CLI_FILE_PATTERNS_STRINGS = [
  '/cli/',
  '/commands/',
  '/bin/',
  'cli.ts',
  'cli.js',
] as const;

/**
 * Test file patterns (strings)
 */
export const TEST_FILE_PATTERNS_STRINGS = [
  '.test.',
  '.spec.',
  '__tests__',
  '/test/',
  '/tests/',
] as const;

/**
 * Output/logger file patterns (strings)
 */
export const OUTPUT_FILE_PATTERNS_STRINGS = [
  '/output.',
  '/output/',
  '/logger.',
  '/logger/',
  '/logging/',
  'output.ts',
  'logger.ts',
] as const;

// ============================================================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================================================

/**
 * @deprecated Use CLI_FILE_PATTERNS_REGEX instead
 */
export const CLI_FILE_PATTERNS = CLI_FILE_PATTERNS_REGEX;

/**
 * @deprecated Use TEST_FILE_PATTERNS_REGEX instead
 */
export const TEST_FILE_PATTERNS = TEST_FILE_PATTERNS_REGEX;

/**
 * @deprecated Use CONFIG_FILE_PATTERNS_REGEX instead
 */
export const CONFIG_FILE_PATTERNS = CONFIG_FILE_PATTERNS_REGEX;

/**
 * @deprecated Use OUTPUT_FILE_PATTERNS_REGEX instead
 */
export const OUTPUT_FILE_PATTERNS = OUTPUT_FILE_PATTERNS_REGEX;

/**
 * @deprecated Use COMPONENT_FILE_PATTERNS_REGEX instead
 */
export const COMPONENT_FILE_PATTERNS = COMPONENT_FILE_PATTERNS_REGEX;

/**
 * @deprecated Use HOOK_FILE_PATTERNS_REGEX instead
 */
export const HOOK_FILE_PATTERNS = HOOK_FILE_PATTERNS_REGEX;

/**
 * @deprecated Use UTIL_FILE_PATTERNS_REGEX instead
 */
export const UTIL_FILE_PATTERNS = UTIL_FILE_PATTERNS_REGEX;

/**
 * @deprecated Use API_FILE_PATTERNS_REGEX instead
 */
export const API_FILE_PATTERNS = API_FILE_PATTERNS_REGEX;

/**
 * @deprecated Use SCHEMA_FILE_PATTERNS_REGEX instead
 */
export const SCHEMA_FILE_PATTERNS = SCHEMA_FILE_PATTERNS_REGEX;
