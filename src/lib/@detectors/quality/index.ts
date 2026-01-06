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

// ============================================================================
// DUPLICATE-QUERY
// ============================================================================

// Detector
export {
  detectQuery,
  detectReactComponentContext,
  detectTrpcRouterContext,
} from './duplicate-query/detector';

// Normalizer
export {
  calculateQuerySimilarity,
  generatePrismaFingerprint,
  generateTrpcFingerprint,
  type NormalizedQuery,
  type NormalizedTrpcInput,
  normalizeQueryStructure,
  normalizeTrpcInput,
} from './duplicate-query/normalizer';

// Patterns
export {
  ALL_PRISMA_OPERATIONS,
  ALL_TRPC_HOOKS,
  COMPONENT_FILE_PATTERNS,
  HOOK_NAME_SUGGESTIONS,
  MAX_QUERIES_TO_ANALYZE,
  MIN_DUPLICATE_OCCURRENCES,
  PRISMA_CLIENT_IDENTIFIERS,
  PRISMA_READ_OPERATIONS,
  PRISMA_WRITE_OPERATIONS,
  ROUTER_FILE_PATTERNS,
  SIMILARITY_THRESHOLD,
  SKIP_FILE_PATTERNS as DUPLICATE_QUERY_SKIP_FILE_PATTERNS,
  SUGGESTED_FILE_LOCATIONS,
  TRPC_CLIENT_IDENTIFIERS,
  TRPC_MUTATION_HOOKS,
  TRPC_QUERY_HOOKS,
} from './duplicate-query/patterns';

// Types
export type {
  DuplicatePrismaQueryGroup,
  DuplicateTrpcQueryGroup,
  PrismaOperation,
  PrismaQueryInfo,
  QueryDetection,
  QueryDetectorContext,
  RefactoringSuggestion,
  TrpcHook,
  TrpcQueryInfo,
} from './duplicate-query/types';
