/**
 * @module commands/refactor/analyzers/core/duplicates/analyzer
 * @description Main duplicate function detection and analysis
 */

import type { Project } from '../../../../../lib/@ast';
import { findFiles, readFile } from '../../../../../lib/@core/fs';
import {
  allRenderDifferentComponents,
  areAllDifferentDomains,
  detectIntent,
} from '../../../../../lib/@detectors/noise-filter/extractors';
import type { DuplicateInfo, DuplicateLocation, FunctionSignature } from '../../../core/types';
import { SIMILARITY_THRESHOLDS } from '../../shared';
import { isMeaningfulFunctionName, isNextJsConventionPattern } from './name-detection';
import { findSourceFiles, parseFilesWithSwc, parseFilesWithTsMorph } from './parsing';
import { calculateGroupSimilarity } from './similarity';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Minimum structural complexity for clone detection.
 * Filters out simple wrappers like `return <Component />` (complexity ~15).
 * Only functions with meaningful logic (complexity > 25) are considered clones.
 */
const MIN_STRUCTURAL_COMPLEXITY = 25;

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Check if function body is large enough to be a duplicate candidate.
 * Uses normalized body length (~100 chars ≈ 2-3 lines of meaningful code).
 */
function isLargeEnoughForDuplication(func: FunctionSignature): boolean {
  return func.normalizedBody.length >= SIMILARITY_THRESHOLDS.MIN_BODY_LENGTH;
}

/**
 * Check if file is a Next.js page file (page.tsx or page.ts in app directory)
 */
function isNextJsPageFile(filePath: string): boolean {
  return /\/page\.tsx?$/.test(filePath);
}

/**
 * Check if all functions are in different Next.js route segments.
 * Functions in different route segments (e.g., /panel/customers vs /panel/bookings)
 * are intentional wrappers, not real duplicates.
 */
function areAllInDifferentRouteSegments(funcs: FunctionSignature[]): boolean {
  // Only applies if ALL functions are in page.tsx files
  if (!funcs.every((f) => isNextJsPageFile(f.file))) return false;

  // Extract route segments (everything before /page.tsx)
  const segments = funcs.map((f) => {
    const match = f.file.match(/(.+)\/page\.tsx?$/);
    return match?.[1] ?? f.file;
  });

  // If all segments are unique, these are different routes
  const uniqueSegments = new Set(segments);
  return uniqueSegments.size === funcs.length;
}

/**
 * Deduplicate locations by file:line key
 * Returns unique locations and whether there are multiple unique files
 */
function deduplicateLocations(funcs: FunctionSignature[]): {
  locations: DuplicateLocation[];
  uniqueFileCount: number;
} {
  const seen = new Map<string, DuplicateLocation>();
  const uniqueFiles = new Set<string>();

  for (const f of funcs) {
    const key = `${f.file}:${f.line}`;
    if (!seen.has(key)) {
      seen.set(key, { file: f.file, line: f.line, exported: f.exported });
      uniqueFiles.add(f.file);
    }
  }

  return {
    locations: [...seen.values()],
    uniqueFileCount: uniqueFiles.size,
  };
}

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

/**
 * Find duplicate functions in a directory
 */
