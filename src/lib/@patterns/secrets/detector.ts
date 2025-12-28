/**
 * @module lib/@swc/detectors/secrets/detector
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
import type { SecretDetection, SecretDetectorContext, SecretType } from './types';
import {
  extractVariableName,
  isEnvReference,
  isPlaceholder,
  isTestFile,
  redactSecret,
} from './validators';

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
  const nodeType = (node as { type?: string }).type;
  const span = (node as { span?: Span }).span;

  if (!span) {
    return null;
  }

  // Only process StringLiteral and TemplateLiteral nodes
  if (nodeType !== 'StringLiteral' && nodeType !== 'TemplateLiteral') {
    return null;
  }

  // Extract string value
  let value: string;
  if (nodeType === 'StringLiteral') {
    value = (node as { value?: string }).value ?? '';
  } else {
    // For template literals, concatenate quasis
    const quasis = (node as { quasis?: Array<{ raw?: string }> }).quasis ?? [];
    value = quasis.map((q) => q.raw ?? '').join('');
  }

  // Skip empty or very short strings
  if (!value || value.length < 8) {
    return null;
  }

  // Skip environment variable references
  if (isEnvReference(value)) {
    return null;
  }

  // Skip obvious placeholders
  if (isPlaceholder(value)) {
    return null;
  }

  // Build context
  const extractedVarName = context?.variableName ?? extractVariableName(content, span.start);
  const detectorContext: SecretDetectorContext = {
    ...context,
    isTestFile: context?.isTestFile ?? isTestFile(filepath),
    checkEntropy: context?.checkEntropy ?? true,
  };
  if (extractedVarName !== undefined) {
    detectorContext.variableName = extractedVarName;
  }

  // Check all patterns
  for (const pattern of ALL_PATTERNS) {
    const match = value.match(pattern.pattern);
    if (!match) continue;

    // Run custom validation if present
    if (pattern.validate && !pattern.validate(value, detectorContext)) {
      continue;
    }

    // Reduce confidence for test files (except critical severity)
    let confidence = pattern.baseConfidence;
    if (detectorContext.isTestFile && pattern.severity !== 'critical') {
      confidence = Math.max(confidence - 30, 10);
    }

    // Skip low-confidence detections for generic patterns
    if (confidence < 50 && pattern.type === 'high-entropy-string') {
      continue;
    }

    return {
      type: pattern.type,
      offset: span.start,
      severity: pattern.severity,
      confidence,
      preview: redactSecret(match[0]),
      context: pattern.description,
    };
  }

  return null;
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
  const results: SecretDetection[] = [];

  // Skip empty or very short strings
  if (!value || value.length < 8) {
    return results;
  }

  // Skip environment variable references
  if (isEnvReference(value)) {
    return results;
  }

  // Skip obvious placeholders
  if (isPlaceholder(value)) {
    return results;
  }

  // Check all patterns
  for (const pattern of ALL_PATTERNS) {
    const match = value.match(pattern.pattern);
    if (!match) continue;

    // Run custom validation if present
    if (pattern.validate && !pattern.validate(value, context)) {
      continue;
    }

    // Reduce confidence for test files (except critical severity)
    let confidence = pattern.baseConfidence;
    if (context?.isTestFile && pattern.severity !== 'critical') {
      confidence = Math.max(confidence - 30, 10);
    }

    // Skip low-confidence detections for generic patterns
    if (confidence < 50 && pattern.type === 'high-entropy-string') {
      continue;
    }

    results.push({
      type: pattern.type,
      offset: 0, // Offset within the string
      severity: pattern.severity,
      confidence,
      preview: redactSecret(match[0]),
      context: pattern.description,
    });
  }

  return results;
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
