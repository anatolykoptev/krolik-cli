/**
 * @module lib/@patterns/secrets
 * @description SWC AST detector for secrets and sensitive data in code
 *
 * Google-quality secrets detection with high precision and low false positives.
 *
 * Detects:
 * - API Keys (AWS, GCP, Azure, Stripe, GitHub, OpenAI, Twilio, SendGrid, etc.)
 * - Private Keys (RSA, SSH, PGP, EC)
 * - Tokens (JWT, OAuth, Bearer, Personal Access Tokens)
 * - Database Connection Strings (PostgreSQL, MySQL, MongoDB, Redis)
 * - Passwords in code (password assignments, connection strings)
 * - Generic high-entropy strings that look like secrets
 *
 * False Positive Prevention:
 * - Context-aware analysis (variable names, surrounding code)
 * - Entropy validation for generic patterns
 * - Placeholder/example value detection
 * - Test file exclusion options
 * - Environment variable reference detection
 */

// Detector functions
export {
  detectAllSecrets,
  detectApiToken,
  detectAwsCredentials,
  detectDatabaseCredentials,
  detectPrivateKey,
  detectSecret,
  scanContentForSecrets,
} from './detector';
// Patterns
export { ALL_PATTERNS } from './patterns';
// Types
export type {
  SecretDetection,
  SecretDetectionWithLine,
  SecretDetectorContext,
  SecretPattern,
  SecretPattern as Pattern,
  SecretSeverity,
  SecretType,
} from './types';
// Validators
export {
  calculateEntropy,
  extractVariableName,
  getSeverityWeight,
  isEnvReference,
  isPlaceholder,
  isTestFile,
  redactSecret,
} from './validators';
