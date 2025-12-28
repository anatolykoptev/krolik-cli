/**
 * @module lib/@swc/detectors/secrets/patterns/tokens
 * @description Token patterns for JWT, OAuth, Bearer tokens
 */

import type { SecretPattern } from '../types';
import { calculateEntropy } from '../validators';

/** JWT Token - Format: eyJ[base64].eyJ[base64].[signature] */
export const JWT_TOKEN: SecretPattern = {
  type: 'jwt-token',
  pattern: /\beyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\b/,
  severity: 'high',
  baseConfidence: 70,
  description: 'JWT Token',
  validate: (inputVal, context) => {
    // Validate it's not a placeholder or example
    if (inputVal.length < 50) return false;
    // Check if it's in a meaningful context
    const name = context?.variableName?.toLowerCase() ?? '';
    return !name.includes('example') && !name.includes('sample') && !name.includes('test');
  },
};

/** Bearer Token in Authorization header */
export const BEARER_TOKEN: SecretPattern = {
  type: 'bearer-token',
  pattern: /Bearer\s+[A-Za-z0-9_-]{20,}/,
  severity: 'high',
  baseConfidence: 80,
  description: 'Bearer Token',
};

/** Basic Auth (base64 encoded credentials) */
export const BASIC_AUTH: SecretPattern = {
  type: 'basic-auth',
  pattern: /Basic\s+[A-Za-z0-9+/=]{20,}/,
  severity: 'high',
  baseConfidence: 80,
  description: 'Basic Auth Credentials',
};

/** High Entropy String (potential secret) */
export const HIGH_ENTROPY_STRING: SecretPattern = {
  type: 'high-entropy-string',
  pattern: /\b[A-Za-z0-9+/=_-]{40,}\b/,
  severity: 'medium',
  baseConfidence: 50,
  description: 'High-entropy string (potential secret)',
  validate: (inputVal, context) => {
    // Must be in a secret-like context
    const name = context?.variableName?.toLowerCase() ?? '';
    const hasSecretContext =
      name.includes('secret') ||
      name.includes('key') ||
      name.includes('token') ||
      name.includes('password') ||
      name.includes('credential') ||
      name.includes('auth');

    if (!hasSecretContext) return false;

    // Must have high entropy
    const entropy = calculateEntropy(inputVal);
    const threshold = context?.entropyThreshold ?? 4.0;
    return entropy >= threshold;
  },
};

// ============================================================================
// EXPORT ALL TOKEN PATTERNS
// ============================================================================

export const TOKEN_PATTERNS: SecretPattern[] = [
  JWT_TOKEN,
  BEARER_TOKEN,
  BASIC_AUTH,
  HIGH_ENTROPY_STRING,
];
