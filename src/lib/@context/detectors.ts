/**
 * @module lib/@context/detectors
 * @description File type detection utilities - single source of truth
 *
 * Used by:
 * - quality/analyzers/lint-rules.ts (CLI detection)
 * - fix/context.ts (fix context building)
 * - quality/analyzers/detectors.ts (file type classification)
 */

import type { FileType } from './types';

// ============================================================================
// FILE PATTERNS
// ============================================================================

/**
 * CLI file patterns for auto-detection
 */
export const CLI_FILE_PATTERNS = [
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
 * Test file patterns
 */
export const TEST_FILE_PATTERNS = [
  /\.test\.(ts|tsx|js|jsx)$/,
  /\.spec\.(ts|tsx|js|jsx)$/,
  /[/\\]__tests__[/\\]/,
  /[/\\]test[/\\]/,
  /[/\\]tests[/\\]/,
] as const;

/**
 * Config file patterns
 */
export const CONFIG_FILE_PATTERNS = [
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
export const OUTPUT_FILE_PATTERNS = [
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
export const COMPONENT_FILE_PATTERNS = [
  /[/\\]components[/\\]/,
  /\.component\.(ts|tsx|js|jsx)$/,
  /\.(tsx|jsx)$/,
] as const;

/**
 * Hook file patterns (React)
 */
export const HOOK_FILE_PATTERNS = [/[/\\]hooks[/\\]/, /use[A-Z][a-zA-Z]+\.(ts|js)$/] as const;

/**
 * Utility file patterns
 */
export const UTIL_FILE_PATTERNS = [
  /[/\\]utils[/\\]/,
  /[/\\]lib[/\\]/,
  /[/\\]helpers[/\\]/,
  /\.util\.(ts|js)$/,
  /\.helper\.(ts|js)$/,
] as const;

/**
 * API/Router file patterns
 */
export const API_FILE_PATTERNS = [
  /[/\\]api[/\\]/,
  /[/\\]routers[/\\]/,
  /[/\\]routes[/\\]/,
  /\.router\.(ts|js)$/,
  /\.api\.(ts|js)$/,
] as const;

/**
 * Schema file patterns
 */
export const SCHEMA_FILE_PATTERNS = [
  /\.schema\.(ts|js)$/,
  /[/\\]schemas[/\\]/,
  /\.prisma$/,
  /\.graphql$/,
  /\.gql$/,
] as const;

// ============================================================================
// DETECTORS
// ============================================================================

/**
 * Check if file is a CLI entry point or command handler
 */
export function isCliFile(filepath: string): boolean {
  return CLI_FILE_PATTERNS.some((pattern) => pattern.test(filepath));
}

/**
 * Check if file is a test file
 */
export function isTestFile(filepath: string): boolean {
  return TEST_FILE_PATTERNS.some((pattern) => pattern.test(filepath));
}

/**
 * Check if file is a config file
 */
export function isConfigFile(filepath: string): boolean {
  return CONFIG_FILE_PATTERNS.some((pattern) => pattern.test(filepath));
}

/**
 * Check if file is an output/logger file
 */
export function isOutputFile(filepath: string): boolean {
  return OUTPUT_FILE_PATTERNS.some((pattern) => pattern.test(filepath));
}

/**
 * Check if file is a component file
 */
export function isComponentFile(filepath: string): boolean {
  return COMPONENT_FILE_PATTERNS.some((pattern) => pattern.test(filepath));
}

/**
 * Check if file is a hook file
 */
export function isHookFile(filepath: string): boolean {
  return HOOK_FILE_PATTERNS.some((pattern) => pattern.test(filepath));
}

/**
 * Check if file is a utility file
 */
export function isUtilFile(filepath: string): boolean {
  return UTIL_FILE_PATTERNS.some((pattern) => pattern.test(filepath));
}

/**
 * Check if file is an API file
 */
export function isApiFile(filepath: string): boolean {
  return API_FILE_PATTERNS.some((pattern) => pattern.test(filepath));
}

/**
 * Check if file is a schema file
 */
export function isSchemaFile(filepath: string): boolean {
  return SCHEMA_FILE_PATTERNS.some((pattern) => pattern.test(filepath));
}

/**
 * Detect file type from path
 */
export function detectFileType(filepath: string): FileType {
  // Order matters - more specific first
  if (isTestFile(filepath)) return 'test';
  if (isConfigFile(filepath)) return 'config';
  if (isCliFile(filepath)) return 'cli';
  if (isOutputFile(filepath)) return 'output';
  if (isSchemaFile(filepath)) return 'schema';
  if (isHookFile(filepath)) return 'hook';
  if (isComponentFile(filepath)) return 'component';
  if (isApiFile(filepath)) return 'api';
  if (isUtilFile(filepath)) return 'util';

  return 'unknown';
}

/**
 * Check if console statements should be skipped for this file
 */
export function shouldSkipConsole(filepath: string): boolean {
  return isCliFile(filepath) || isOutputFile(filepath) || isTestFile(filepath);
}

/**
 * Check if lint checks should be skipped for this file
 */
export function shouldSkipLint(filepath: string): boolean {
  return isConfigFile(filepath) || isSchemaFile(filepath);
}
