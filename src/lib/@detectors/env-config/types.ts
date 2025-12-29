/**
 * @module lib/@detectors/env-config/types
 * @description Type definitions for environment configuration detection
 */

// Re-export from ast/types for convenience
export type {
  DetectorContext,
  EnvConfigDetection,
  EnvConfigIssueType,
  EnvConfigSeverity,
} from '../ast/types';

// Import for local use in interfaces
import type { EnvConfigIssueType, EnvConfigSeverity } from '../ast/types';

/**
 * Pattern definition for environment configuration detection
 */
export interface EnvConfigPattern {
  /** Issue type identifier */
  type: EnvConfigIssueType;
  /** Regex pattern to match */
  pattern: RegExp;
  /** Severity level */
  severity: EnvConfigSeverity;
  /** Description for context */
  description: string;
  /** Suggested environment variable name */
  suggestedEnvVar: string;
}

/**
 * URL pattern for environment-specific detection
 */
export interface UrlPattern {
  /** Regex pattern to match */
  pattern: RegExp;
  /** Description of what this pattern detects */
  description: string;
}

/**
 * Variable name pattern for context-aware detection
 */
export interface VariablePattern {
  /** Regex pattern to match variable names */
  pattern: RegExp;
  /** Description of what this pattern indicates */
  description: string;
}
