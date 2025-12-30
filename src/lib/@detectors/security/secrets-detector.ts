/**
 * @module lib/@detectors/security/secrets-detector
 * @description Main secret detection logic
 *
 * Provides:
 * - AST-based secret detection (detectSecret)
 * - Bulk detection (detectAllSecrets)
 * - Specialized detectors (AWS, Private Keys, Database, API Token)
 * - Content scanning without AST (scanContentForSecrets)
 */

import type { Node, Span } from '@swc/core';
import { ALL_PATTERNS } from './patterns';
import type { SecretDetection, SecretDetectorContext, SecretPattern, SecretType } from './types';
import {
  extractVariableName,
  isEnvReference,
  isPlaceholder,
  isTestFile,
  redactSecret,
} from './validators';

// ============================================================================
// HELPER FUNCTIONS (extracted to reduce complexity)
// ============================================================================

/**
 * Extract string value from AST node
 * @returns String value or null if node is not a string literal
 */
function extractStringValue(node: Node): string | null {
  const nodeType = (node as { type?: string }).type;

  if (nodeType === 'StringLiteral') {
    return (node as { value?: string }).value ?? '';
  }

  if (nodeType === 'TemplateLiteral') {
    const quasis = (node as { quasis?: Array<{ raw?: string }> }).quasis ?? [];
    return quasis.map((q) => q.raw ?? '').join('');
  }

  return null;
}

/**
 * Check if a string value should be skipped from secret detection
 */
function shouldSkipValue(value: string): boolean {
  if (!value || value.length < 8) return true;
  if (isEnvReference(value)) return true;
  if (isPlaceholder(value)) return true;
  return false;
}

/**
 * Build detection context from inputs
 */
function buildDetectorContext(
  content: string,
  filepath: string,
  offset: number,
  context?: SecretDetectorContext,
): SecretDetectorContext {
  const extractedVarName = context?.variableName ?? extractVariableName(content, offset);
  const detectorContext: SecretDetectorContext = {
    ...context,
    isTestFile: context?.isTestFile ?? isTestFile(filepath),
    checkEntropy: context?.checkEntropy ?? true,
  };

  if (extractedVarName !== undefined) {
    detectorContext.variableName = extractedVarName;
  }

  return detectorContext;
}

/**
 * Calculate adjusted confidence based on context
 */
function calculateAdjustedConfidence(
  pattern: SecretPattern,
  context: SecretDetectorContext,
): number {
  let confidence = pattern.baseConfidence;

  // Reduce confidence for test files (except critical severity)
  if (context.isTestFile && pattern.severity !== 'critical') {
    confidence = Math.max(confidence - 30, 10);
  }

  return confidence;
}

/**
 * Match a value against a single pattern
 * @returns Detection result or null if no match
 */
function matchPattern(
  value: string,
  pattern: SecretPattern,
  offset: number,
  context: SecretDetectorContext,
): SecretDetection | null {
  const match = value.match(pattern.pattern);
  if (!match) return null;

  // Run custom validation if present
  if (pattern.validate && !pattern.validate(value, context)) {
    return null;
  }

  const confidence = calculateAdjustedConfidence(pattern, context);

  // Skip low-confidence detections for generic patterns
  if (confidence < 50 && pattern.type === 'high-entropy-string') {
    return null;
  }

  return {
    type: pattern.type,
    offset,
    severity: pattern.severity,
    confidence,
    preview: redactSecret(match[0]),
    context: pattern.description,
  };
}

/**
 * Find first matching pattern in a value
 */
function findFirstPatternMatch(
  value: string,
  offset: number,
  context: SecretDetectorContext,
): SecretDetection | null {
  for (const pattern of ALL_PATTERNS) {
    const result = matchPattern(value, pattern, offset, context);
    if (result) return result;
  }
  return null;
}

// ============================================================================
// MAIN API
// ============================================================================

/**
 * Detect secrets in a string value from AST node
 *
 * @param node - SWC AST node
 * @param content - Full file content
 * @param filepath - Path to file being analyzed
 * @param context - Additional context for detection
 * @returns Detection result or null if no secret found
 */
