/**
 * @module lib/@detectors/secrets/types
 * @description Type definitions for secret detection
 */

import type { SecretDetectorContext, SecretSeverity, SecretType } from '../ast/types';

// Re-export for convenience
export type {
  SecretDetection,
  SecretDetectorContext,
  SecretSeverity,
  SecretType,
} from '../ast/types';

/**
 * Pattern definition for secret detection
 */
export interface SecretPattern {
  /** Secret type identifier */
  type: SecretType;
  /** Regex pattern to match */
  pattern: RegExp;
  /** Severity level */
  severity: SecretSeverity;
  /** Minimum confidence if pattern matches (0-100) */
  baseConfidence: number;
  /** Description for context */
  description: string;
  /** Additional validation function */
  validate?: (value: string, context?: SecretDetectorContext) => boolean;
}

/**
 * Secret detection result with line number
 */
export interface SecretDetectionWithLine {
  type: SecretType;
  offset: number;
  severity: SecretSeverity;
  confidence: number;
  preview: string;
  context: string;
  line: number;
}
