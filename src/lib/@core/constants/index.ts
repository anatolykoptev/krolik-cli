/**
 * @module lib/@core/constants
 * @description Centralized constants for Krolik CLI
 *
 * NOTE: Pattern-related constants have been consolidated in @detectors/
 * This file re-exports them for backward compatibility
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
} from '../../../config/domains';

// ============================================================================
// REFACTOR
// ============================================================================

export {
  ALLOWED_DEPS,
  NAMESPACE_INFO,
  NAMESPACE_KEYWORDS,
} from './refactor';

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
// FILE PATTERNS (minimal - only CODE_FILE_EXTENSIONS)
// ============================================================================

export { CODE_FILE_EXTENSIONS } from './file-patterns';

// ============================================================================
// IGNORE PATTERNS
// ============================================================================

export {
  ALWAYS_IGNORE_PATTERNS,
  DEFAULT_IGNORE_PATTERNS,
  getIgnorePatterns,
  TEST_IGNORE_PATTERNS,
} from './ignore';

// ============================================================================
// RE-EXPORTS FROM @detectors (backward compatibility)
// ============================================================================

// Hardcoded patterns
// Complexity patterns
export {
  ACCEPTABLE_NUMBERS,
  COMPLEXITY_DETECTION_PATTERNS,
  COMPLEXITY_RANGE,
  CONST_DECL_PATTERN,
  DEFAULT_MAX_COMPLEXITY,
  DEFAULT_MAX_NESTING,
  HARDCODED_DETECTION_PATTERNS as DETECTION_PATTERNS,
  HARDCODED_FIXABLE_PATTERNS as FIXABLE_PATTERNS,
  KEYWORD_TO_CONST_NAME,
  KNOWN_CONSTANTS,
  LONG_FUNCTION_RANGE,
  MIN_BLOCK_COMPLEXITY,
  MIN_BLOCK_SIZE,
  MIN_IF_CHAIN_LENGTH,
  MIN_STATEMENTS_FOR_EARLY_RETURN,
  type NumberRange,
  SKIP_FILE_PATTERNS,
  SKIP_URL_PATTERNS,
} from '../../@detectors';
// Lint patterns
export {
  ALERT_LINE_PATTERNS,
  CONSOLE_LINE_PATTERNS,
  DEBUG_CONSOLE_METHODS,
  DEBUGGER_LINE_PATTERNS,
  INTENTIONAL_CONSOLE_METHODS,
  LINT_KEYWORDS,
} from '../../@detectors/lint';
// File patterns (from @detectors/file-context for backward compatibility)
export {
  API_FILE_PATTERNS,
  API_FILE_PATTERNS as API_FILE_PATTERNS_REGEX,
  CLI_FILE_PATTERNS,
  CLI_FILE_PATTERNS as CLI_FILE_PATTERNS_REGEX,
  COMPONENT_FILE_PATTERNS,
  COMPONENT_FILE_PATTERNS as COMPONENT_FILE_PATTERNS_REGEX,
  CONFIG_FILE_PATTERNS,
  CONFIG_FILE_PATTERNS as CONFIG_FILE_PATTERNS_REGEX,
  HOOK_FILE_PATTERNS,
  HOOK_FILE_PATTERNS as HOOK_FILE_PATTERNS_REGEX,
  OUTPUT_FILE_PATTERNS,
  OUTPUT_FILE_PATTERNS as OUTPUT_FILE_PATTERNS_REGEX,
  SCHEMA_FILE_PATTERNS,
  SCHEMA_FILE_PATTERNS as SCHEMA_FILE_PATTERNS_REGEX,
  TEST_FILE_PATTERNS,
  TEST_FILE_PATTERNS as TEST_FILE_PATTERNS_REGEX,
  UTIL_FILE_PATTERNS,
  UTIL_FILE_PATTERNS as UTIL_FILE_PATTERNS_REGEX,
} from '../../@detectors/patterns/file-context';
// Type safety patterns
export {
  ANY_TYPE_PATTERNS,
  TS_IGNORE_PATTERNS,
  TS_NOCHECK_PATTERNS,
  TYPE_SAFETY_KEYWORDS,
} from './type-safety';

// String patterns for backward compatibility (deprecated)
/** @deprecated Use CLI_FILE_PATTERNS from @detectors/file-context */
export const CLI_FILE_PATTERNS_STRINGS = [
  '/cli/',
  '/commands/',
  '/bin/',
  'cli.ts',
  'cli.js',
] as const;

/** @deprecated Use TEST_FILE_PATTERNS from @detectors/file-context */
export const TEST_FILE_PATTERNS_STRINGS = [
  '.test.',
  '.spec.',
  '__tests__',
  '/test/',
  '/tests/',
] as const;

/** @deprecated Use OUTPUT_FILE_PATTERNS from @detectors/file-context */
export const OUTPUT_FILE_PATTERNS_STRINGS = [
  '/output.',
  '/output/',
  '/logger.',
  '/logger/',
  '/logging/',
  'output.ts',
  'logger.ts',
] as const;
