/**
 * @module lib/@sanitize
 * @description Input sanitization and validation utilities (barrel export)
 *
 * Security-focused utilities for validating and sanitizing user input
 * to prevent injection attacks and ensure safe command execution.
 */

// Regex escaping utilities
export { escapeRegex, escapeReplacement, literalReplacer } from './regex';

// Path validation utilities
export {
  normalizeToRelative,
  validatePathWithinProject,
  validatePathOrThrow,
  isPathSafe,
  type PathValidationResult,
} from './path';

// Shell escaping
export { escapeShellArg, escapeDoubleQuotes, isValidCommandName } from './escape';

// String and number validation
export {
  sanitizeFeatureName,
  sanitizePathComponent,
  sanitizeIdentifier,
  sanitizeIssueNumber,
  sanitizePort,
  sanitizePositiveInt,
  isValidUrl,
  sanitizeUrl,
  isValidEmail,
  sanitizeEmail,
  parseBoolean,
  type ValidationResult,
} from './validation';
