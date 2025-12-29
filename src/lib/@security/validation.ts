/**
 * @module lib/@security/validation
 * @description String and number validation utilities
 *
 * Provides validation functions that check user input against safe patterns.
 */

/**
 * Validation result
 */
export interface ValidationResult<T> {
  valid: boolean;
  value: T | null;
  error?: string;
}

/**
 * Validate and sanitize a feature/task name
 * Only allows alphanumeric, hyphens, underscores, dots, and spaces
 */
export function sanitizeFeatureName(input: unknown, maxLength = 100): string | null {
  if (typeof input !== 'string') return null;
  const sanitized = input.trim();
  if (sanitized.length === 0 || sanitized.length > maxLength) return null;
  if (!/^[a-zA-Z0-9_\-.\s]+$/.test(sanitized)) return null;
  return sanitized;
}

/**
 * Validate and sanitize a file path component (no path traversal)
 */
export function sanitizePathComponent(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const sanitized = input.trim();
  if (sanitized.length === 0 || sanitized.length > 255) return null;
  if (sanitized.includes('..') || sanitized.includes('/') || sanitized.includes('\\')) {
    return null;
  }
  if (!/^[a-zA-Z0-9_\-.]+$/.test(sanitized)) return null;
  return sanitized;
}

/**
 * Validate and sanitize an identifier
 */
export function sanitizeIdentifier(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const sanitized = input.trim();
  if (sanitized.length === 0 || sanitized.length > 100) return null;
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(sanitized)) return null;
  return sanitized;
}

/**
 * Validate and sanitize an issue/PR number
 */
export function sanitizeIssueNumber(input: unknown): number | null {
  if (typeof input === 'number') {
    if (Number.isInteger(input) && input > 0 && input < 1000000) return input;
    return null;
  }
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!/^\d+$/.test(trimmed)) return null;
    const num = parseInt(trimmed, 10);
    if (Number.isNaN(num) || num <= 0 || num >= 1000000) return null;
    return num;
  }
  return null;
}

/**
 * Validate and sanitize a port number
 */
export function sanitizePort(input: unknown): number | null {
  const num = sanitizeIssueNumber(input);
  if (num === null) return null;
  if (num < 1 || num > 65535) return null;
  return num;
}

/**
 * Validate and sanitize a positive integer with custom range
 */
export function sanitizePositiveInt(
  input: unknown,
  min = 1,
  max = Number.MAX_SAFE_INTEGER,
): number | null {
  if (typeof input === 'number') {
    if (Number.isInteger(input) && input >= min && input <= max) return input;
    return null;
  }
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!/^-?\d+$/.test(trimmed)) return null;
    const num = parseInt(trimmed, 10);
    if (Number.isNaN(num) || num < min || num > max) return null;
    return num;
  }
  return null;
}

/**
 * Validate a URL string
 */
export function isValidUrl(input: string): boolean {
  try {
    const url = new URL(input);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Sanitize and validate a URL
 */
export function sanitizeUrl(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!isValidUrl(trimmed)) return null;
  return trimmed;
}

/**
 * Basic email validation
 */
export function isValidEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
}

/**
 * Sanitize and validate an email
 */
export function sanitizeEmail(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim().toLowerCase();
  if (!isValidEmail(trimmed)) return null;
  return trimmed;
}

/**
 * Parse a boolean-like value
 */
export function parseBoolean(input: unknown): boolean | null {
  if (typeof input === 'boolean') return input;
  if (typeof input === 'string') {
    const lower = input.toLowerCase().trim();
    if (['true', 'yes', '1', 'on'].includes(lower)) return true;
    if (['false', 'no', '0', 'off'].includes(lower)) return false;
  }
  if (typeof input === 'number') {
    if (input === 1) return true;
    if (input === 0) return false;
  }
  return null;
}
