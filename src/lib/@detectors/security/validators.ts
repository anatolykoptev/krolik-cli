/**
 * @module lib/@detectors/security/validators
 * @description Validation utilities for secret detection
 *
 * Provides:
 * - Shannon entropy calculation
 * - Placeholder detection
 * - Test file detection (re-exported from file-context/detectors)
 * - Environment variable reference detection
 * - Secret redaction
 */

// Re-export isTestFile from canonical location
export { isTestFile } from '../patterns/file-context/detectors';

/**
 * Calculate Shannon entropy of a string
 *
 * Higher entropy indicates more randomness, typical of secrets.
 * - Normal English text: ~4.0
 * - Random base64: ~5.5-6.0
 * - Random hex: ~4.0
 *
 * @param str - String to analyze
 * @returns Shannon entropy value
 */
export function calculateEntropy(str: string): number {
  if (!str || str.length === 0) return 0;

  const freq = new Map<string, number>();
  for (const char of str) {
    freq.set(char, (freq.get(char) ?? 0) + 1);
  }

  let entropy = 0;
  const len = str.length;

  const counts = Array.from(freq.values());
  for (const count of counts) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }

  return entropy;
}

/** Common placeholder patterns */
const PLACEHOLDER_PATTERNS = [
  'example',
  'sample',
  'placeholder',
  'your_',
  'my_',
  'test',
  'demo',
  'fake',
  'mock',
  'dummy',
  'xxx',
  '000',
  '123',
  'changeme',
  'replace',
  'insert',
  'todo',
  'fixme',
  '<your',
  '${',
  '{{',
  '__',
] as const;

/**
 * Check if string looks like a placeholder/example value
 *
 * @param value - String to check
 * @returns True if it's likely a placeholder
 */
export function isPlaceholder(value: string): boolean {
  const lower = value.toLowerCase();
  return PLACEHOLDER_PATTERNS.some((p) => lower.includes(p));
}

// Note: isTestFile is re-exported from '../file-context/detectors' at the top of this file

/** Environment variable reference patterns */
const ENV_REFERENCE_PATTERNS = ['process.env.', '${', '$ENV', 'import.meta.env'] as const;

/**
 * Check if value is an environment variable reference
 *
 * @param value - String to check
 * @returns True if it references an env var
 */
export function isEnvReference(value: string): boolean {
  return ENV_REFERENCE_PATTERNS.some((p) => value.startsWith(p) || value.includes(p));
}

/**
 * Create redacted preview of a secret
 *
 * @param value - Secret value
 * @param showChars - Number of chars to show at start/end
 * @returns Redacted string
 */
export function redactSecret(value: string, showChars = 4): string {
  if (value.length <= showChars * 2 + 3) {
    return '*'.repeat(value.length);
  }

  const start = value.slice(0, showChars);
  const end = value.slice(-showChars);
  const middle = '*'.repeat(Math.min(value.length - showChars * 2, 10));

  return `${start}${middle}${end}`;
}

/**
 * Extract variable name from surrounding context
 *
 * @param content - Source content
 * @param offset - Offset of the string literal
 * @returns Variable name if found
 */
export function extractVariableName(content: string, offset: number): string | undefined {
  // Look backwards from offset for assignment pattern
  const lookback = content.slice(Math.max(0, offset - 100), offset);

  // Match: variableName = or variableName: or "variableName":
  const assignmentMatch = lookback.match(/(?:const|let|var)?\s*(\w+)\s*[=:]\s*$/);
  if (assignmentMatch) {
    return assignmentMatch[1];
  }

  // Match object property: propertyName: or "propertyName":
  const propertyMatch = lookback.match(/["']?(\w+)["']?\s*:\s*$/);
  if (propertyMatch) {
    return propertyMatch[1];
  }

  return undefined;
}

/**
 * Get severity weight for prioritization
 *
 * @param severity - Severity level
 * @returns Numeric weight (higher = more severe)
 */
export function getSeverityWeight(severity: 'critical' | 'high' | 'medium' | 'low'): number {
  const weights: Record<string, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };
  return weights[severity] ?? 0;
}
