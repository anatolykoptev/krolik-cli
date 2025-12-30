/**
 * @module lib/@detectors/ast
 * @description AST-based detectors for code quality analysis (SWC)
 *
 * This module provides pure detection functions that work on AST nodes.
 * Each detector takes a SWC AST node and returns a detection result or null.
 *
 * @example
 * ```typescript
 * import { detectLintIssue, detectTypeSafetyIssue } from '@/lib/@detectors/ast';
 *
 * visitNode(ast, (node) => {
 *   const lintIssue = detectLintIssue(node);
 *   const typeIssue = detectTypeSafetyIssue(node);
 *   // ...
 * });
 * ```
 */

// ============================================================================
// TYPES (canonical source)
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
  SecretDetection,
  SecretDetectorContext,
  SecretSeverity,
  SecretType,
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
} from '../../lint/lint-detector';

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
} from '../../lint/type-safety-detector';

// ============================================================================
// SECURITY DETECTORS
// ============================================================================

export {
  detectCommandInjection,
  detectPathTraversal,
  detectSecurityIssue,
} from '../../security/security-detector';

// ============================================================================
// MODERNIZATION DETECTORS
// ============================================================================

export {
  detectModernizationIssue,
  detectRequire,
} from '../../modernization/detector';

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
} from '../../quality/hardcoded/detector';

// ============================================================================
// RETURN TYPE DETECTORS (local implementation)
// ============================================================================

export {
  detectDefaultExportReturnType,
  detectExportedFunctionReturnType,
  detectReturnTypeIssue,
} from './return-type-detector';

// ============================================================================
// ENVIRONMENT CONFIG DETECTORS
// ============================================================================

export type { EnvConfigPattern, UrlPattern, VariablePattern } from '../../quality/env-config';

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
} from '../../quality/env-config';

// ============================================================================
// SECRETS DETECTORS
// ============================================================================

export type {
  SecretDetectionWithLine,
  SecretPattern,
} from '../../security';

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
} from '../../security';

// ============================================================================
// COMPLEXITY DETECTORS
// ============================================================================

export type { ComplexityDetection, FunctionTrackingInfo } from '../../quality/complexity/detector';

export {
  ComplexityTracker,
  getComplexityWeight,
  isComplexityNode,
} from '../../quality/complexity/detector';
