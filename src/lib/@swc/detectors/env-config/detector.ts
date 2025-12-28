/**
 * @module lib/@swc/detectors/env-config/detector
 * @description Main detection logic for environment configuration issues
 *
 * Provides:
 * - AST-based detection (detectEnvConfigIssue)
 * - Specialized detectors for each issue type
 * - Value-type specific detection functions
 */

import type { Node, Span } from '@swc/core';
import type { DetectorContext, EnvConfigDetection } from './types';
import {
  getParentVariableName,
  hasEnvIndicator,
  isApiEndpoint,
  isConfigurablePort,
  isConfigVariable,
  isDatabaseHostname,
  isFeatureFlagVariable,
  isSecretOrApiKey,
  isTimeoutVariable,
  shouldSkipFile,
  suggestEnvVarName,
} from './validators';

// ============================================================================
// MAIN DETECTOR
// ============================================================================

/**
 * Detect environment-specific configuration issue from AST node
 *
 * @param node - SWC AST node
 * @param filepath - Path to file being analyzed
 * @param context - Current node context
 * @returns Detection result or null if no issue found
 */
export function detectEnvConfigIssue(
  node: Node,
  filepath: string,
  context: DetectorContext,
): EnvConfigDetection | null {
  // Skip config files
  if (shouldSkipFile(filepath)) {
    return null;
  }

  const nodeType = (node as { type?: string }).type;
  const span = (node as { span?: Span }).span;

  if (!span) {
    return null;
  }

  // Check string literals
  if (nodeType === 'StringLiteral') {
    const value = (node as { value?: string }).value ?? '';
    return detectStringValue(value, span, context);
  }

  // Check numeric literals (for ports, timeouts)
  if (nodeType === 'NumericLiteral') {
    const value = (node as { value?: number }).value;
    if (value !== undefined) {
      return detectNumericValue(value, span, context);
    }
  }

  // Check boolean literals (for feature flags)
  if (nodeType === 'BooleanLiteral') {
    const value = (node as { value?: boolean }).value;
    if (value !== undefined) {
      return detectBooleanValue(value, span, context);
    }
  }

  return null;
}

// ============================================================================
// VALUE-TYPE DETECTORS
// ============================================================================

/**
 * Detect environment issues in string values
 *
 * @param value - String value to check
 * @param span - AST span for offset
 * @param context - Detector context
 * @returns Detection result or null
 */
function detectStringValue(
  value: string,
  span: Span,
  context: DetectorContext,
): EnvConfigDetection | null {
  // Skip empty strings and very short values
  if (value.length < 3) {
    return null;
  }

  // Skip if in const declaration with intentional naming
  if (context.inConstDeclaration) {
    const varName = getParentVariableName(context);
    if (varName && isConfigVariable(varName)) {
      return null;
    }
  }

  // 1. Check for secrets/API keys (CRITICAL)
  if (isSecretOrApiKey(value)) {
    return {
      type: 'secret',
      severity: 'critical',
      value,
      offset: span.start,
      suggestedEnvVar: suggestEnvVarName(value, 'secret'),
      message: `Potential secret or API key detected. Move to environment variable.`,
    };
  }

  // 2. Check for environment-specific URLs
  if (value.startsWith('http://') || value.startsWith('https://')) {
    // Skip localhost and example URLs for this detector
    if (
      value.includes('localhost') ||
      value.includes('127.0.0.1') ||
      value.includes('example.com') ||
      value.includes('example.org')
    ) {
      // But check if it's a database hostname
      const urlHostMatch = value.match(/https?:\/\/([^/:.]+)/);
      if (urlHostMatch?.[1] && isDatabaseHostname(urlHostMatch[1])) {
        return {
          type: 'database-hostname',
          severity: 'warning',
          value,
          offset: span.start,
          suggestedEnvVar: 'DATABASE_URL',
          message: `Database connection URL should come from environment variable.`,
        };
      }
      return null;
    }

    // Check for environment indicators in URL
    if (hasEnvIndicator(value)) {
      return {
        type: 'env-url',
        severity: 'warning',
        value,
        offset: span.start,
        suggestedEnvVar: suggestEnvVarName(value, 'env-url'),
        message: `URL contains environment indicator. Use environment variable instead.`,
      };
    }

    // Check for API endpoints
    if (isApiEndpoint(value)) {
      return {
        type: 'api-endpoint',
        severity: 'info',
        value,
        offset: span.start,
        suggestedEnvVar: suggestEnvVarName(value, 'api-endpoint'),
        message: `API endpoint URL should be configurable via environment variable.`,
      };
    }
  }

  // 3. Check for database hostnames in connection strings
  if (isDatabaseHostname(value)) {
    return {
      type: 'database-hostname',
      severity: 'warning',
      value,
      offset: span.start,
      suggestedEnvVar: 'DATABASE_HOST',
      message: `Database hostname should come from environment variable.`,
    };
  }

  return null;
}

/**
 * Detect environment issues in numeric values
 *
 * @param value - Numeric value to check
 * @param span - AST span for offset
 * @param context - Detector context
 * @returns Detection result or null
 */
