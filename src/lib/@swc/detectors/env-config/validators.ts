/**
 * @module lib/@swc/detectors/env-config/validators
 * @deprecated Use '@/lib/@patterns/env-config/validators' instead.
 * This module re-exports from the canonical location for backward compatibility.
 */

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
} from '@/lib/@patterns/env-config/validators';
