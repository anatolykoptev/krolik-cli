/**
 * @module lib/@patterns/lint
 * @description Unified lint patterns - single source of truth
 *
 * Used by:
 * - quality/analyzers/lint-rules.ts (detection)
 * - fix/strategies/lint (fixing)
 */

// ============================================================================
// DETECTION PATTERNS (for quality analyzer)
// ============================================================================

/**
 * Lint rule definition for quality analysis
 */
export interface LintRule {
  id: string;
  pattern: RegExp;
  message: string;
  suggestion: string;
  severity: 'error' | 'warning' | 'info';
  /** Skip in certain file types */
  skipInFiles?: string[];
  /** Skip in CLI files (intentional output) */
  skipInCli?: boolean;
}

/**
 * Universal lint rules for detection
 */
export const LINT_RULES: LintRule[] = [
  {
    id: 'no-console',
    pattern: /\bconsole\.(log|info|warn|error|debug|trace)\s*\(/g,
    message: 'Unexpected console statement',
    suggestion: 'Remove console statement or use a proper logging library',
    severity: 'warning',
    skipInFiles: ['.test.', '.spec.', 'logger.'],
    skipInCli: true,
  },
  {
    id: 'no-debugger',
    // Match standalone debugger, not property access like options.debugger
    pattern: /(?<![.\w])debugger(?!\s*[:\w])/g,
    message: 'Unexpected debugger statement',
    suggestion: 'Remove debugger statement before committing',
    severity: 'error',
  },
  {
    id: 'no-alert',
    pattern: /\b(alert|confirm|prompt)\s*\(/g,
    message: 'Unexpected native dialog',
    suggestion: 'Use a modal component instead of native browser dialogs',
    severity: 'warning',
    skipInFiles: ['.test.', '.spec.'],
  },
  {
    id: 'no-eval',
    pattern: /\beval\s*\(/g,
    message: 'eval() is a security risk',
    suggestion: 'Avoid eval() - use safer alternatives like JSON.parse() or Function constructor',
    severity: 'error',
  },
  {
    id: 'no-var',
    pattern: /\bvar\s+\w+/g,
    message: 'Unexpected var declaration',
    suggestion: 'Use const or let instead of var',
    severity: 'info',
  },
  {
    id: 'no-todo-comments',
    pattern: /\/\/\s*(TODO|FIXME|HACK|XXX|BUG):/gi,
    message: 'Unresolved TODO/FIXME comment',
    suggestion: 'Address or create a ticket for this TODO',
    severity: 'info',
  },
];

// ============================================================================
// CONSOLE PATTERNS (for fix strategies)
// ============================================================================

/**
 * Keywords that indicate fixable lint issues
 */
export const LINT_KEYWORDS = {
  DEBUGGER: ['debugger'],
  ALERT: ['alert'],
  CONSOLE: ['console'],
} as const;

/**
 * Console methods that are likely intentional output (not debug logs)
 */
export const INTENTIONAL_CONSOLE_METHODS = [
  'console.error',
  'console.warn',
  'console.info',
  'console.table',
] as const;

/**
 * Console methods that are typically debug statements
 */
export const DEBUG_CONSOLE_METHODS = [
  'console.log',
  'console.debug',
  'console.trace',
  'console.dir',
  'console.count',
  'console.time',
  'console.timeEnd',
] as const;

/**
 * Console line patterns for deletion
 */
export const CONSOLE_LINE_PATTERNS = {
  STANDALONE: /^console\.\w+\([^)]*\);?$/,
  COMPLETE: /;$|^\)/,
} as const;

/**
 * Debugger line patterns
 */
export const DEBUGGER_LINE_PATTERNS = {
  STANDALONE: /^debugger;?$/,
  INLINE: /\bdebugger;?\s*/g,
} as const;

/**
 * Alert line patterns
 */
export const ALERT_LINE_PATTERNS = {
  STANDALONE: /^alert\([^)]*\);?$/,
} as const;

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get lint rule by ID
 */
export function getLintRule(id: string): LintRule | undefined {
  return LINT_RULES.find((rule) => rule.id === id);
}

/**
 * Get all fixable lint rule IDs
 */
export function getFixableLintRuleIds(): string[] {
  return ['no-console', 'no-debugger', 'no-alert'];
}

/**
 * Check if console method is intentional (error/warn/info)
 */
export function isIntentionalConsole(line: string): boolean {
  return INTENTIONAL_CONSOLE_METHODS.some((method) => line.includes(method));
}

/**
 * Check if console method is debug-only
 */
export function isDebugConsole(line: string): boolean {
  return DEBUG_CONSOLE_METHODS.some((method) => line.includes(method));
}
