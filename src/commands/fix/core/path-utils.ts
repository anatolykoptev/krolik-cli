/**
 * @module commands/fix/core/path-utils
 * @description Path validation and security utilities
 *
 * @deprecated Import directly from '../../../lib/@sanitize/path' or '@/lib' instead
 *
 * Prevents path traversal attacks by validating user-provided paths
 * against project root.
 */

// Re-export from shared module for backward compatibility
export {
  validatePathWithinProject,
  validatePathOrThrow,
  normalizeToRelative,
  isPathSafe,
  type PathValidationResult,
} from '../../../lib/@sanitize/path';
