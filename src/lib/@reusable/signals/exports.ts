/**
 * @module lib/@reusable/signals/exports
 * @description Export pattern analysis for reusable code detection
 *
 * Analyzes file exports to determine reusability patterns.
 * Files with many named exports are typically more reusable.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ExportedMember } from '../../@ast-analysis';
import { analyzeSourceFile } from '../../@ast-analysis';
import type { ExportSignals } from '../types';

// ============================================================================
// SCORING CONSTANTS
// ============================================================================

const SCORES = {
  /** Score for having 3+ named exports */
  MULTIPLE_NAMED_EXPORTS: 20,
  /** Score for having a barrel file (index.ts) */
  HAS_BARREL_FILE: 15,
  /** Score for exporting types/interfaces */
  EXPORTS_TYPES: 10,
  /** Score for exporting utility functions */
  EXPORTS_FUNCTIONS: 5,
  /** Penalty for only having default export */
  DEFAULT_ONLY_PENALTY: -10,
  /** Score per additional export (diminishing) */
  PER_EXPORT_BONUS: 2,
  /** Max bonus from export count */
  MAX_EXPORT_BONUS: 20,
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Check if a directory has an index file (barrel)
 */
function hasBarrelFile(dirPath: string): boolean {
  const barrelNames = ['index.ts', 'index.tsx', 'index.js', 'index.jsx'];

  for (const name of barrelNames) {
    if (fs.existsSync(path.join(dirPath, name))) {
      return true;
    }
  }

  return false;
}

/**
 * Check if file is itself a barrel file
 */
function isBarrelFile(filePath: string): boolean {
  const fileName = path.basename(filePath);
  return /^index\.(ts|tsx|js|jsx)$/.test(fileName);
}

/**
 * Count exports by type
 */
function countExportsByType(exports: ExportedMember[]): {
  functions: number;
  types: number;
  classes: number;
  constants: number;
  enums: number;
} {
  return exports.reduce(
    (acc, exp) => {
      switch (exp.kind) {
        case 'function':
          acc.functions++;
          break;
        case 'type':
        case 'interface':
          acc.types++;
          break;
        case 'class':
          acc.classes++;
          break;
        case 'const':
          acc.constants++;
          break;
        case 'enum':
          acc.enums++;
          break;
      }
      return acc;
    },
    { functions: 0, types: 0, classes: 0, constants: 0, enums: 0 },
  );
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Analyze export patterns for a file
 *
 * @param filePath - Absolute path to the file
 * @param content - Optional file content (reads from disk if not provided)
 * @returns Export signals with score
 *
 * @example
 * ```ts
 * const signals = analyzeExportSignals('/path/to/utils.ts');
 * // { namedExportCount: 5, hasBarrelFile: false, score: 25, ... }
 * ```
 */
export function analyzeExportSignals(filePath: string, content?: string): ExportSignals {
  // Analyze the file
  const result = analyzeSourceFile(filePath, content);

  if (!result.success) {
    return {
      namedExportCount: 0,
      defaultExportOnly: false,
      hasBarrelFile: false,
      exportedFunctions: 0,
      exportedTypes: 0,
      exportedClasses: 0,
      exportedConstants: 0,
      exportedEnums: 0,
      score: 0,
    };
  }

  const exports = result.exports;
  const counts = countExportsByType(exports);

  // Calculate named vs default
  const namedExports = exports.filter((e) => !e.isDefault);
  const defaultExports = exports.filter((e) => e.isDefault);
  const namedExportCount = namedExports.length;
  const defaultExportOnly = defaultExports.length > 0 && namedExportCount === 0;

  // Check for barrel file
  const dirPath = path.dirname(filePath);
  const isBarrel = isBarrelFile(filePath);
  const hasBarrel = isBarrel || hasBarrelFile(dirPath);

  // Calculate score
  let score = 0;

  // Multiple named exports indicate reusability
  if (namedExportCount >= 3) {
    score += SCORES.MULTIPLE_NAMED_EXPORTS;
  }

  // Barrel file indicates organized module
  if (hasBarrel) {
    score += SCORES.HAS_BARREL_FILE;
  }

  // Exporting types suggests shared contracts
  if (counts.types > 0) {
    score += SCORES.EXPORTS_TYPES;
  }

  // Exporting functions suggests utilities
  if (counts.functions > 0) {
    score += SCORES.EXPORTS_FUNCTIONS;
  }

  // Default-only exports are less reusable (typically components/pages)
  if (defaultExportOnly) {
    score += SCORES.DEFAULT_ONLY_PENALTY;
  }

  // Bonus for many exports (diminishing returns)
  const exportBonus = Math.min(namedExportCount * SCORES.PER_EXPORT_BONUS, SCORES.MAX_EXPORT_BONUS);
  score += exportBonus;

  return {
    namedExportCount,
    defaultExportOnly,
    hasBarrelFile: hasBarrel,
    exportedFunctions: counts.functions,
    exportedTypes: counts.types,
    exportedClasses: counts.classes,
    exportedConstants: counts.constants,
    exportedEnums: counts.enums,
    score: Math.max(0, score),
  };
}

/**
 * Analyze a directory module (with index.ts)
 *
 * Scans all files in the directory and aggregates export signals.
 *
 * @param dirPath - Absolute path to the directory
 * @returns Aggregated export signals
 */
export function analyzeDirectoryExports(dirPath: string): ExportSignals {
  if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
    return {
      namedExportCount: 0,
      defaultExportOnly: false,
      hasBarrelFile: false,
      exportedFunctions: 0,
      exportedTypes: 0,
      exportedClasses: 0,
      exportedConstants: 0,
      exportedEnums: 0,
      score: 0,
    };
  }

  // Find the barrel file first
  const barrelPath = ['index.ts', 'index.tsx', 'index.js', 'index.jsx']
    .map((name) => path.join(dirPath, name))
    .find((p) => fs.existsSync(p));

  if (!barrelPath) {
    return {
      namedExportCount: 0,
      defaultExportOnly: false,
      hasBarrelFile: false,
      exportedFunctions: 0,
      exportedTypes: 0,
      exportedClasses: 0,
      exportedConstants: 0,
      exportedEnums: 0,
      score: 0,
    };
  }

  // Analyze the barrel file
  const signals = analyzeExportSignals(barrelPath);

  // Ensure hasBarrelFile is true
  signals.hasBarrelFile = true;

  return signals;
}

/**
 * Get export-based category hint
 *
 * Returns a hint about module category based on export patterns.
 */
export function getExportCategoryHint(
  exports: ExportedMember[],
): 'type' | 'utility' | 'class' | 'constant' | 'mixed' | null {
  if (exports.length === 0) return null;

  const counts = countExportsByType(exports);
  const total = exports.length;

  // More than 80% types/interfaces
  if (counts.types / total > 0.8) {
    return 'type';
  }

  // More than 80% functions
  if (counts.functions / total > 0.8) {
    return 'utility';
  }

  // More than 50% classes
  if (counts.classes / total > 0.5) {
    return 'class';
  }

  // More than 80% constants
  if (counts.constants / total > 0.8) {
    return 'constant';
  }

  // Mixed exports
  if (total > 1) {
    return 'mixed';
  }

  return null;
}
