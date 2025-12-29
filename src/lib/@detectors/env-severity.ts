/**
 * @module lib/@detectors/env-severity
 * @description Semantic analysis for environment variable severity detection
 *
 * Uses word-based semantic analysis instead of hardcoded pattern lists.
 * Analyzes the meaning of env var name segments to determine sensitivity level.
 *
 * Used by:
 * - commands/context/formatters/ai/sections/advanced-analysis.ts
 */

import type { Priority } from '@/types/severity';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Env var severity level (uses Priority type for consistency)
 */
export type EnvVarSeverity = Priority;

/**
 * Result of semantic analysis
 */
export interface EnvVarAnalysis {
  /** Detected severity level */
  severity: EnvVarSeverity;
  /** Reason for classification */
  reason: string;
  /** Semantic categories detected */
  categories: string[];
}

// ============================================================================
// SEMANTIC WORD CATEGORIES
// ============================================================================

/**
 * Words indicating database connections (critical)
 */
const DATABASE_WORDS = new Set([
  'database',
  'db',
  'postgres',
  'postgresql',
  'mysql',
  'mongo',
  'mongodb',
  'redis',
  'sqlite',
  'mariadb',
  'cassandra',
  'dynamodb',
  'connection',
  'conn',
  'dsn',
  'prisma',
]);

/**
 * Words indicating authentication/encryption secrets (critical)
 */
const AUTH_SECRET_WORDS = new Set([
  'secret',
  'private',
  'encryption',
  'encrypt',
  'decrypt',
  'signing',
  'jwt',
  'auth',
  'oauth',
  'nextauth',
  'session',
  'cookie',
  'hmac',
  'cipher',
  'salt',
  'hash',
  'pepper',
]);

/**
 * Words indicating API keys and tokens (high)
 */
const CREDENTIAL_WORDS = new Set([
  'key',
  'token',
  'password',
  'pwd',
  'passwd',
  'credential',
  'cred',
  'bearer',
  'access',
  'refresh',
  'apikey',
  'api',
]);

/**
 * Known third-party service prefixes (high - likely credentials)
 */
const THIRD_PARTY_SERVICES = new Set([
  'stripe',
  'aws',
  'azure',
  'gcp',
  'google',
  'github',
  'gitlab',
  'bitbucket',
  'sentry',
  'datadog',
  'newrelic',
  'twilio',
  'sendgrid',
  'mailgun',
  'mailchimp',
  'pusher',
  'algolia',
  'cloudflare',
  'vercel',
  'netlify',
  'heroku',
  'firebase',
  'supabase',
  'planetscale',
  'neon',
  'upstash',
  's3',
  'sqs',
  'sns',
  'lambda',
  'openai',
  'anthropic',
  'cohere',
  'huggingface',
  'replicate',
  'resend',
  'clerk',
  'auth0',
  'okta',
  'segment',
  'mixpanel',
  'amplitude',
  'plausible',
  'posthog',
  'tinybird',
  'turso',
]);

/**
 * Words indicating URLs and endpoints (medium unless internal)
 */
const URL_WORDS = new Set([
  'url',
  'uri',
  'endpoint',
  'host',
  'hostname',
  'domain',
  'origin',
  'href',
  'link',
  'base',
  'site',
  'webhook',
  'callback',
]);

/**
 * Words indicating public/safe configuration (medium/low)
 */
const PUBLIC_WORDS = new Set(['public', 'client', 'browser', 'frontend', 'visible']);

/**
 * Words indicating app configuration (medium)
 */
const CONFIG_WORDS = new Set([
  'app',
  'config',
  'setting',
  'env',
  'environment',
  'mode',
  'stage',
  'feature',
  'flag',
  'enable',
  'disable',
  'debug',
  'log',
  'level',
  'port',
  'version',
  'name',
  'title',
  'description',
]);

// ============================================================================
// SEMANTIC ANALYSIS
// ============================================================================

/**
 * Split env var name into semantic segments
 * Handles SCREAMING_SNAKE_CASE and various separators
 */
function getSegments(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[_\-.]/)
    .filter((s) => s.length > 0);
}

/**
 * Check if any segment matches a word set
 */
function hasMatch(segments: string[], wordSet: Set<string>): boolean {
  return segments.some((seg) => wordSet.has(seg));
}

/**
 * Check if name starts with a known third-party service
 */
function startsWithService(segments: string[]): string | null {
  const first = segments[0];
  if (first && THIRD_PARTY_SERVICES.has(first)) {
    return first;
  }
  return null;
}

/**
 * Check if the variable is explicitly marked as public
 */
function isPublic(segments: string[]): boolean {
  // Check for NEXT_PUBLIC_, VITE_PUBLIC_, PUBLIC_ prefixes
  return segments.includes('public') || hasMatch(segments, PUBLIC_WORDS);
}

/**
 * Check for compound patterns that increase severity
 */
function hasCompoundPattern(segments: string[]): { match: boolean; pattern: string } {
  // DATABASE + URL = critical (connection string)
  if (hasMatch(segments, DATABASE_WORDS) && hasMatch(segments, URL_WORDS)) {
    return { match: true, pattern: 'database-connection' };
  }

  // SECRET + KEY = critical
  if (segments.includes('secret') && segments.includes('key')) {
    return { match: true, pattern: 'secret-key' };
  }

  // PRIVATE + KEY = critical
  if (segments.includes('private') && segments.includes('key')) {
    return { match: true, pattern: 'private-key' };
  }

  // API + SECRET = critical
  if (segments.includes('api') && segments.includes('secret')) {
    return { match: true, pattern: 'api-secret' };
  }

  return { match: false, pattern: '' };
}

