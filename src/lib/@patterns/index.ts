/**
 * @module lib/@patterns
 * @description Unified code quality patterns - single source of truth
 *
 * This module consolidates all detection patterns used by:
 * - quality analyzers (detection)
 * - fix strategies (fixing)
 *
 * Benefits:
 * - No duplication between quality and fix
 * - Consistent pattern definitions
 * - Easy to extend and maintain
 */

// Complexity patterns
export {
  COMPLEXITY_OPERATORS,
  COMPLEXITY_RANGE,
  COMPLEXITY_REGEX_PATTERNS,
  COMPLEXITY_SYNTAX_KINDS,
  calculateComplexityRegex,
  DEFAULT_FUNCTION_NAME,
  DEFAULT_MAX_COMPLEXITY,
  DEFAULT_MAX_NESTING,
  DETECTION_PATTERNS as COMPLEXITY_DETECTION_PATTERNS,
  FUNCTION_NAME_MAP,
  getFunctionNameFromKeywords,
  isFixableComplexity,
  isFixableFunctionLength,
  LONG_FUNCTION_RANGE,
  MIN_BLOCK_COMPLEXITY,
  MIN_BLOCK_SIZE,
  MIN_IF_CHAIN_LENGTH,
  MIN_STATEMENTS_FOR_EARLY_RETURN,
  type NumberRange,
} from './complexity';

// Hardcoded patterns
export {
  ACCEPTABLE_NUMBERS,
  CONST_DECL_PATTERN,
  DETECTION_PATTERNS as HARDCODED_DETECTION_PATTERNS,
  FIXABLE_PATTERNS as HARDCODED_FIXABLE_PATTERNS,
  getConstNameFromKeyword,
  getKnownConstantName,
  isAcceptableNumber,
  KEYWORD_TO_CONST_NAME,
  KNOWN_CONSTANTS,
  SKIP_FILE_PATTERNS,
  SKIP_URL_PATTERNS,
  shouldSkipFile,
  shouldSkipLine,
  shouldSkipUrl,
} from './hardcoded/index';
// Lint patterns
export {
  ALERT_LINE_PATTERNS,
  CONSOLE_LINE_PATTERNS,
  DEBUG_CONSOLE_METHODS,
  DEBUGGER_LINE_PATTERNS,
  getFixableLintRuleIds,
  getLintRule,
  INTENTIONAL_CONSOLE_METHODS,
  isDebugConsole,
  isIntentionalConsole,
  LINT_KEYWORDS,
  LINT_RULES,
  type LintRule,
} from './lint';

// Shared types
export type {
  HardcodedType,
  HardcodedValue,
  PatternMatch,
  QualityCategory,
  Severity,
} from './types';
