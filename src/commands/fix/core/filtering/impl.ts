/**
 * @module commands/fix/core/filtering/impl
 * @description Fixer filtering implementation
 */

import type { FixOptions } from '../options';
import type { QualityCategory, QualityIssue } from '../types';

// ============================================================================
// FIXER MATCHING CONFIGURATION
// ============================================================================

type FixerOptionKey = keyof Pick<
  FixOptions,
  | 'fixConsole'
  | 'fixDebugger'
  | 'fixAlert'
  | 'fixTsIgnore'
  | 'fixAny'
  | 'fixComplexity'
  | 'fixLongFunctions'
  | 'fixMagicNumbers'
  | 'fixUrls'
  | 'fixSrp'
>;

interface FixerMatcher {
  category: QualityCategory;
  patterns: string[];
  optionKey: FixerOptionKey;
}

/**
 * Lookup table for category+message -> option mapping
 */
const FIXER_MATCHERS: FixerMatcher[] = [
  // Lint category
  { category: 'lint', patterns: ['console'], optionKey: 'fixConsole' },
  { category: 'lint', patterns: ['debugger'], optionKey: 'fixDebugger' },
  { category: 'lint', patterns: ['alert'], optionKey: 'fixAlert' },
  // Type-safety category
  { category: 'type-safety', patterns: ['@ts-ignore', 'ts-ignore'], optionKey: 'fixTsIgnore' },
  { category: 'type-safety', patterns: ['any'], optionKey: 'fixAny' },
  // Complexity category
  { category: 'complexity', patterns: ['complexity', 'cognitive'], optionKey: 'fixComplexity' },
  { category: 'complexity', patterns: ['long', 'lines'], optionKey: 'fixLongFunctions' },
  // Hardcoded category
  { category: 'hardcoded', patterns: ['number', 'magic'], optionKey: 'fixMagicNumbers' },
  { category: 'hardcoded', patterns: ['url', 'http'], optionKey: 'fixUrls' },
  // SRP category (matches all messages)
  { category: 'srp', patterns: [], optionKey: 'fixSrp' },
];

/**
 * Check if any explicit fixer flag is set
 */
function hasExplicitFixerFlags(options: FixOptions): boolean {
  return !!(
    options.fixConsole ||
    options.fixDebugger ||
    options.fixAlert ||
    options.fixTsIgnore ||
    options.fixAny ||
    options.fixComplexity ||
    options.fixLongFunctions ||
    options.fixMagicNumbers ||
    options.fixUrls ||
    options.fixSrp
  );
}

/**
 * Find matching fixer for an issue
 */
function findMatchingFixer(category: QualityCategory, message: string): FixerMatcher | undefined {
  const msg = message.toLowerCase();
  return FIXER_MATCHERS.find(
    (matcher) =>
      matcher.category === category &&
      (matcher.patterns.length === 0 || matcher.patterns.some((p) => msg.includes(p))),
  );
}

/**
 * Check if fixer is enabled based on option value and explicit flags
 */
function isFixerOptionEnabled(optionValue: boolean | undefined, hasExplicit: boolean): boolean {
  if (optionValue === false) return false;
  if (hasExplicit) return !!optionValue;
  return true;
}

/**
 * Registry-based fixer check
 */
function isFixerEnabledByRegistry(fixerId: string, options: FixOptions): boolean {
  // Lazy import to avoid circular dependency
  const { registry } = require('../../fixers');

  const enabledFixers = registry.getEnabled(options as Record<string, unknown>);
  return enabledFixers.some((f: { metadata: { id: string } }) => f.metadata.id === fixerId);
}

/**
 * Legacy category/message-based fixer check
 */
function isFixerEnabledLegacy(issue: QualityIssue, options: FixOptions): boolean {
  const hasExplicit = hasExplicitFixerFlags(options);
  const matcher = findMatchingFixer(issue.category, issue.message);

  if (matcher) {
    return isFixerOptionEnabled(options[matcher.optionKey], hasExplicit);
  }

  // Default: if no explicit flags, enable; otherwise disable
  return !hasExplicit;
}

/**
 * Check if a specific fixer is enabled for an issue
 *
 * Logic:
 * - If issue has fixerId, use registry-based filtering
 * - Otherwise, fall back to legacy category/message-based filtering
 *
 * For registry-based:
 * - If no fixer flags are set, all fixers are enabled (default behavior)
 * - If any --fix-X flag is set, only those fixers are enabled
 * - If --no-X flag is set, that specific fixer is disabled
 */
export function isFixerEnabled(issue: QualityIssue, options: FixOptions): boolean {
  // Use registry-based filtering for issues with fixerId
  if (issue.fixerId) {
    return isFixerEnabledByRegistry(issue.fixerId, options);
  }

  // Fall back to legacy logic for old analyzer issues
  return isFixerEnabledLegacy(issue, options);
}

/**
 * Filter issues based on fixer flags
 */
export function filterIssuesByFixerFlags(
  issues: QualityIssue[],
  options: FixOptions,
): QualityIssue[] {
  return issues.filter((issue) => isFixerEnabled(issue, options));
}