// ============================================================================
// MAIN DETECTION FUNCTION
// ============================================================================

/**
 * Detect environment variable severity using semantic analysis
 *
 * Algorithm:
 * 1. Split name into semantic segments
 * 2. Check for compound patterns (highest specificity)
 * 3. Check for database/auth secret words -> critical
 * 4. Check for third-party service prefix -> high (likely credentials)
 * 5. Check for credential words (key, token, password) -> high
 * 6. Check for URL words (depends on public flag) -> medium
 * 7. Check for config words -> medium
 * 8. Default -> low
 *
 * @param name Environment variable name (e.g., "DATABASE_URL", "NEXT_PUBLIC_API_URL")
 * @returns Severity level: 'critical' | 'high' | 'medium' | 'low'
 */
export function detectEnvVarSeverity(name: string): EnvVarSeverity {
  const analysis = analyzeEnvVar(name);
  return analysis.severity;
}

/**
 * Detailed analysis of environment variable
 *
 * @param name Environment variable name
 * @returns Full analysis with severity, reason, and categories
 */
export function analyzeEnvVar(name: string): EnvVarAnalysis {
  const segments = getSegments(name);
  const categories: string[] = [];

  // Empty or very short names
  if (segments.length === 0) {
    return {
      severity: 'low',
      reason: 'empty or invalid name',
      categories: [],
    };
  }

  // Check if explicitly public (reduces severity)
  const isPublicVar = isPublic(segments);
  if (isPublicVar) {
    categories.push('public');
  }

  // 1. Check compound patterns (highest specificity)
  const compound = hasCompoundPattern(segments);
  if (compound.match) {
    categories.push(compound.pattern);
    // Public database URLs are still critical
    if (compound.pattern === 'database-connection') {
      return {
        severity: 'critical',
        reason: `compound pattern: ${compound.pattern}`,
        categories,
      };
    }
    // Other compound patterns may be downgraded if public
    return {
      severity: isPublicVar ? 'high' : 'critical',
      reason: `compound pattern: ${compound.pattern}`,
      categories,
    };
  }

  // 2. Check database words -> critical
  if (hasMatch(segments, DATABASE_WORDS)) {
    categories.push('database');
    // Database connection strings are always sensitive
    return {
      severity: 'critical',
      reason: 'database-related variable',
      categories,
    };
  }

  // 3. Check auth/encryption secret words -> critical
  if (hasMatch(segments, AUTH_SECRET_WORDS)) {
    categories.push('auth-secret');
    return {
      severity: isPublicVar ? 'high' : 'critical',
      reason: 'authentication or encryption secret',
      categories,
    };
  }

  // 4. Check third-party service prefix -> high
  const service = startsWithService(segments);
  if (service) {
    categories.push(`service:${service}`);
    return {
      severity: isPublicVar ? 'medium' : 'high',
      reason: `third-party service credentials (${service})`,
      categories,
    };
  }

  // 5. Check credential words (key, token, password) -> high
  if (hasMatch(segments, CREDENTIAL_WORDS)) {
    categories.push('credential');
    // Public API keys are common and less sensitive
    if (isPublicVar && segments.includes('key')) {
      return {
        severity: 'medium',
        reason: 'public API key',
        categories,
      };
    }
    return {
      severity: isPublicVar ? 'medium' : 'high',
      reason: 'credential-related variable',
      categories,
    };
  }

  // 6. Check URL words
  if (hasMatch(segments, URL_WORDS)) {
    categories.push('url');
    // Internal URLs (no PUBLIC marker) might expose infrastructure
    return {
      severity: isPublicVar ? 'low' : 'medium',
      reason: isPublicVar ? 'public URL configuration' : 'internal URL or endpoint',
      categories,
    };
  }

  // 7. Check config words -> medium
  if (hasMatch(segments, CONFIG_WORDS)) {
    categories.push('config');
    return {
      severity: 'medium',
      reason: 'application configuration',
      categories,
    };
  }

  // 8. Default -> low
  return {
    severity: 'low',
    reason: 'general configuration',
    categories,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if an env var is considered sensitive (critical or high)
 */
export function isSensitiveEnvVar(name: string): boolean {
  const severity = detectEnvVarSeverity(name);
  return severity === 'critical' || severity === 'high';
}

/**
 * Get all env vars grouped by severity
 */
export function groupEnvVarsBySeverity(names: string[]): Record<EnvVarSeverity, string[]> {
  const result: Record<EnvVarSeverity, string[]> = {
    critical: [],
    high: [],
    medium: [],
    low: [],
  };

  for (const name of names) {
    const severity = detectEnvVarSeverity(name);
    result[severity].push(name);
  }

  return result;
}

/**
 * Sort env var names by severity (critical first)
 */
export function sortEnvVarsBySeverity(names: string[]): string[] {
  const order: Record<EnvVarSeverity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  return [...names].sort((a, b) => {
    const severityA = detectEnvVarSeverity(a);
    const severityB = detectEnvVarSeverity(b);
    return order[severityA] - order[severityB];
  });
}
