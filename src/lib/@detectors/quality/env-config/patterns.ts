/**
 * @module lib/@detectors/quality/env-config/patterns
 * @description Patterns for detecting environment-specific configuration issues
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

// ============================================================================
// URL PATTERNS
// ============================================================================

/** URL patterns indicating environment-specific endpoints */
export const ENV_URL_PATTERNS = [
  /https?:\/\/[^/]*\b(dev|development|staging|stage|stg|prod|production|test|qa|uat|sandbox|preprod|pre-prod)\b/i,
  /https?:\/\/api\.(dev|staging|prod|test)\./i,
  /https?:\/\/(dev|staging|prod|test)-/i,
  /https?:\/\/[^/]+-?(dev|staging|prod|test)\./i,
] as const;

/** API endpoint patterns */
export const API_ENDPOINT_PATTERNS = [
  /https?:\/\/api\./i,
  /https?:\/\/[^/]+\/api\//i,
  /https?:\/\/[^/]+\/v[0-9]+\//i,
  /https?:\/\/[^/]+\/graphql/i,
  /https?:\/\/[^/]+\/rest\//i,
] as const;

// ============================================================================
// DATABASE PATTERNS
// ============================================================================

/** Database hostname patterns that indicate local/hardcoded config */
export const DATABASE_HOSTNAME_PATTERNS = [
  /^localhost$/,
  /^127\.0\.0\.1$/,
  /^0\.0\.0\.0$/,
  /^host\.docker\.internal$/,
  /^db$/,
  /^database$/,
  /^postgres(ql)?$/i,
  /^mysql$/i,
  /^mongo(db)?$/i,
  /^redis$/i,
  /\.rds\.amazonaws\.com$/i, // Any RDS hostname
  /\.docdb\.amazonaws\.com$/i, // DocumentDB
  /\.elasticache\.amazonaws\.com$/i, // ElastiCache
] as const;

// ============================================================================
// PORT PATTERNS
// ============================================================================

/**
 * Port ranges that indicate environment-configurable dev/server ports
 * Semantic detection: ports in these ranges are likely configurable
 */
const PORT_RANGES = [
  { min: 3000, max: 3999, category: 'dev-server' }, // Common dev servers (Next, React, etc.)
  { min: 4000, max: 4999, category: 'dev-server' }, // Angular, alternative dev
  { min: 5000, max: 5999, category: 'dev-server' }, // Flask, Vite, Python
  { min: 8000, max: 8999, category: 'http' }, // HTTP alternatives
  { min: 9000, max: 9999, category: 'monitoring' }, // Monitoring, admin
] as const;

/**
 * Well-known database/service ports (semantic)
 */
const SERVICE_PORTS = new Set([
  27017, // MongoDB
  5432, // PostgreSQL
  3306, // MySQL
  6379, // Redis
  11211, // Memcached
  9200, // Elasticsearch
  9300, // Elasticsearch transport
  2181, // Zookeeper
  9092, // Kafka
  6650, // Pulsar
  4222, // NATS
]);

/**
 * Check if a port number should be environment-configurable
 *
 * Uses semantic analysis:
 * 1. Well-known service ports (database, cache, messaging)
 * 2. Dev server port ranges (3000-5999)
 * 3. HTTP alternative port ranges (8000-9999)
 */
export function isConfigurablePort(port: number): boolean {
  // Well-known service ports are always configurable
  if (SERVICE_PORTS.has(port)) {
    return true;
  }

  // Check if port falls within configurable ranges
  for (const range of PORT_RANGES) {
    if (port >= range.min && port <= range.max) {
      return true;
    }
  }

  return false;
}

/**
 * Get port category for classification
 */
export function getPortCategory(port: number): string | null {
  if (SERVICE_PORTS.has(port)) {
    return 'service';
  }

  for (const range of PORT_RANGES) {
    if (port >= range.min && port <= range.max) {
      return range.category;
    }
  }

  return null;
}

