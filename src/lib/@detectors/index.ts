/**
 * @module lib/@detectors
 * @description Unified code quality patterns - single source of truth
 *
 * This module consolidates all detection patterns used by:
 * - quality analyzers (detection)
 * - fix strategies (fixing)
 *
 * Submodules:
 * - ast/ - AST-based detectors (SWC)
 * - file-context/ - File type detection, skip logic
 * - quality/ - Complexity, hardcoded, env-config patterns
 * - patterns/ - Consolidated patterns module:
 *   - browser-apis - Console, dialog, eval detection
 *   - react-patterns - React hooks detection
 *   - skip-logic - Directory/file skip patterns
 *   - context - TS directives + verb detection
 *   - fixer-ids - Detection type to fixer ID mappings
 *   - backwards-compat - Backwards-compatibility shim detection
 * - lint/ - Console, debugger, alert patterns
 * - issue-factory/ - Detection to QualityIssue conversion
 *
 * Benefits:
 * - No duplication between quality and fix
 * - Consistent pattern definitions
 * - O(1) fixer ID lookups
 * - Centralized issue message templates
 * - Easy to extend and maintain
 */

// Complexity patterns (re-exported from quality/)
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
// Patterns module (consolidated)
export {
  // React patterns
  ALL_BUILT_IN_HOOKS,
  // Skip logic (directory traversal)
  ANALYZER_SKIP_PATTERNS,
  BASE_SKIP_DIRS,
  // Backwards-compat detection
  type BackwardsCompatDetection,
  type BackwardsCompatFile,
  // Browser API patterns
  type BrowserApiCategory,
  type BrowserApiDetection,
  COMMON_SKIP_DIRS,
  // Fixer ID mappings
  COMPLEXITY_FIXER_ID,
  CONSOLE_OBJECT_NAMES,
  CONSOLE_PARENT_OBJECTS,
  // Context patterns (TS directives + verb detection)
  checkTsDirectives,
  checkTsIgnore,
  checkTsNoCheck,
  clearSkipPatternCache,
  clearSkipPatternsCache,
  countTsDirectives,
  type DetectionCategory,
  DIALOG_FUNCTION_NAMES,
  DIALOG_PARENT_OBJECTS,
  detectBackwardsCompat,
  detectBackwardsCompatFiles,
  detectBrowserApi,
  detectVerbPrefix,
  ENV_CONFIG_SKIP_PATTERNS,
  EVAL_FUNCTION_NAMES,
  EVAL_LIKE_PATTERNS,
  extractCustomHooks,
  extractHookNames,
  extractVerbPrefix,
  generateSkipPatterns,
  getAnalyzerSkipPatterns,
  getFixerId,
  getLintFixerId,
  getModernizationFixerId,
  getReturnTypeFixerId,
  getSecurityFixerId,
  getSkipPatterns,
  getTypeSafetyFixerId,
  groupByVerbPrefix,
  HARDCODED_SKIP_PATTERNS,
  HOOK_CALL_PATTERN,
  invalidateSkipPatterns,
  isActionVerbName,
  isBackwardsCompatShim,
  isBuiltInHook,
  isConsoleMember,
  isCustomHook,
  isDialogFunction,
  isEvalFunction,
  isEventHandlerName,
  isReactHook,
  isVerbLike,
  KNOWN_CONSOLE_METHODS,
  LINT_FIXER_IDS,
  LINT_SKIP_PATTERNS,
  LONG_FUNCTION_FIXER_ID,
  MODERNIZATION_FIXER_IDS,
  REACT_BUILT_IN_HOOKS,
  REACT_DOM_BUILT_IN_HOOKS,
  REACT_HOOK_PATTERN,
  REACT_PACKAGE_IDENTIFIERS,
  RETURN_TYPE_FIXER_ID,
  SECURITY_FIXER_IDS,
  shouldSkipDir,
  shouldSkipForAnalysis,
  shouldSkipForEnvConfig,
  shouldSkipForHardcoded,
  shouldSkipForLint,
  TOOL_DIR_MAP,
  TS_DIRECTIVE_FIXER_ID,
  TYPE_SAFETY_FIXER_IDS,
} from './patterns';
// AST-based detectors (SWC)
export * from './patterns/ast';