export async function findDuplicates(
  targetPath: string,
  projectRoot: string,
  options: FindDuplicatesOptions = {},
): Promise<DuplicateInfo[]> {
  const { verbose = false, ignoreTests = true, useFastParser = true } = options;
  const duplicates: DuplicateInfo[] = [];

  // Find all source files
  const files = await findSourceFiles(targetPath, ignoreTests);

  // Extract all functions from all files
  const allFunctions: FunctionSignature[] = useFastParser
    ? parseFilesWithSwc(files, projectRoot, verbose)
    : parseFilesWithTsMorph(files, projectRoot, targetPath, verbose, options.project);

  // Group functions by name (skip generic names and framework conventions)
  const byName = new Map<string, FunctionSignature[]>();
  for (const func of allFunctions) {
    // Skip generic/callback names
    if (!isMeaningfulFunctionName(func.name)) continue;

    // Skip Next.js convention patterns (POST, GET, *Page in page.tsx, etc.)
    if (isNextJsConventionPattern(func.name, func.file)) continue;

    const existing = byName.get(func.name) ?? [];
    existing.push(func);
    byName.set(func.name, existing);
  }

  // Find duplicates (same name in multiple files)
  for (const [name, funcs] of byName) {
    if (funcs.length < 2) continue;

    // Deduplicate locations and check if there are multiple unique files
    const { locations, uniqueFileCount } = deduplicateLocations(funcs);

    // Skip if all occurrences are in the same file (not a real duplicate)
    if (uniqueFileCount < 2) continue;

    // Skip if only one unique location after deduplication
    if (locations.length < 2) continue;

    const similarity = calculateGroupSimilarity(funcs);

    let recommendation: 'merge' | 'rename' | 'keep-both' = 'keep-both';
    if (similarity > SIMILARITY_THRESHOLDS.MERGE) {
      recommendation = 'merge';
    } else if (similarity > SIMILARITY_THRESHOLDS.RENAME_FUNCTIONS) {
      recommendation = 'rename';
    }

    duplicates.push({
      name,
      locations,
      similarity,
      recommendation,
    });
  }

  // Also find functions with identical bodies but different names
  const byHash = new Map<string, FunctionSignature[]>();
  for (const func of allFunctions) {
    // Skip tiny functions
    if (!isLargeEnoughForDuplication(func)) continue;

    const existing = byHash.get(func.bodyHash) ?? [];
    existing.push(func);
    byHash.set(func.bodyHash, existing);
  }

  // Track reported locations to avoid duplicating in fingerprint section
  const reportedLocations = new Set<string>();

  for (const [, funcs] of byHash) {
    if (funcs.length < 2) continue;

    // Deduplicate locations and check if there are multiple unique files
    const { locations, uniqueFileCount } = deduplicateLocations(funcs);

    // Skip if all occurrences are in the same file
    if (uniqueFileCount < 2) continue;

    // Skip if only one unique location after deduplication
    if (locations.length < 2) continue;

    const uniqueNames = new Set(funcs.map((f) => f.name));
    if (uniqueNames.size === 1) continue;

    const sortedNames = [...uniqueNames].sort((a, b) => {
      const aExported = funcs.some((f) => f.name === a && f.exported);
      const bExported = funcs.some((f) => f.name === b && f.exported);
      if (aExported && !bExported) return -1;
      if (!aExported && bExported) return 1;
      return a.localeCompare(b);
    });

    // Mark these locations as reported
    for (const loc of locations) {
      reportedLocations.add(`${loc.file}:${loc.line}`);
    }

    duplicates.push({
      name: `[identical body] ${sortedNames.join(' / ')}`,
      locations,
      similarity: 1,
      recommendation: 'merge',
    });
  }

  // Find structural clones (same structure, different variable names) using fingerprints
  // This catches renamed clones that bodyHash misses:
  // e.g., `getUser(id) { return db.find(id); }` and `fetchItem(key) { return store.find(key); }`
  const byFingerprint = new Map<string, FunctionSignature[]>();

  for (const func of allFunctions) {
    // Skip tiny functions and functions without fingerprint
    if (!isLargeEnoughForDuplication(func)) continue;
    if (!func.fingerprint) continue;

    // Skip low-complexity functions (simple wrappers like `return <X />`)
    // These are intentional patterns, not real duplicates
    if ((func.complexity ?? 0) < MIN_STRUCTURAL_COMPLEXITY) continue;

    // Skip if already reported in another duplicate group
    const locKey = `${func.file}:${func.line}`;
    if (reportedLocations.has(locKey)) continue;

    const existing = byFingerprint.get(func.fingerprint) ?? [];
    existing.push(func);
    byFingerprint.set(func.fingerprint, existing);
  }

  for (const [, funcs] of byFingerprint) {
    if (funcs.length < 2) continue;

    // Deduplicate locations and check if there are multiple unique files
    const { locations, uniqueFileCount } = deduplicateLocations(funcs);

    // Skip if all occurrences are in the same file
    if (uniqueFileCount < 2) continue;

    // Skip if only one unique location after deduplication
    if (locations.length < 2) continue;

    const uniqueNames = new Set(funcs.map((f) => f.name));
    // Only report if names are actually different (otherwise would be caught by name matching)
    if (uniqueNames.size < 2) continue;

    // Skip if all functions are in different Next.js route segments
    // These are intentional page wrappers, not real duplicates
    if (areAllInDifferentRouteSegments(funcs)) continue;

    // Skip if all functions are in different domains
    // Cross-domain structural similarity is intentional, not duplication
    const filePaths = funcs.map((f) => f.file);
    if (areAllDifferentDomains(filePaths)) continue;

    // Skip if any function has a skippable intent (factory, wrapper, route-handler, schema-generator)
    const hasSkippableIntent = funcs.some((f) => {
      const { intent } = detectIntent({ file: f.file, name: f.name, text: f.normalizedBody });
      return [
        'factory-instance',
        'component-wrapper',
        'route-handler',
        'schema-generator',
      ].includes(intent);
    });
    if (hasSkippableIntent) continue;

    // Skip if all functions render different JSX components
    // These are intentional wrappers, not duplicates
    const bodies = funcs.map((f) => f.normalizedBody);
    if (allRenderDifferentComponents(bodies)) continue;

    const sortedNames = [...uniqueNames].sort((a, b) => {
      const aExported = funcs.some((f) => f.name === a && f.exported);
      const bExported = funcs.some((f) => f.name === b && f.exported);
      if (aExported && !bExported) return -1;
      if (!aExported && bExported) return 1;
      return a.localeCompare(b);
    });

    duplicates.push({
      name: `[structural clone] ${sortedNames.join(' / ')}`,
      locations,
      similarity: 0.95, // Slightly less than identical body to differentiate
      recommendation: 'merge',
    });
  }

  return duplicates;
}

/**
 * Quick scan for potential duplicates without full AST parsing
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
