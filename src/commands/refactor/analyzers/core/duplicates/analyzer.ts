/**
 * @module commands/refactor/analyzers/core/duplicates/analyzer
 * @description Main duplicate function detection orchestrator
 *
 * Coordinates three detection strategies:
 * 1. Name-based: Same function name in multiple files
 * 2. Body hash: Identical function bodies with different names
 * 3. Structural: Same structure with renamed variables (fingerprint-based)
 */

import type { Project } from '../../../../../lib/@ast';
import { findFiles, readFile } from '../../../../../lib/@core/fs';
import type { DuplicateInfo, FunctionSignature } from '../../../core/types';
import { findSourceFiles, parseFilesWithSwc, parseFilesWithTsMorph } from './parsing';
import {
  findBodyHashDuplicates,
  findNameBasedDuplicates,
  findStructuralClones,
} from './strategies';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Options for duplicate detection
 */
export interface FindDuplicatesOptions {
  verbose?: boolean;
  minSimilarity?: number;
  ignoreTests?: boolean;
  /** Use fast SWC parser instead of ts-morph (default: true) */
  useFastParser?: boolean;
  /** Shared ts-morph Project instance (optional, for performance) */
  project?: Project;
}

// ============================================================================
// MAIN ORCHESTRATOR
// ============================================================================

/**
 * Find duplicate functions in a directory.
 *
 * Orchestrates three detection strategies:
 * 1. Name-based duplicates (same name, multiple files)
 * 2. Body hash duplicates (identical bodies, different names)
 * 3. Structural clones (same structure, renamed variables)
 */
export async function findDuplicates(
  targetPath: string,
  projectRoot: string,
  options: FindDuplicatesOptions = {},
): Promise<DuplicateInfo[]> {
  const { verbose = false, ignoreTests = true, useFastParser = true } = options;

  // Find all source files
  const files = await findSourceFiles(targetPath, ignoreTests);

  // Extract all functions from all files
  const allFunctions: FunctionSignature[] = useFastParser
    ? parseFilesWithSwc(files, projectRoot, verbose)
    : parseFilesWithTsMorph(files, projectRoot, targetPath, verbose, options.project);

  // Track reported locations to avoid duplicates across strategies
  const reportedLocations = new Set<string>();

  // Run all detection strategies
  const nameDuplicates = findNameBasedDuplicates(allFunctions);
  const bodyDuplicates = findBodyHashDuplicates(allFunctions, reportedLocations);
  const structuralClones = findStructuralClones(allFunctions, reportedLocations);

  // Combine results from all strategies
  return [...nameDuplicates, ...bodyDuplicates, ...structuralClones];
}

// ============================================================================
// QUICK SCAN (Regex-based, for fast overview)
// ============================================================================

/**
 * Quick scan for potential duplicates without full AST parsing.
 * Uses regex to find exported functions/consts with same names.
 */
export async function quickScanDuplicates(targetPath: string): Promise<string[]> {
  const functionNames: Map<string, string[]> = new Map();

  const files = await findFiles(targetPath, {
    extensions: ['.ts', '.tsx'],
    skipDirs: ['node_modules', 'dist', '.next'],
  });

  const sourceFiles = files.filter((f) => !f.endsWith('.d.ts'));

  for (const file of sourceFiles) {
    const content = readFile(file);
    if (!content) continue;

    const exportedFunctions = content.match(/export\s+(async\s+)?function\s+(\w+)/g) ?? [];
    const exportedConsts = content.match(/export\s+const\s+(\w+)\s*=/g) ?? [];

    for (const match of exportedFunctions) {
      const name = match.replace(/export\s+(async\s+)?function\s+/, '');
      const existing = functionNames.get(name) ?? [];
      existing.push(file);
      functionNames.set(name, existing);
    }

    for (const match of exportedConsts) {
      const name = match.replace(/export\s+const\s+/, '').replace(/\s*=$/, '');
      const existing = functionNames.get(name) ?? [];
      existing.push(file);
      functionNames.set(name, existing);
    }
  }

  return [...functionNames.entries()]
    .filter(([, fileList]) => fileList.length > 1)
    .map(([name, fileList]) => `${name}: ${fileList.join(', ')}`);
}
