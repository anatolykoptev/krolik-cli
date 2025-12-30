/**
 * @module lib/@detectors/quality
 * @description Unified quality detection patterns - single source of truth
 *
 * Consolidates:
 * - complexity/ - Cyclomatic complexity patterns
 * - hardcoded/ - Magic numbers, URLs, colors detection
 * - env-config/ - Environment configuration issues
 *
 * Used by:
 * - quality/analyzers/* (detection)
 * - fix/strategies/* (fixing)
 */

// ============================================================================
// COMPLEXITY
// ============================================================================

export {
  type ComplexityDetection,
  ComplexityTracker,
  type FunctionTrackingInfo,
  getComplexityWeight,
  isComplexityNode,
} from './complexity/detector';

// ============================================================================
// HARDCODED
// ============================================================================

// Detection patterns and rules
export {
  CONST_DECL_PATTERN,
  DETECTION_PATTERNS as HARDCODED_DETECTION_PATTERNS,
  FIXABLE_PATTERNS as HARDCODED_FIXABLE_PATTERNS,
  SKIP_FILE_PATTERNS as HARDCODED_SKIP_FILE_PATTERNS,
  shouldSkipFile as shouldSkipHardcodedFile,
  shouldSkipLine,
} from './hardcoded/detection';
// Detector functions
export {
  detectHardcodedUrl,
  detectHardcodedValue,
  detectHexColor,
  detectMagicNumber,
  isArrayIndex,
  isInConstDeclaration,
} from './hardcoded/detector';
// Number-related patterns and helpers
export {
  ACCEPTABLE_NUMBERS,
  getConstNameFromKeyword,
  getKnownConstantName,
  isAcceptableNumber,
  KEYWORD_TO_CONST_NAME,
  KNOWN_CONSTANTS,
} from './hardcoded/numbers';
// URL-related patterns and helpers
export {
  SKIP_URL_PATTERNS,
  shouldSkipUrl,
} from './hardcoded/urls';

// ============================================================================
// ENV-CONFIG
// ============================================================================

// Detector functions
export {
  detectApiEndpoint,
  detectCriticalEnvIssue,
  detectDatabaseHostname,
  detectEnvConfigIssue,
  detectEnvUrl,
  detectFeatureFlag,
  detectHardcodedPort,
  detectSecretOrApiKey,
  detectTimeoutValue,
} from './env-config/detector';

// Patterns
export {
  ALL_PATTERNS as ENV_CONFIG_PATTERNS,
  API_ENDPOINT_PATTERNS,
  CONFIG_VAR_PATTERNS,
  CONFIGURABLE_PORTS,
  DATABASE_HOSTNAME_PATTERNS,
  ENV_URL_PATTERNS,
  FEATURE_FLAG_PATTERNS,
  getPortCategory,
  isConfigurablePort as isConfigurablePortPattern,
  SECRET_PATTERNS,
  TIMEOUT_VAR_PATTERNS,
} from './env-config/patterns';

// Types
export type {
  EnvConfigPattern,
  UrlPattern,
  VariablePattern,
} from './env-config/types';

// Validators
export {
  getParentVariableName,
  hasEnvIndicator,
  isApiEndpoint,
  isConfigurablePort,
  isConfigVariable,
  isDatabaseHostname,
  isFeatureFlagVariable,
  isSecretOrApiKey,
  isTimeoutVariable,
  shouldSkipFile as shouldSkipEnvConfigFile,
  suggestEnvVarName,
} from './env-config/validators';
