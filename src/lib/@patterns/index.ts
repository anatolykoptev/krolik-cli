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

// Browser API patterns
export {
  type BrowserApiCategory,
  type BrowserApiDetection,
  CONSOLE_OBJECT_NAMES,
  CONSOLE_PARENT_OBJECTS,
  DIALOG_FUNCTION_NAMES,
  DIALOG_PARENT_OBJECTS,
  detectBrowserApi,
  EVAL_FUNCTION_NAMES,
  EVAL_LIKE_PATTERNS,
  isConsoleMember,
  isDialogFunction,
  isEvalFunction,
  KNOWN_CONSOLE_METHODS,
} from './browser-apis';
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
// Dynamic skip patterns (directory traversal)
export {
  BASE_SKIP_DIRS,
  COMMON_SKIP_DIRS,
  clearSkipPatternsCache,
  generateSkipPatterns,
  getSkipPatterns,
  invalidateSkipPatterns,
  shouldSkipDir,
  TOOL_DIR_MAP,
} from './dynamic-skip';
// Env var severity patterns (semantic analysis)
export {
  analyzeEnvVar,
  detectEnvVarSeverity,
  type EnvVarAnalysis,
  type EnvVarSeverity,
  groupEnvVarsBySeverity,
  isSensitiveEnvVar,
  sortEnvVarsBySeverity,
} from './env-severity';
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
// React patterns
export {
  ALL_BUILT_IN_HOOKS,
  extractCustomHooks,
  extractHookNames,
  HOOK_CALL_PATTERN,
  isBuiltInHook,
  isCustomHook,
  isReactHook,
  REACT_BUILT_IN_HOOKS,
  REACT_DOM_BUILT_IN_HOOKS,
  REACT_HOOK_PATTERN,
  REACT_PACKAGE_IDENTIFIERS,
} from './react-patterns';
// Skip patterns (centralized for all analyzers)
export {
  ANALYZER_SKIP_PATTERNS,
  clearSkipPatternCache,
  getAnalyzerSkipPatterns,
  HARDCODED_SKIP_PATTERNS,
  LINT_SKIP_PATTERNS,
  shouldSkipForAnalysis,
  shouldSkipForEnvConfig,
  shouldSkipForHardcoded,
  shouldSkipForLint,
} from './skip-patterns';
// Shared types
export type {
  HardcodedType,
  HardcodedValue,
  PatternMatch,
  QualityCategory,
  Severity,
} from './types';
// Verb detection (linguistic-based)
export {
  detectVerbPrefix,
  extractVerbPrefix,
  groupByVerbPrefix,
  isActionVerbName,
  isEventHandlerName,
  isVerbLike,
} from './verb-detection';
