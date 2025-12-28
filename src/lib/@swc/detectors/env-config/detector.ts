/**
 * @module lib/@swc/detectors/env-config/detector
 * @deprecated Use '@/lib/@patterns/env-config/detector' instead.
 * This module re-exports from the canonical location for backward compatibility.
 */

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
} from '@/lib/@patterns/env-config/detector';
