/**
 * @module lib/@detectors/security/patterns/private-keys
 * @description Private key patterns for cryptographic material
 */

import type { SecretPattern } from '../types';

/** RSA Private Key */
export const RSA_PRIVATE_KEY: SecretPattern = {
  type: 'rsa-private-key',
  pattern: /-----BEGIN RSA PRIVATE KEY-----/,
  severity: 'critical',
  baseConfidence: 99,
  description: 'RSA Private Key',
};

/** SSH Private Key (OpenSSH format) */
export const OPENSSH_PRIVATE_KEY: SecretPattern = {
  type: 'openssh-private-key',
  pattern: /-----BEGIN OPENSSH PRIVATE KEY-----/,
  severity: 'critical',
  baseConfidence: 99,
  description: 'OpenSSH Private Key',
};

/** EC Private Key */
export const EC_PRIVATE_KEY: SecretPattern = {
  type: 'ec-private-key',
  pattern: /-----BEGIN EC PRIVATE KEY-----/,
  severity: 'critical',
  baseConfidence: 99,
  description: 'EC Private Key',
};

/** PGP Private Key */
export const PGP_PRIVATE_KEY: SecretPattern = {
  type: 'pgp-private-key',
  pattern: /-----BEGIN PGP PRIVATE KEY BLOCK-----/,
  severity: 'critical',
  baseConfidence: 99,
  description: 'PGP Private Key',
};

/** PKCS8 Private Key */
export const PKCS8_PRIVATE_KEY: SecretPattern = {
  type: 'pkcs8-private-key',
  pattern: /-----BEGIN PRIVATE KEY-----/,
  severity: 'critical',
  baseConfidence: 99,
  description: 'PKCS8 Private Key',
};

/** DSA Private Key */
export const DSA_PRIVATE_KEY: SecretPattern = {
  type: 'ssh-private-key',
  pattern: /-----BEGIN DSA PRIVATE KEY-----/,
  severity: 'critical',
  baseConfidence: 99,
  description: 'DSA Private Key',
};

// ============================================================================
// EXPORT ALL PRIVATE KEY PATTERNS
// ============================================================================

export const PRIVATE_KEY_PATTERNS: SecretPattern[] = [
  RSA_PRIVATE_KEY,
  OPENSSH_PRIVATE_KEY,
  EC_PRIVATE_KEY,
  PGP_PRIVATE_KEY,
  PKCS8_PRIVATE_KEY,
  DSA_PRIVATE_KEY,
];
