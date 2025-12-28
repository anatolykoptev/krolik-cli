/**
 * @module lib/@swc/detectors/secrets/patterns
 * @description All secret patterns in priority order
 *
 * Patterns are ordered from most specific to least specific:
 * 1. Private Keys (highest priority, no false positives)
 * 2. Highly specific API keys (prefix-based detection)
 * 3. Database connection strings
 * 4. Tokens (JWT, Bearer)
 * 5. Context-dependent patterns (require variable name validation)
 */

import type { SecretPattern } from '../types';
import { API_KEY_PATTERNS, CONTEXT_DEPENDENT_API_KEYS } from './api-keys';
import { DATABASE_PATTERNS } from './database';
import { PASSWORD_PATTERNS } from './passwords';
import { PRIVATE_KEY_PATTERNS } from './private-keys';
import { TOKEN_PATTERNS } from './tokens';

// Re-export for convenience
export * from './api-keys';
export * from './database';
export * from './passwords';
export * from './private-keys';
export * from './tokens';

/**
 * All secret patterns in priority order (most specific first)
 */
export const ALL_PATTERNS: SecretPattern[] = [
  // Private Keys (most specific, highest priority)
  ...PRIVATE_KEY_PATTERNS,

  // Highly specific API keys
  ...API_KEY_PATTERNS,

  // Database connection strings
  ...DATABASE_PATTERNS,
  ...PASSWORD_PATTERNS,

  // Tokens
  ...TOKEN_PATTERNS,

  // Less specific (require context validation)
  ...CONTEXT_DEPENDENT_API_KEYS,
];
