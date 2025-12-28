/**
 * @module lib/@patterns/env-config
 * @description SWC AST detector for environment-specific configuration issues
 *
 * Detects hardcoded values that should come from environment variables:
 * - URLs with dev/staging/prod indicators
 * - Port numbers in non-config files
 * - Database hostnames (localhost, 127.0.0.1 in production code)
 * - API endpoints that differ per environment
 * - Feature flags hardcoded as booleans
 * - Timeout values that should be configurable
 * - API keys and secrets (critical severity)
 */

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
} from './detector';

// Patterns
export {
  ALL_PATTERNS,
  API_ENDPOINT_PATTERNS,
  CONFIG_VAR_PATTERNS,
  CONFIGURABLE_PORTS, // @deprecated - use isConfigurablePort() instead
  DATABASE_HOSTNAME_PATTERNS,
  ENV_URL_PATTERNS,
  FEATURE_FLAG_PATTERNS,
  getPortCategory,
  isConfigurablePort as isConfigurablePortPattern,
  SECRET_PATTERNS,
  TIMEOUT_VAR_PATTERNS,
} from './patterns';
// Types
export type {
  DetectorContext,
  EnvConfigDetection,
  EnvConfigIssueType,
  EnvConfigPattern,
  EnvConfigSeverity,
  UrlPattern,
  VariablePattern,
} from './types';
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
  shouldSkipFile,
  suggestEnvVarName,
} from './validators';
