/**
 * @module lib/@swc/detectors/secrets/patterns/database
 * @description Database connection string patterns
 */

import type { SecretPattern } from '../types';

/** PostgreSQL Connection String */
export const POSTGRES_CONNECTION: SecretPattern = {
  type: 'postgres-connection',
  pattern: /postgres(?:ql)?:\/\/[^:]+:[^@]+@[^/]+/,
  severity: 'critical',
  baseConfidence: 95,
  description: 'PostgreSQL Connection String with credentials',
};

/** MySQL Connection String */
export const MYSQL_CONNECTION: SecretPattern = {
  type: 'mysql-connection',
  pattern: /mysql:\/\/[^:]+:[^@]+@[^/]+/,
  severity: 'critical',
  baseConfidence: 95,
  description: 'MySQL Connection String with credentials',
};

/** MongoDB Connection String */
export const MONGODB_CONNECTION: SecretPattern = {
  type: 'mongodb-connection',
  pattern: /mongodb(?:\+srv)?:\/\/[^:]+:[^@]+@[^/]+/,
  severity: 'critical',
  baseConfidence: 95,
  description: 'MongoDB Connection String with credentials',
};

/** Redis Connection String */
export const REDIS_CONNECTION: SecretPattern = {
  type: 'redis-connection',
  pattern: /redis(?:s)?:\/\/[^:]*:[^@]+@[^/]+/,
  severity: 'critical',
  baseConfidence: 95,
  description: 'Redis Connection String with credentials',
};

// ============================================================================
// EXPORT ALL DATABASE PATTERNS
// ============================================================================

export const DATABASE_PATTERNS: SecretPattern[] = [
  POSTGRES_CONNECTION,
  MYSQL_CONNECTION,
  MONGODB_CONNECTION,
  REDIS_CONNECTION,
];
