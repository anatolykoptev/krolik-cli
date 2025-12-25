/**
 * @module lib/constants
 * @description Centralized constants for Krolik CLI
 */

// ============================================================================
// MESSAGES
// ============================================================================

export { ERROR_MESSAGES } from './messages';

// ============================================================================
// THRESHOLDS
// ============================================================================

export {
  ANALYSIS_THRESHOLDS,
  CATEGORY_BASE_EFFORT,
  DIFFICULTY_MULTIPLIER,
  EFFORT_THRESHOLDS,
  OUTPUT_LIMITS,
  SEVERITY_MULTIPLIER,
} from './thresholds';

// ============================================================================
// AGENTS
// ============================================================================

export {
  AGENTS_REPO_NAME,
  AGENTS_REPO_URL,
  CLAUDE_MEM_PORT,
  GITHUB_BASE_URL,
} from './agents';

// ============================================================================
// DOMAINS
// ============================================================================

export {
  DOMAIN_APPROACHES,
  DOMAIN_FILES,
  DOMAIN_KEYWORDS,
} from './domains';

// ============================================================================
// REFACTOR
// ============================================================================

export {
  ALLOWED_DEPS,
  NAMESPACE_INFO,
  NAMESPACE_KEYWORDS,
} from './refactor';

// ============================================================================
// LINT
// ============================================================================

export {
  ALERT_LINE_PATTERNS,
  CONSOLE_LINE_PATTERNS,
  DEBUG_CONSOLE_METHODS,
  DEBUGGER_LINE_PATTERNS,
  INTENTIONAL_CONSOLE_METHODS,
  LINT_KEYWORDS,
} from './lint';

// ============================================================================
// HARDCODED
// ============================================================================

export {
  ACCEPTABLE_NUMBERS,
  CONST_DECL_PATTERN,
  DETECTION_PATTERNS,
  FIXABLE_PATTERNS,
  KEYWORD_TO_CONST_NAME,
  KNOWN_CONSTANTS,
  SKIP_FILE_PATTERNS,
  SKIP_URL_PATTERNS,
} from './hardcoded';

// ============================================================================
// TYPE SAFETY
// ============================================================================

export {
  ANY_TYPE_PATTERNS,
  TS_IGNORE_PATTERNS,
  TS_NOCHECK_PATTERNS,
  TYPE_SAFETY_KEYWORDS,
} from './type-safety';

// ============================================================================
// COMPLEXITY
// ============================================================================

export {
  COMPLEXITY_DETECTION_PATTERNS,
  COMPLEXITY_RANGE,
  DEFAULT_MAX_COMPLEXITY,
  DEFAULT_MAX_NESTING,
  LONG_FUNCTION_RANGE,
  MIN_BLOCK_COMPLEXITY,
  MIN_BLOCK_SIZE,
  MIN_IF_CHAIN_LENGTH,
  MIN_STATEMENTS_FOR_EARLY_RETURN,
  type NumberRange,
} from './complexity';

// ============================================================================
// SRP
// ============================================================================

export {
  EXPORTS_RANGE,
  FUNCTIONS_RANGE,
  SIZE_RANGE,
  SRP_PATTERNS,
} from './srp';

// ============================================================================
// FILE PATTERNS
// ============================================================================

export {
  API_FILE_PATTERNS,
  API_FILE_PATTERNS_REGEX,
  // Backward compatibility exports
  CLI_FILE_PATTERNS,
  CLI_FILE_PATTERNS_REGEX,
  CLI_FILE_PATTERNS_STRINGS,
  COMPONENT_FILE_PATTERNS,
  COMPONENT_FILE_PATTERNS_REGEX,
  CONFIG_FILE_PATTERNS,
  CONFIG_FILE_PATTERNS_REGEX,
  HOOK_FILE_PATTERNS,
  HOOK_FILE_PATTERNS_REGEX,
  OUTPUT_FILE_PATTERNS,
  OUTPUT_FILE_PATTERNS_REGEX,
  OUTPUT_FILE_PATTERNS_STRINGS,
  SCHEMA_FILE_PATTERNS,
  SCHEMA_FILE_PATTERNS_REGEX,
  TEST_FILE_PATTERNS,
  TEST_FILE_PATTERNS_REGEX,
  TEST_FILE_PATTERNS_STRINGS,
  UTIL_FILE_PATTERNS,
  UTIL_FILE_PATTERNS_REGEX,
} from './file-patterns';

// ============================================================================
// IGNORE PATTERNS
// ============================================================================

export {
  ALWAYS_IGNORE_PATTERNS,
  DEFAULT_IGNORE_PATTERNS,
  getIgnorePatterns,
  TEST_IGNORE_PATTERNS,
} from './ignore';