/**
 * Legacy export for backward compatibility
 * @deprecated Use isConfigurablePort() instead
 */
export const CONFIGURABLE_PORTS = new Set([
  ...SERVICE_PORTS,
  // Common specific ports from the ranges
  3000,
  3001,
  3002,
  3003,
  3004,
  3005,
  4000,
  4200,
  4201,
  5000,
  5001,
  5173,
  5174,
  8000,
  8080,
  8081,
  8443,
  9000,
  9090,
]);

// ============================================================================
// SECRET PATTERNS
// ============================================================================

/** Secret/API key patterns - CRITICAL severity */
export const SECRET_PATTERNS = [
  /^sk[-_]/i, // Stripe secret keys
  /^pk[-_]/i, // Stripe publishable keys (still sensitive)
  /^AKIA[0-9A-Z]{16}$/i, // AWS Access Key ID
  /^ghp_[a-zA-Z0-9]{36}$/, // GitHub personal access token
  /^github_pat_[a-zA-Z0-9_]{82}$/, // GitHub fine-grained PAT
  /^gho_[a-zA-Z0-9]{36}$/, // GitHub OAuth token
  /^ghr_[a-zA-Z0-9]{36}$/, // GitHub refresh token
  /^gitlab-ci-token$/i,
  /^glpat-[a-zA-Z0-9_-]{20,}$/, // GitLab personal access token
  /^xox[baprs]-[0-9]{10,}-[a-zA-Z0-9-]+$/, // Slack tokens
  /^Bearer\s+[a-zA-Z0-9._-]+$/i,
  /^Basic\s+[a-zA-Z0-9+/=]+$/i,
  /^eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/, // JWT
  /^AIza[0-9A-Za-z_-]{35}$/, // Google API key
  /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/, // Google OAuth client ID
  /^SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}$/, // SendGrid API key
  /^AC[a-f0-9]{32}$/, // Twilio Account SID
  /^[a-f0-9]{32}$/, // Generic 32-char hex (often API keys)
] as const;

// ============================================================================
// VARIABLE NAME PATTERNS
// ============================================================================

/** Feature flag variable name patterns */
export const FEATURE_FLAG_PATTERNS = [
  /^(is|has|enable|disable|show|hide|use|allow|can)[A-Z_]/,
  /^(FEATURE|FLAG|TOGGLE|EXPERIMENT)_/i,
  /_ENABLED$/i,
  /_DISABLED$/i,
  /_FEATURE$/i,
  /_FLAG$/i,
] as const;

/** Timeout/interval variable name patterns */
export const TIMEOUT_VAR_PATTERNS = [
  /timeout/i,
  /delay/i,
  /interval/i,
  /duration/i,
  /ttl/i,
  /expire/i,
  /retry/i,
  /backoff/i,
  /wait/i,
  /poll/i,
] as const;

/** Variable name patterns that indicate intentional configuration */
export const CONFIG_VAR_PATTERNS = [
  /^(DEFAULT|FALLBACK|TEST|MOCK|EXAMPLE|SAMPLE|DEMO)_/i,
  /_(DEFAULT|FALLBACK|TEST|MOCK|EXAMPLE|SAMPLE|DEMO)$/i,
  /^process\.env\./,
  /^import\.meta\.env\./,
  /^env\./i,
  /^config\./i,
] as const;

// ============================================================================
// ALL PATTERNS COLLECTION
// ============================================================================

/**
 * All patterns organized by category for easy access
 */
export const ALL_PATTERNS = {
  envUrl: ENV_URL_PATTERNS,
  apiEndpoint: API_ENDPOINT_PATTERNS,
  databaseHostname: DATABASE_HOSTNAME_PATTERNS,
  configurablePorts: CONFIGURABLE_PORTS,
  secrets: SECRET_PATTERNS,
  featureFlag: FEATURE_FLAG_PATTERNS,
  timeout: TIMEOUT_VAR_PATTERNS,
  configVar: CONFIG_VAR_PATTERNS,
} as const;
