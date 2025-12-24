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

// Lint patterns
export {
  LINT_RULES,
  LINT_KEYWORDS,
  INTENTIONAL_CONSOLE_METHODS,
  DEBUG_CONSOLE_METHODS,
  CONSOLE_LINE_PATTERNS,
  DEBUGGER_LINE_PATTERNS,
  ALERT_LINE_PATTERNS,
  getLintRule,
  getFixableLintRuleIds,
  isIntentionalConsole,
  isDebugConsole,
  type LintRule,
} from './lint';

// Hardcoded patterns
export {
  DETECTION_PATTERNS as HARDCODED_DETECTION_PATTERNS,
  FIXABLE_PATTERNS as HARDCODED_FIXABLE_PATTERNS,
  ACCEPTABLE_NUMBERS,
  CONST_DECL_PATTERN,
  SKIP_FILE_PATTERNS,
  SKIP_URL_PATTERNS,
  KNOWN_CONSTANTS,
  KEYWORD_TO_CONST_NAME,
  shouldSkipFile,
  shouldSkipLine,
  isAcceptableNumber,
  shouldSkipUrl,
  getKnownConstantName,
  getConstNameFromKeyword,
} from './hardcoded';

// Complexity patterns
export {
  COMPLEXITY_SYNTAX_KINDS,
  COMPLEXITY_OPERATORS,
  COMPLEXITY_REGEX_PATTERNS,
  COMPLEXITY_RANGE,
  LONG_FUNCTION_RANGE,
  MIN_BLOCK_SIZE,
  MIN_BLOCK_COMPLEXITY,
  MIN_IF_CHAIN_LENGTH,
  MIN_STATEMENTS_FOR_EARLY_RETURN,
  DEFAULT_MAX_NESTING,
  DEFAULT_MAX_COMPLEXITY,
  DETECTION_PATTERNS as COMPLEXITY_DETECTION_PATTERNS,
  FUNCTION_NAME_MAP,
  DEFAULT_FUNCTION_NAME,
  calculateComplexityRegex,
  isFixableComplexity,
  isFixableFunctionLength,
  getFunctionNameFromKeywords,
  type NumberRange,
} from './complexity';

// Shared types
export type {
  PatternMatch,
  HardcodedType,
  HardcodedValue,
  Severity,
  QualityCategory,
} from './types';