export function detectSecret(
  node: Node,
  content: string,
  filepath: string,
  context?: SecretDetectorContext,
): SecretDetection | null {
  const span = (node as { span?: Span }).span;
  if (!span) return null;

  const value = extractStringValue(node);
  if (value === null) return null;

  if (shouldSkipValue(value)) return null;

  const detectorContext = buildDetectorContext(content, filepath, span.start, context);

  return findFirstPatternMatch(value, span.start, detectorContext);
}

/**
 * Find all matching patterns in a value
 */
function findAllPatternMatches(
  value: string,
  offset: number,
  context: SecretDetectorContext,
): SecretDetection[] {
  const results: SecretDetection[] = [];

  for (const pattern of ALL_PATTERNS) {
    const result = matchPattern(value, pattern, offset, context);
    if (result) {
      results.push(result);
    }
  }

  return results;
}

/**
 * Detect all secrets in a string value
 *
 * Unlike detectSecret which returns the first match,
 * this returns all detected secrets in the value.
 *
 * @param value - String value to scan
 * @param context - Detection context
 * @returns Array of all detected secrets
 */
export function detectAllSecrets(
  value: string,
  context?: SecretDetectorContext,
): SecretDetection[] {
  if (shouldSkipValue(value)) {
    return [];
  }

  // Use default context values if not provided
  const detectorContext: SecretDetectorContext = {
    ...context,
    isTestFile: context?.isTestFile ?? false,
    checkEntropy: context?.checkEntropy ?? true,
  };

  return findAllPatternMatches(value, 0, detectorContext);
}

// ============================================================================
// SPECIALIZED DETECTORS
// ============================================================================

/**
 * Detect AWS credentials specifically
 */
export function detectAwsCredentials(
  node: Node,
  content: string,
  filepath: string,
): SecretDetection | null {
  const result = detectSecret(node, content, filepath);
  if (!result) return null;

  return result.type === 'aws-access-key' || result.type === 'aws-secret-key' ? result : null;
}

/**
 * Detect private keys specifically
 */
export function detectPrivateKey(
  node: Node,
  content: string,
  filepath: string,
): SecretDetection | null {
  const result = detectSecret(node, content, filepath);
  if (!result) return null;

  const privateKeyTypes: SecretType[] = [
    'rsa-private-key',
    'ssh-private-key',
    'pgp-private-key',
    'ec-private-key',
    'openssh-private-key',
    'pkcs8-private-key',
  ];

  return privateKeyTypes.includes(result.type) ? result : null;
}

/**
 * Detect database connection strings specifically
 */
export function detectDatabaseCredentials(
  node: Node,
  content: string,
  filepath: string,
): SecretDetection | null {
  const result = detectSecret(node, content, filepath);
  if (!result) return null;

  const dbTypes: SecretType[] = [
    'postgres-connection',
    'mysql-connection',
    'mongodb-connection',
    'redis-connection',
    'database-password',
  ];

  return dbTypes.includes(result.type) ? result : null;
}

/**
 * Detect API tokens specifically
 */
export function detectApiToken(
  node: Node,
  content: string,
  filepath: string,
): SecretDetection | null {
  const result = detectSecret(node, content, filepath);
  if (!result) return null;

  // Return if it's any kind of API key or token
  return result.type.includes('key') || result.type.includes('token') ? result : null;
}

// ============================================================================
// BULK SCANNING
// ============================================================================

/**
 * Scan content for secrets without AST (for quick scanning)
 *
 * This is a faster method that doesn't require parsing.
 * Use for pre-commit hooks or quick scans.
 *
 * @param content - File content to scan
 * @param filepath - File path for context
 * @returns Array of detected secrets with line numbers
 */
export function scanContentForSecrets(
  content: string,
  filepath: string,
): Array<SecretDetection & { line: number }> {
  const results: Array<SecretDetection & { line: number }> = [];
  const lines = content.split('\n');
  const isTest = isTestFile(filepath);

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum] ?? '';

    // Skip comments
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
      continue;
    }

    const detections = detectAllSecrets(line, { isTestFile: isTest });
    for (const detection of detections) {
      results.push({
        ...detection,
        line: lineNum + 1,
      });
    }
  }

  return results;
}
