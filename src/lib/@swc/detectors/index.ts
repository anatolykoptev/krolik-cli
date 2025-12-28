/**
 * @module lib/@swc/detectors
 * @description Reusable SWC AST detectors for code quality analysis
 *
 * This module provides pure detection functions that can be used
 * by analyzers and fixers alike. Each detector is a pure function
 * that takes an AST node and returns a detection result or null.
 *
 * @example
 * ```typescript
 * import { detectLintIssue, detectTypeSafetyIssue } from '@/lib/@swc/detectors';
 *
 * visitNode(ast, (node) => {
 *   const lintIssue = detectLintIssue(node);
 *   const typeIssue = detectTypeSafetyIssue(node);
 *   // ...
 * });
 * ```
 */

// ============================================================================
// TYPES
// ============================================================================

export type {
  DetectorContext,
  EnvConfigDetection,
  EnvConfigIssueType,
  EnvConfigSeverity,
  HardcodedDetection,
  HardcodedType,
  LintDetection,
  LintIssueType,
  ModernizationDetection,
  ModernizationIssueType,
  ReturnTypeDetection,
  ReturnTypeIssueType,
  SecurityDetection,
  SecurityIssueType,
  TypeSafetyDetection,
  TypeSafetyIssueType,
} from './types';

// ============================================================================
// LINT DETECTORS
// ============================================================================

export {
  detectAlert,
  detectConsole,
  detectDebugger,
  detectEmptyCatch,
  detectEval,
  detectLintIssue,
} from './lint-detector';

// ============================================================================
// TYPE-SAFETY DETECTORS
// ============================================================================

export {
  detectAnyAnnotation,
  detectAnyAssertion,
  detectDoubleAssertion,
  detectNonNullAssertion,
  detectTypeSafetyIssue,
  isAnyType,
  isUnknownType,
} from './type-detector';

// ============================================================================
// SECURITY DETECTORS
// ============================================================================

export {
  detectCommandInjection,
  detectPathTraversal,
  detectSecurityIssue,
} from './security-detector';

// ============================================================================
// MODERNIZATION DETECTORS
// ============================================================================

export {
  detectModernizationIssue,
  detectRequire,
} from './modernization-detector';

// ============================================================================
// HARDCODED VALUE DETECTORS
// ============================================================================

export {
  detectHardcodedUrl,
  detectHardcodedValue,
  detectHexColor,
  detectMagicNumber,
  isArrayIndex,
  isInConstDeclaration,
} from './hardcoded-detector';

// ============================================================================
// RETURN TYPE DETECTORS
// ============================================================================

export {
  detectDefaultExportReturnType,
  detectExportedFunctionReturnType,
  detectReturnTypeIssue,
} from './return-type-detector';

// ============================================================================
// ENVIRONMENT CONFIG DETECTORS
// ============================================================================

export type { EnvConfigPattern, UrlPattern, VariablePattern } from './env-config';

export {
  // Patterns
  ALL_PATTERNS as ENV_CONFIG_PATTERNS,
  API_ENDPOINT_PATTERNS,
  CONFIG_VAR_PATTERNS,
  CONFIGURABLE_PORTS, // @deprecated - use isConfigurablePort() instead
  DATABASE_HOSTNAME_PATTERNS,
  // Detectors
  detectApiEndpoint,
  detectCriticalEnvIssue,
  detectDatabaseHostname,
  detectEnvConfigIssue,
  detectEnvUrl,
  detectFeatureFlag,
  detectHardcodedPort,
  detectSecretOrApiKey,
  detectTimeoutValue,
  ENV_URL_PATTERNS,
  FEATURE_FLAG_PATTERNS,
  // Validators
  getParentVariableName,
  getPortCategory,
  hasEnvIndicator,
  isApiEndpoint as isApiEndpointUrl,
  isConfigurablePort,
  isConfigVariable,
  isDatabaseHostname,
  isFeatureFlagVariable,
  isSecretOrApiKey,
  isTimeoutVariable,
  SECRET_PATTERNS,
  shouldSkipFile as shouldSkipFileForEnvConfig,
  suggestEnvVarName,
  TIMEOUT_VAR_PATTERNS,
} from './env-config';

// ============================================================================
// SECRETS DETECTORS
// ============================================================================

export type {
  SecretDetection,
  SecretDetectionWithLine,
  SecretDetectorContext,
  SecretPattern,
  SecretSeverity,
  SecretType,
} from './secrets';

export {
  ALL_PATTERNS,
  calculateEntropy,
  detectAllSecrets,
  detectApiToken,
  detectAwsCredentials,
  detectDatabaseCredentials,
  detectPrivateKey,
  detectSecret,
  extractVariableName,
  getSeverityWeight,
  isEnvReference,
  isPlaceholder,
  isTestFile,
  redactSecret,
  scanContentForSecrets,
} from './secrets';

// ============================================================================
// COMPLEXITY DETECTORS
// ============================================================================

export type { ComplexityDetection, FunctionTrackingInfo } from './complexity-detector';

export {
  ComplexityTracker,
  getComplexityWeight,
  isComplexityNode,
} from './complexity-detector';