function detectNumericValue(
  value: number,
  span: Span,
  context: DetectorContext,
): EnvConfigDetection | null {
  // Skip if in const declaration (intentional constant)
  if (context.inConstDeclaration) {
    return null;
  }

  // Check for configurable ports (semantic detection)
  if (isConfigurablePort(value)) {
    return {
      type: 'hardcoded-port',
      severity: 'info',
      value,
      offset: span.start,
      suggestedEnvVar: 'PORT',
      message: `Port ${value} should be configurable via environment variable.`,
    };
  }

  // Check for timeout-like values (1000-600000 ms range, multiples of 100/1000)
  if (value >= 1000 && value <= 600000 && (value % 100 === 0 || value % 1000 === 0)) {
    const varName = getParentVariableName(context);
    if (varName && isTimeoutVariable(varName)) {
      return {
        type: 'timeout-value',
        severity: 'info',
        value,
        offset: span.start,
        suggestedEnvVar: suggestEnvVarName(value, 'timeout-value'),
        message: `Timeout value ${value}ms should be configurable via environment variable.`,
      };
    }
  }

  return null;
}

/**
 * Detect environment issues in boolean values (feature flags)
 *
 * @param value - Boolean value to check
 * @param span - AST span for offset
 * @param context - Detector context
 * @returns Detection result or null
 */
function detectBooleanValue(
  value: boolean,
  span: Span,
  context: DetectorContext,
): EnvConfigDetection | null {
  // Only flag if parent variable name suggests a feature flag
  const varName = getParentVariableName(context);
  if (varName && isFeatureFlagVariable(varName)) {
    return {
      type: 'feature-flag',
      severity: 'info',
      value,
      offset: span.start,
      suggestedEnvVar: varName.toUpperCase().replace(/([a-z])([A-Z])/g, '$1_$2'),
      message: `Feature flag "${varName}" should be configurable via environment variable.`,
    };
  }

  return null;
}

// ============================================================================
// SPECIALIZED DETECTORS
// ============================================================================

/**
 * Detect environment-specific URL
 *
 * @param node - SWC AST node
 * @param filepath - File path
 * @param context - Detector context
 * @returns Detection or null
 */
export function detectEnvUrl(
  node: Node,
  filepath: string,
  context: DetectorContext,
): EnvConfigDetection | null {
  const result = detectEnvConfigIssue(node, filepath, context);
  return result?.type === 'env-url' ? result : null;
}

/**
 * Detect hardcoded port number
 *
 * @param node - SWC AST node
 * @param filepath - File path
 * @param context - Detector context
 * @returns Detection or null
 */
export function detectHardcodedPort(
  node: Node,
  filepath: string,
  context: DetectorContext,
): EnvConfigDetection | null {
  const result = detectEnvConfigIssue(node, filepath, context);
  return result?.type === 'hardcoded-port' ? result : null;
}

/**
 * Detect database hostname
 *
 * @param node - SWC AST node
 * @param filepath - File path
 * @param context - Detector context
 * @returns Detection or null
 */
export function detectDatabaseHostname(
  node: Node,
  filepath: string,
  context: DetectorContext,
): EnvConfigDetection | null {
  const result = detectEnvConfigIssue(node, filepath, context);
  return result?.type === 'database-hostname' ? result : null;
}

/**
 * Detect API endpoint URL
 *
 * @param node - SWC AST node
 * @param filepath - File path
 * @param context - Detector context
 * @returns Detection or null
 */
export function detectApiEndpoint(
  node: Node,
  filepath: string,
  context: DetectorContext,
): EnvConfigDetection | null {
  const result = detectEnvConfigIssue(node, filepath, context);
  return result?.type === 'api-endpoint' ? result : null;
}

/**
 * Detect hardcoded feature flag
 *
 * @param node - SWC AST node
 * @param filepath - File path
 * @param context - Detector context
 * @returns Detection or null
 */
export function detectFeatureFlag(
  node: Node,
  filepath: string,
  context: DetectorContext,
): EnvConfigDetection | null {
  const result = detectEnvConfigIssue(node, filepath, context);
  return result?.type === 'feature-flag' ? result : null;
}

/**
 * Detect timeout/interval value
 *
 * @param node - SWC AST node
 * @param filepath - File path
 * @param context - Detector context
 * @returns Detection or null
 */
export function detectTimeoutValue(
  node: Node,
  filepath: string,
  context: DetectorContext,
): EnvConfigDetection | null {
  const result = detectEnvConfigIssue(node, filepath, context);
  return result?.type === 'timeout-value' ? result : null;
}

/**
 * Detect potential API key or secret (CRITICAL)
 *
 * @param node - SWC AST node
 * @param filepath - File path
 * @param context - Detector context
 * @returns Detection or null
 */
export function detectSecretOrApiKey(
  node: Node,
  filepath: string,
  context: DetectorContext,
): EnvConfigDetection | null {
  const result = detectEnvConfigIssue(node, filepath, context);
  return result?.type === 'api-key' || result?.type === 'secret' ? result : null;
}

/**
 * Get all detections with critical severity
 *
 * @param node - SWC AST node
 * @param filepath - File path
 * @param context - Detector context
 * @returns Detection or null
 */
export function detectCriticalEnvIssue(
  node: Node,
  filepath: string,
  context: DetectorContext,
): EnvConfigDetection | null {
  const result = detectEnvConfigIssue(node, filepath, context);
  return result?.severity === 'critical' ? result : null;
}
