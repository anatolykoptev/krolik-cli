/**
 * @module lib/@swc/detectors/secrets/patterns/passwords
 * @description Password patterns for hardcoded credentials
 */

import type { SecretPattern } from '../types';

/** Password Assignment - Looks for password = "..." patterns */
export const PASSWORD_ASSIGNMENT: SecretPattern = {
  type: 'password-assignment',
  pattern: /(?:password|passwd|pwd|pass)\s*[=:]\s*["'][^"']{8,}["']/i,
  severity: 'high',
  baseConfidence: 75,
  description: 'Hardcoded Password',
  validate: (val, context) => {
    // Skip if in test context
    if (context?.isTestFile) return false;
    // Skip common placeholders
    const lower = val.toLowerCase();
    return (
      !lower.includes('example') &&
      !lower.includes('placeholder') &&
      !lower.includes('changeme') &&
      !lower.includes('password123') &&
      !lower.includes('xxxxxxxx')
    );
  },
};

/** Password in URL */
export const PASSWORD_IN_URL: SecretPattern = {
  type: 'password-in-url',
  pattern: /:\/\/[^:]+:([^@]{8,})@/,
  severity: 'critical',
  baseConfidence: 90,
  description: 'Password embedded in URL',
};

// ============================================================================
// EXPORT ALL PASSWORD PATTERNS
// ============================================================================

export const PASSWORD_PATTERNS: SecretPattern[] = [PASSWORD_ASSIGNMENT, PASSWORD_IN_URL];
