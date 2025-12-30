/**
 * @module lib/@detectors/patterns
 * @description Consolidated pattern detection module
 *
 * Contains:
 * - browser-apis: Console, dialog, eval detection
 * - react-patterns: React hooks detection
 * - skip-logic: Directory/file skip patterns (merged from dynamic-skip + skip-patterns)
 * - context: TS directives + verb detection (merged from ts-directives + verb-detection)
 * - fixer-ids: Detection type to fixer ID mappings
 * - backwards-compat: Backwards-compatibility shim detection
 */

// AST-based detectors
// Export explicitly to avoid conflicts with issue-factory exports
export {
  ALL_PATTERNS,
  API_ENDPOINT_PATTERNS,
  CONFIG_VAR_PATTERNS,
  CONFIGURABLE_PORTS,
  // Complexity exports
  type ComplexityDetection,
  ComplexityTracker,
  calculateEntropy,
  DATABASE_HOSTNAME_PATTERNS,
  // Types
  type DetectorContext,
  // Lint detectors
  detectAlert,
  detectAllSecrets,
  // Type-safety detectors
  detectAnyAnnotation,
  detectAnyAssertion,
  detectApiEndpoint,
  detectApiToken,
  detectAwsCredentials,
  // Security detectors
  detectCommandInjection,
  detectConsole,
  detectCriticalEnvIssue,
  detectDatabaseCredentials,
  detectDatabaseHostname,
  detectDebugger,
  // Return type detectors
  detectDefaultExportReturnType,
  detectDoubleAssertion,
  detectEmptyCatch,
  detectEnvConfigIssue,
  detectEnvUrl,
  detectEval,
  detectExportedFunctionReturnType,
  detectFeatureFlag,
  detectHardcodedPort,
  // Hardcoded value detectors (from ast re-export)
  detectHardcodedUrl,
  detectHardcodedValue,
  detectHexColor,
  detectLintIssue,
  detectMagicNumber,
  // Modernization detectors
  detectModernizationIssue,
  detectNonNullAssertion,
  detectPathTraversal,
  detectPrivateKey,
  detectRequire,
  detectReturnTypeIssue,
  detectSecret,
  detectSecretOrApiKey,
  detectSecurityIssue,
  detectTimeoutValue,
  detectTypeSafetyIssue,
  // Env config exports
  ENV_CONFIG_PATTERNS,
  ENV_URL_PATTERNS,
  type EnvConfigDetection,
  type EnvConfigIssueType,
  // Env config types
  type EnvConfigPattern,
  type EnvConfigSeverity,
  extractVariableName,
  FEATURE_FLAG_PATTERNS,
  type FunctionTrackingInfo,
  getComplexityWeight,
  getParentVariableName,
  getPortCategory,
  getSeverityWeight,
  type HardcodedDetection,
  hasEnvIndicator,
  isAnyType,
  isApiEndpointUrl,
  isArrayIndex,
  isComplexityNode,
  isConfigurablePort,
  isConfigVariable,
  isDatabaseHostname,
  isEnvReference,
  isFeatureFlagVariable,
  isInConstDeclaration,
  isPlaceholder,
  isSecretOrApiKey,
  isTestFile,
  isTimeoutVariable,
  isUnknownType,
  // Note: HardcodedType from ast/types.ts is narrower than issue-factory/types.ts
  // We export the broader one from issue-factory
  type LintDetection,
  type LintIssueType,
  type ModernizationDetection,
  type ModernizationIssueType,
  type ReturnTypeDetection,
  type ReturnTypeIssueType,
  redactSecret,
  SECRET_PATTERNS,
  type SecretDetection,
  // Secrets exports
  type SecretDetectionWithLine,
  type SecretDetectorContext,
  type SecretPattern,
  type SecretSeverity,
  type SecretType,
  type SecurityDetection,
  type SecurityIssueType,
  scanContentForSecrets,
  shouldSkipFileForEnvConfig,
  suggestEnvVarName,
  TIMEOUT_VAR_PATTERNS,
  type TypeSafetyDetection,
  type TypeSafetyIssueType,
  type UrlPattern,
  type VariablePattern,
} from './ast';
// Backwards-compat detection
export {
  type BackwardsCompatDetection,
  type BackwardsCompatFile,
  detectBackwardsCompat,
  detectBackwardsCompatFiles,
  isBackwardsCompatShim,
} from './backwards-compat';
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

// Context patterns (merged from ts-directives + verb-detection)
export {
  checkTsDirectives,
  checkTsIgnore,
  checkTsNoCheck,
  countTsDirectives,
  detectVerbPrefix,
  extractVerbPrefix,
  groupByVerbPrefix,
  isActionVerbName,
  isEventHandlerName,
  isVerbLike,
} from './context';
// File context
export * from './file-context';
// Fixer ID mappings
export {
  COMPLEXITY_FIXER_ID,
  type DetectionCategory,
  getFixerId,
  getLintFixerId,
  getModernizationFixerId,
  getReturnTypeFixerId,
  getSecurityFixerId,
  getTypeSafetyFixerId,
  LINT_FIXER_IDS,
  LONG_FUNCTION_FIXER_ID,
  MODERNIZATION_FIXER_IDS,
  RETURN_TYPE_FIXER_ID,
  SECURITY_FIXER_IDS,
  TS_DIRECTIVE_FIXER_ID,
  TYPE_SAFETY_FIXER_IDS,
} from './fixer-ids';
// Issue factory
export * from './issue-factory';
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
// Skip logic (merged from dynamic-skip + skip-patterns)
export {
  ANALYZER_SKIP_PATTERNS,
  BASE_SKIP_DIRS,
  COMMON_SKIP_DIRS,
  clearSkipPatternCache,
  clearSkipPatternsCache,
  ENV_CONFIG_SKIP_PATTERNS,
  generateSkipPatterns,
  getAnalyzerSkipPatterns,
  getSkipPatterns,
  HARDCODED_SKIP_PATTERNS,
  invalidateSkipPatterns,
  LINT_SKIP_PATTERNS,
  shouldSkipDir,
  shouldSkipForAnalysis,
  shouldSkipForEnvConfig,
  shouldSkipForHardcoded,
  shouldSkipForLint,
  TOOL_DIR_MAP,
} from './skip-logic';
