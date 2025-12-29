/**
 * @module lib/@security
 * @description Input sanitization and validation utilities (barrel export)
 *
 * Security-focused utilities for validating and sanitizing user input
 * to prevent injection attacks and ensure safe command execution.
 */

// Shell escaping
export { escapeDoubleQuotes, escapeShellArg, isValidCommandName } from './escape';

// Path validation utilities
export {
  isPathSafe,
  normalizeToRelative,
  type PathValidationResult,
  validatePathOrThrow,
  validatePathWithinProject,
} from './path';
// Regex escaping utilities
export { escapeRegex, escapeReplacement, literalReplacer } from './regex';

// String and number validation
export {
  isValidEmail,
  isValidUrl,
  parseBoolean,
  sanitizeEmail,
  sanitizeFeatureName,
  sanitizeIdentifier,
  sanitizeIssueNumber,
  sanitizePathComponent,
  sanitizePort,
  sanitizePositiveInt,
  sanitizeUrl,
  type ValidationResult,
} from './validation';
