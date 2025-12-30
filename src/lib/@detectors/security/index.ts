/**
 * @module lib/@detectors/security
 * @description Unified security detection module
 *
 * Consolidates:
 * - Security issue detection (command injection, path traversal)
 * - Secrets detection (API keys, private keys, tokens, passwords)
 *
 * @example
 * ```typescript
 * import {
 *   detectSecurityIssue,
 *   detectSecret,
 *   ALL_PATTERNS
 * } from '@/lib/@detectors/security';
 * ```
 */

// ============================================================================
// SECURITY DETECTORS (command injection, path traversal)
// ============================================================================

export {
  detectCommandInjection,
  detectPathTraversal,
  detectSecurityIssue,
} from './security-detector';

// ============================================================================
// SECRETS DETECTORS
// ============================================================================

export {
  detectAllSecrets,
  detectApiToken,
  detectAwsCredentials,
  detectDatabaseCredentials,
  detectPrivateKey,
  detectSecret,
  scanContentForSecrets,
} from './secrets-detector';

// ============================================================================
// PATTERNS
// ============================================================================

export { ALL_PATTERNS } from './patterns';

// ============================================================================
// VALIDATORS
// ============================================================================

export {
  calculateEntropy,
  extractVariableName,
  getSeverityWeight,
  isEnvReference,
  isPlaceholder,
  isTestFile,
  redactSecret,
} from './validators';

// ============================================================================
// TYPES
// ============================================================================

export type {
  SecretDetection,
  SecretDetectionWithLine,
  SecretDetectorContext,
  SecretPattern,
  SecretPattern as Pattern,
  SecretSeverity,
  SecretType,
} from './types';
