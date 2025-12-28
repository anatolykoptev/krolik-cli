/**
 * @module lib/@patterns/env-config/validators
 * @description Validation utilities for environment configuration detection
 *
 * Provides:
 * - Pattern matching helpers for URLs, hostnames, ports
 * - Variable name validation
 * - Environment variable suggestion generation
 */

import { shouldSkipForEnvConfig } from '../skip-patterns';
import {
  API_ENDPOINT_PATTERNS,
  CONFIG_VAR_PATTERNS,
  isConfigurablePort as checkConfigurablePort,
  DATABASE_HOSTNAME_PATTERNS,
  ENV_URL_PATTERNS,
  FEATURE_FLAG_PATTERNS,
  SECRET_PATTERNS,
  TIMEOUT_VAR_PATTERNS,
} from './patterns';
import type { DetectorContext, EnvConfigIssueType } from './types';

// ============================================================================
// FILE VALIDATION
// ============================================================================

/**
 * Check if file should be skipped for env config detection
 * (Uses centralized patterns from @patterns/skip-patterns)
 *
 * @param filepath - Path to file
 * @returns True if file should be skipped
 */
export function shouldSkipFile(filepath: string): boolean {
  return shouldSkipForEnvConfig(filepath);
}

// ============================================================================
// URL VALIDATION
// ============================================================================

/**
 * Check if URL contains environment indicators
 *
 * @param url - URL to check
 * @returns True if URL contains environment indicators
 */
export function hasEnvIndicator(url: string): boolean {
  return ENV_URL_PATTERNS.some((pattern) => pattern.test(url));
}

/**
 * Check if URL is an API endpoint
 *
 * @param url - URL to check
 * @returns True if URL matches API endpoint patterns
 */
export function isApiEndpoint(url: string): boolean {
  return API_ENDPOINT_PATTERNS.some((pattern) => pattern.test(url));
}

// ============================================================================
// DATABASE VALIDATION
// ============================================================================

/**
 * Check if string matches database hostname pattern
 *
 * @param value - Value to check
 * @returns True if value matches database hostname pattern
 */
export function isDatabaseHostname(value: string): boolean {
  return DATABASE_HOSTNAME_PATTERNS.some((pattern) => pattern.test(value));
}

// ============================================================================
// PORT VALIDATION
// ============================================================================

/**
 * Check if port number is configurable
 *
 * Uses semantic analysis from patterns.ts:
 * - Service ports (database, cache, messaging)
 * - Dev server port ranges (3000-5999)
 * - HTTP alternative port ranges (8000-9999)
 *
 * @param port - Port number to check
 * @returns True if port should be configurable via environment
 */
export function isConfigurablePort(port: number): boolean {
  return checkConfigurablePort(port);
}

// ============================================================================
// SECRET VALIDATION
// ============================================================================

/**
 * Check if string matches secret/API key patterns
 *
 * @param value - Value to check
 * @returns True if value looks like a secret or API key
 */
export function isSecretOrApiKey(value: string): boolean {
  return SECRET_PATTERNS.some((pattern) => pattern.test(value));
}

// ============================================================================
// VARIABLE NAME VALIDATION
// ============================================================================

/**
 * Check if variable name indicates intentional configuration
 *
 * @param variableName - Variable name to check
 * @returns True if name indicates intentional configuration
 */
export function isConfigVariable(variableName: string): boolean {
  return CONFIG_VAR_PATTERNS.some((pattern) => pattern.test(variableName));
}

/**
 * Check if variable name suggests a feature flag
 *
 * @param variableName - Variable name to check
 * @returns True if name suggests a feature flag
 */
export function isFeatureFlagVariable(variableName: string): boolean {
  return FEATURE_FLAG_PATTERNS.some((pattern) => pattern.test(variableName));
}

/**
 * Check if variable name suggests a timeout/interval
 *
 * @param variableName - Variable name to check
 * @returns True if name suggests a timeout or interval
 */
export function isTimeoutVariable(variableName: string): boolean {
  return TIMEOUT_VAR_PATTERNS.some((pattern) => pattern.test(variableName));
}

// ============================================================================
// CONTEXT HELPERS
// ============================================================================

/**
 * Extract parent variable name from context
 *
 * @param context - Detector context
 * @returns Variable name if available
 */
export function getParentVariableName(context: DetectorContext): string | undefined {
  return context.parentVariableName;
}

// ============================================================================
// SUGGESTION GENERATION
// ============================================================================

/**
 * Generate suggested environment variable name
 *
 * @param value - Detected value
 * @param type - Issue type
 * @returns Suggested environment variable name
 */
export function suggestEnvVarName(
  value: string | number | boolean,
  type: EnvConfigIssueType,
): string {
  switch (type) {
    case 'env-url':
    case 'api-endpoint':
      // Extract domain hint from URL
      if (typeof value === 'string') {
        const match = value.match(/https?:\/\/([^/:.]+)/);
        if (match?.[1]) {
          return `${match[1].toUpperCase()}_URL`;
        }
      }
      return 'API_URL';

    case 'hardcoded-port':
      return 'PORT';

    case 'database-hostname':
      return 'DATABASE_HOST';

    case 'feature-flag':
      return 'FEATURE_FLAG_NAME';

    case 'timeout-value':
      return 'TIMEOUT_MS';

    case 'api-key':
    case 'secret':
      return 'API_KEY';

    default:
      return 'ENV_VAR';
  }
}