// File context (migrated from @context)
export {
  API_FILE_PATTERNS,
  buildFileContext,
  buildFileContextFromRelative,
  CLI_FILE_PATTERNS,
  COMPONENT_FILE_PATTERNS,
  CONFIG_FILE_PATTERNS,
  contextAllowsConsole,
  contextRequiresStrictLint,
  detectFileType,
  type FileContext,
  type FileContextOptions,
  type FileType,
  HOOK_FILE_PATTERNS,
  isApiFile,
  isCliFile,
  isComponentFile,
  isConfigFile,
  isHookFile,
  isOutputFile,
  isSchemaFile,
  isTestFile,
  isUtilFile,
  OUTPUT_FILE_PATTERNS,
  SCHEMA_FILE_PATTERNS,
  shouldSkipConsole,
  shouldSkipLint,
  TEST_FILE_PATTERNS,
  UTIL_FILE_PATTERNS,
} from './patterns/file-context';
// Issue factory (detection to QualityIssue conversion)
export type {
  ComplexityIssueContext,
  FunctionComplexityInfo,
  IssueFactoryContext,
  TsDirectiveType,
} from './patterns/issue-factory';
export {
  createComplexityIssues,
  createHardcodedValue,
  createHardcodedValues,
  createHighComplexityIssue,
  createLintIssue,
  createLintIssues,
  createLongFunctionIssue,
  createModernizationIssue,
  createModernizationIssues,
  createReturnTypeIssue,
  createReturnTypeIssues,
  createSecurityIssue,
  createSecurityIssues,
  createTsDirectiveIssue,
  createTypeSafetyIssue,
  createTypeSafetyIssues,
  getHardcodedSuggestion,
} from './patterns/issue-factory';
// Quality detectors (complexity AST tracker, hardcoded, env-config)
export {
  // Hardcoded patterns
  ACCEPTABLE_NUMBERS,
  API_ENDPOINT_PATTERNS,
  CONFIG_VAR_PATTERNS,
  CONFIGURABLE_PORTS,
  CONST_DECL_PATTERN,
  type ComplexityDetection,
  // Complexity AST tracker
  ComplexityTracker,
  DATABASE_HOSTNAME_PATTERNS,
  // Env-config patterns
  detectApiEndpoint,
  detectCriticalEnvIssue,
  detectDatabaseHostname,
  detectEnvConfigIssue,
  detectEnvUrl,
  detectFeatureFlag,
  detectHardcodedPort,
  detectHardcodedUrl,
  detectHardcodedValue,
  detectHexColor,
  detectMagicNumber,
  detectSecretOrApiKey,
  detectTimeoutValue,
  ENV_CONFIG_PATTERNS,
  ENV_URL_PATTERNS,
  type EnvConfigPattern,
  FEATURE_FLAG_PATTERNS,
  type FunctionTrackingInfo,
  getComplexityWeight,
  getConstNameFromKeyword,
  getKnownConstantName,
  getParentVariableName,
  getPortCategory,
  HARDCODED_DETECTION_PATTERNS,
  HARDCODED_FIXABLE_PATTERNS,
  HARDCODED_SKIP_FILE_PATTERNS,
  hasEnvIndicator,
  isAcceptableNumber,
  isApiEndpoint,
  isArrayIndex,
  isComplexityNode,
  isConfigurablePort,
  isConfigurablePortPattern,
  isConfigVariable,
  isDatabaseHostname,
  isFeatureFlagVariable,
  isInConstDeclaration,
  isSecretOrApiKey,
  isTimeoutVariable,
  KEYWORD_TO_CONST_NAME,
  KNOWN_CONSTANTS,
  SECRET_PATTERNS,
  SKIP_URL_PATTERNS,
  shouldSkipEnvConfigFile,
  shouldSkipHardcodedFile,
  shouldSkipLine,
  shouldSkipUrl,
  suggestEnvVarName,
  TIMEOUT_VAR_PATTERNS,
  type UrlPattern,
  type VariablePattern,
} from './quality';
// Hardcoded patterns (re-exported from quality/hardcoded for backward compatibility)
export {
  DETECTION_PATTERNS as HARDCODED_DETECTION_PATTERNS_ALIAS,
  FIXABLE_PATTERNS as HARDCODED_FIXABLE_PATTERNS_ALIAS,
  SKIP_FILE_PATTERNS,
  shouldSkipFile,
} from './quality/hardcoded/index';
// Shared types
export type {
  HardcodedType,
  HardcodedValue,
  PatternMatch,
  QualityCategory,
  Severity,
} from './types';
