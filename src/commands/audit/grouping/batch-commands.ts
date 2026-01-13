/**
 * @module commands/audit/grouping/batch-commands
 * @description Maps issue patterns to batch fix commands
 *
 * Provides CLI commands for batch-fixing groups of similar issues.
 * Each pattern that has an available fixer is mapped to its CLI command.
 */

import type { IssuePatternId } from '../../../lib/@reporter/types';

// ============================================================================
// BATCH COMMAND MAPPING
// ============================================================================

/**
 * Batch fix command configuration
 */
interface BatchCommandConfig {
  /** CLI command to execute */
  command: string;
  /** Human-readable description */
  description: string;
  /** Whether this is a safe (trivial) fix */
  safe: boolean;
}

/**
 * Mapping of pattern IDs to their batch fix commands
 *
 * Only patterns with available fixers are included.
 * Patterns not in this map require manual intervention.
 */
const BATCH_COMMANDS: Partial<Record<IssuePatternId, BatchCommandConfig>> = {
  'any-usage': {
    command: 'krolik fix --category type-safety',
    description: 'Replace any with unknown',
    safe: true,
  },
  'console-log': {
    command: 'krolik fix --category lint',
    description: 'Remove console.log statements',
    safe: true,
  },
  debugger: {
    command: 'krolik fix --category lint',
    description: 'Remove debugger statements',
    safe: true,
  },
  alert: {
    command: 'krolik fix --category lint',
    description: 'Remove alert() calls',
    safe: true,
  },
  'ts-ignore': {
    command: 'krolik fix --category type-safety',
    description: 'Convert @ts-ignore to @ts-expect-error',
    safe: true,
  },
  'ts-nocheck': {
    command: 'krolik fix --category type-safety',
    description: 'Remove @ts-nocheck comments',
    safe: false,
  },
  'hardcoded-url': {
    command: 'krolik fix --category hardcoded',
    description: 'Extract URLs to environment variables',
    safe: false,
  },
  'hardcoded-number': {
    command: 'krolik fix --category hardcoded',
    description: 'Extract magic numbers to constants',
    safe: false,
  },
  'i18n-hardcoded': {
    command: 'krolik fix --category i18n',
    description: 'Extract hardcoded text to translation keys',
    safe: false,
  },
};

/**
 * Patterns that can be batch-fixed
 */
export const BATCH_FIXABLE_PATTERNS: IssuePatternId[] = Object.keys(
  BATCH_COMMANDS,
) as IssuePatternId[];

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get the batch fix command for a pattern, if available
 *
 * @param pattern - The issue pattern identifier
 * @returns The CLI command string, or undefined if no batch fix is available
 */
export function getBatchCommand(pattern: IssuePatternId): string | undefined {
  return BATCH_COMMANDS[pattern]?.command;
}

/**
 * Check if a pattern has a batch fix available
 *
 * @param pattern - The issue pattern identifier
 * @returns true if the pattern can be batch-fixed
 */
export function hasBatchFix(pattern: IssuePatternId): boolean {
  return pattern in BATCH_COMMANDS;
}

/**
 * Get full batch command configuration for a pattern
 *
 * @param pattern - The issue pattern identifier
 * @returns The batch command config, or undefined if not available
 */
export function getBatchCommandConfig(pattern: IssuePatternId): BatchCommandConfig | undefined {
  return BATCH_COMMANDS[pattern];
}

/**
 * Check if a batch fix is considered safe (trivial difficulty)
 *
 * @param pattern - The issue pattern identifier
 * @returns true if the fix is safe to apply automatically
 */
export function isSafeBatchFix(pattern: IssuePatternId): boolean {
  return BATCH_COMMANDS[pattern]?.safe ?? false;
}
