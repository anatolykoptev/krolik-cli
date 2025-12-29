/**
 * @module lib/@discovery/architecture/types
 * @description Type definitions for architecture pattern detection
 */

// ============================================================================
// PATTERN DETECTION TYPES
// ============================================================================

/**
 * Detected architectural pattern with examples
 *
 * @example
 * ```typescript
 * const pattern: DetectedPattern = {
 *   name: 'tRPC Routers',
 *   description: 'tRPC API routers',
 *   pattern: 'packages/api/src/routers/{name}.ts',
 *   examples: ['user', 'booking', 'auth'],
 *   count: 15,
 * };
 * ```
 */
export interface DetectedPattern {
  /** Human-readable pattern name */
  name: string;
  /** Brief description of the pattern */
  description: string;
  /** Pattern template showing file/directory structure */
  pattern: string;
  /** Example instances found (max 5) */
  examples: string[];
  /** Total count of instances found */
  count: number;
}

/**
 * Project type classification
 */
export type ProjectType = 'monorepo' | 'single-app';

/**
 * Complete architecture analysis result
 */
export interface ArchitecturePatterns {
  /** Project structure type */
  projectType: ProjectType;
  /** All detected patterns */
  patterns: DetectedPattern[];
}

// ============================================================================
// PATTERN DETECTOR TYPES
// ============================================================================

/**
 * Configuration for a pattern detector
 *
 * Detectors are declarative configurations that describe what patterns
 * to look for in the codebase.
 */
export interface PatternDetector {
  /** Unique identifier for the detector */
  id: string;
  /** Display name for the pattern */
  name: string;
  /** Brief description */
  description: string;
  /** Regex patterns for directory names to match */
  directoryPatterns: RegExp[];
  /** Optional regex patterns for files inside matched directories */
  filePatterns?: RegExp[];
  /** Optional content markers to verify pattern (checked in first 5KB of file) */
  contentMarkers?: string[];
  /** Whether to detect sub-modules (directories with index.ts) */
  detectSubModules?: boolean;
  /** Template for the pattern output (supports {path} placeholder) */
  patternTemplate: string;
}

// ============================================================================
// SCANNER TYPES
// ============================================================================

/**
 * Options for the architecture scanner
 */
export interface ArchitectureScanOptions {
  /** Maximum directory depth to scan (default: 3) */
  maxDepth?: number;
  /** Directories to skip during scanning */
  skipDirs?: string[];
  /** Custom detectors to use (if not provided, uses defaults) */
  detectors?: PatternDetector[];
}

/**
 * Result of scanning a single directory
 */
export interface ScanResult {
  /** Directory path relative to project root */
  path: string;
  /** Detected pattern (if any) */
  pattern: DetectedPattern | null;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default directories to skip during architecture scanning */
export const ARCHITECTURE_SKIP_DIRS = [
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  '.turbo',
  'coverage',
  '.cache',
  '__tests__',
  '__mocks__',
] as const;

/** Maximum file size to read for content marker checking (5KB) */
export const MAX_CONTENT_CHECK_SIZE = 5000;

/** Maximum number of examples to collect per pattern */
export const MAX_EXAMPLES = 5;

/** Default maximum scan depth */
export const DEFAULT_MAX_DEPTH = 3;
