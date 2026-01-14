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
  findSemanticClones,
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
  /** Enable semantic clone detection - Phase 1 hash-based O(n) (default: true) */
  enableSemanticClones?: boolean;
  /** Enable fuzzy semantic matching - Phase 2 O(n²) (default: false, only in deep mode) */
  enableFuzzySemanticClones?: boolean;
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
  const debug = process.env.DEBUG_PERF === '1';
  const {
    verbose = false,
    ignoreTests = true,
    useFastParser = true,
    enableSemanticClones = true, // Phase 1 is O(n), fast - enabled by default
    enableFuzzySemanticClones = false, // Phase 2 is O(n²), slow - only in deep mode
  } = options;

  // Find all source files
  let t0 = Date.now();
  const files = await findSourceFiles(targetPath, ignoreTests);
  if (debug)
    console.log(
      `[perf:findDuplicates] findSourceFiles: ${Date.now() - t0}ms (${files.length} files)`,
    );

  // Extract all functions from all files
  t0 = Date.now();
  const allFunctions: FunctionSignature[] = useFastParser
    ? parseFilesWithSwc(files, projectRoot, verbose)
    : parseFilesWithTsMorph(files, projectRoot, targetPath, verbose, options.project);
  if (debug)
    console.log(
      `[perf:findDuplicates] parsing: ${Date.now() - t0}ms (${allFunctions.length} functions)`,
    );

  // Track reported locations to avoid duplicates across strategies
  const reportedLocations = new Set<string>();

  // Run all detection strategies
  t0 = Date.now();
  const nameDuplicates = findNameBasedDuplicates(allFunctions);
  if (debug) console.log(`[perf:findDuplicates] nameDuplicates: ${Date.now() - t0}ms`);

  t0 = Date.now();
  const bodyDuplicates = findBodyHashDuplicates(allFunctions, reportedLocations);
  if (debug) console.log(`[perf:findDuplicates] bodyDuplicates: ${Date.now() - t0}ms`);

  t0 = Date.now();
  const structuralClones = findStructuralClones(allFunctions, reportedLocations);
  if (debug) console.log(`[perf:findDuplicates] structuralClones: ${Date.now() - t0}ms`);

  // Semantic clones: Phase 1 (hash-based, O(n)) runs by default
  // Phase 2 (fuzzy, O(n²)) only runs when enableFuzzySemanticClones is true
  let semanticClones: DuplicateInfo[] = [];
  if (enableSemanticClones) {
    t0 = Date.now();
    semanticClones = findSemanticClones(allFunctions, reportedLocations, {
      enableFuzzyMatching: enableFuzzySemanticClones,
    });
    if (debug) console.log(`[perf:findDuplicates] semanticClones: ${Date.now() - t0}ms`);
  }

  // Combine results from all strategies
  return [...nameDuplicates, ...bodyDuplicates, ...structuralClones, ...semanticClones];
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
