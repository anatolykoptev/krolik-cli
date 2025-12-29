/**
 * @module commands/refactor/analyzers/core/type-duplicates
 * @description Detection of duplicate interfaces and type aliases
 *
 * Detects:
 * - Interfaces with identical structure (same fields & types)
 * - Type aliases with identical definitions
 * - Similar interfaces (>80% field overlap)
 */

import * as path from 'node:path';
import { findFiles, logger, readFile, validatePathWithinProject } from '../../../../lib';
import type { TypeDuplicateInfo } from '../../core/types';
import { hashContent, jaccardSimilarity, LIMITS, SIMILARITY_THRESHOLDS } from '../shared';
import { extractTypesSwc, type SwcTypeInfo } from './swc-parser';

// Re-export for public API
export type { TypeDuplicateInfo } from '../../core/types';

// ============================================================================
// TYPES
// ============================================================================

export interface TypeSignature {
  /** Type name */
  name: string;
  /** File path (relative) */
  file: string;
  /** Line number */
  line: number;
  /** Is exported */
  exported: boolean;
  /** Type kind: interface or type alias */
  kind: 'interface' | 'type';
  /** Normalized structure for comparison */
  normalizedStructure: string;
  /** Hash of normalized structure */
  structureHash: string;
  /** Field names (for interfaces) */
  fields?: string[];
  /** Original definition text */
  definition: string;
}

export interface FindTypeDuplicatesOptions {
  verbose?: boolean;
  minSimilarity?: number;
  ignoreTests?: boolean;
  /** Include type aliases (default: true) */
  includeTypes?: boolean;
  /** Include interfaces (default: true) */
  includeInterfaces?: boolean;
}

// Constants imported from ../shared/constants

// ============================================================================
// EXTRACTION (SWC-based)
// ============================================================================

/**
 * Convert SwcTypeInfo to TypeSignature
 */
function swcTypeToSignature(info: SwcTypeInfo, filePath: string): TypeSignature {
  const signature: TypeSignature = {
    name: info.name,
    file: filePath,
    line: info.line,
    exported: info.isExported,
    kind: info.kind,
    normalizedStructure: info.normalizedStructure,
    structureHash: hashStructure(info.normalizedStructure),
    definition: info.definition,
  };

  // Only add fields if non-empty (exactOptionalPropertyTypes compliance)
  if (info.fields.length > 0) {
    signature.fields = info.fields;
  }

  return signature;
}

/**
 * Extract types from file using SWC (fast parser)
 */
function extractTypesFromFile(filePath: string, content: string, relPath: string): TypeSignature[] {
  const swcTypes = extractTypesSwc(filePath, content);
  return swcTypes.map((t) => swcTypeToSignature(t, relPath));
}

// ============================================================================
// HASHING
// ============================================================================

/**
 * Hash structure for quick comparison
 * Uses shared hashContent utility
 */
function hashStructure(structure: string): string {
  return hashContent(structure);
}

// ============================================================================
// SIMILARITY
// ============================================================================

/**
 * Calculate structural similarity between two types
 * Uses shared jaccardSimilarity for set comparison
 */
function calculateTypeSimilarity(type1: TypeSignature, type2: TypeSignature): number {
  // Exact match
  if (type1.structureHash === type2.structureHash) {
    return 1;
  }

  // For interfaces, compare field overlap using Jaccard similarity
  if (type1.kind === 'interface' && type2.kind === 'interface' && type1.fields && type2.fields) {
    return jaccardSimilarity(new Set(type1.fields), new Set(type2.fields));
  }

  // For type aliases, compare token similarity using Jaccard
  const tokens1 = new Set(type1.normalizedStructure.split(/[^a-zA-Z0-9_]/));
  const tokens2 = new Set(type2.normalizedStructure.split(/[^a-zA-Z0-9_]/));

  return jaccardSimilarity(tokens1, tokens2);
}

/**
 * Find common and different fields between interfaces
 */
function analyzeFieldDifference(
  type1: TypeSignature,
  type2: TypeSignature,
): { common: string[]; onlyIn1: string[]; onlyIn2: string[] } {
  const fields1 = new Set(type1.fields ?? []);
  const fields2 = new Set(type2.fields ?? []);

  return {
    common: [...fields1].filter((f) => fields2.has(f)),
    onlyIn1: [...fields1].filter((f) => !fields2.has(f)),
    onlyIn2: [...fields2].filter((f) => !fields1.has(f)),
  };
}

// ============================================================================
// MAIN ANALYSIS
// ============================================================================

/**
 * Find duplicate types in a directory
 */
export async function findTypeDuplicates(
  targetPath: string,
  projectRoot: string,
  options: FindTypeDuplicatesOptions = {},
): Promise<TypeDuplicateInfo[]> {
  const {
    verbose = false,
    ignoreTests = true,
    includeTypes = true,
    includeInterfaces = true,
  } = options;

  // Security: validate path is within project
  const pathValidation = validatePathWithinProject(projectRoot, targetPath);
  if (!pathValidation.valid) {
    throw new Error(`Security: ${pathValidation.error ?? 'Path outside project'}`);
  }

  const duplicates: TypeDuplicateInfo[] = [];

  // Find all TypeScript files
  const allFiles = await findFiles(targetPath, {
    extensions: ['.ts', '.tsx'],
    skipDirs: ['node_modules', 'dist', '.next', 'coverage'],
  });

  // Filter files
  let files = allFiles.filter((f) => !f.endsWith('.d.ts'));
  if (ignoreTests) {
    files = files.filter((f) => !f.includes('.test.') && !f.includes('.spec.'));
  }

  // Limit files
  if (files.length > LIMITS.MAX_FILES) {
    logger.warn(`Too many files (${files.length}), limiting to ${LIMITS.MAX_FILES}`);
    files = files.slice(0, LIMITS.MAX_FILES);
  }

  // Extract all types using SWC (fast parser)
  const allTypes: TypeSignature[] = [];

  for (const file of files) {
    try {
      const content = readFile(file);
      if (!content) continue;
      if (content.length > LIMITS.MAX_FILE_SIZE) continue;

      const relPath = path.relative(projectRoot, file);
      const types = extractTypesFromFile(file, content, relPath);

      // Filter by kind
      const filteredTypes = types.filter((t) => {
        if (t.kind === 'interface' && !includeInterfaces) return false;
        if (t.kind === 'type' && !includeTypes) return false;
        return true;
      });

      allTypes.push(...filteredTypes);
    } catch (error) {
      if (verbose) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.warn(`Failed to parse ${path.relative(projectRoot, file)}: ${message}`);
      }
    }
  }

  // Group by name (same name in multiple files)
  const byName = new Map<string, TypeSignature[]>();
  for (const type of allTypes) {
    const existing = byName.get(type.name) ?? [];
    existing.push(type);
    byName.set(type.name, existing);
  }

  // Find duplicates by name
  for (const [name, types] of byName) {
    if (types.length < 2) continue;

    // Calculate similarity
    let minSimilarity = 1;

    // Short-circuit for 2-element groups
    if (types.length === 2) {
      const t1 = types[0];
      const t2 = types[1];
      if (t1 && t2) {
        minSimilarity = calculateTypeSimilarity(t1, t2);
      }
    } else {
      for (let i = 0; i < types.length - 1; i++) {
        for (let j = i + 1; j < types.length; j++) {
          const ti = types[i];
          const tj = types[j];
          if (ti && tj) {
            const sim = calculateTypeSimilarity(ti, tj);
            minSimilarity = Math.min(minSimilarity, sim);

            // Early exit when below threshold - can't improve
            if (minSimilarity < SIMILARITY_THRESHOLDS.MERGE) break;
          }
        }
        // Early exit outer loop if already below threshold
        if (minSimilarity < SIMILARITY_THRESHOLDS.MERGE) break;
      }
    }

    // Determine kind
    const kinds = new Set(types.map((t) => t.kind));
    const kind = kinds.size === 1 ? [...kinds][0]! : 'mixed';

    // Recommendation
    let recommendation: 'merge' | 'rename' | 'keep-both' = 'keep-both';
    if (minSimilarity > SIMILARITY_THRESHOLDS.MERGE) {
      recommendation = 'merge';
    } else if (minSimilarity > SIMILARITY_THRESHOLDS.RENAME_TYPES) {
      recommendation = 'rename';
    }

    // Analyze differences for interfaces
    let commonFields: string[] | undefined;
    let difference: string | undefined;

    if (kind === 'interface' && types.length === 2 && types[0] && types[1]) {
      const diff = analyzeFieldDifference(types[0], types[1]);
      commonFields = diff.common;
      if (diff.onlyIn1.length > 0 || diff.onlyIn2.length > 0) {
        difference = `Only in ${types[0].file}: ${diff.onlyIn1.join(', ') || 'none'}; Only in ${types[1].file}: ${diff.onlyIn2.join(', ') || 'none'}`;
      }
    }

    const duplicateInfo: TypeDuplicateInfo = {
      name,
      kind,
      locations: types.map((t) => ({
        file: t.file,
        line: t.line,
        exported: t.exported,
        name: t.name,
      })),
      similarity: minSimilarity,
      recommendation,
    };

    if (commonFields) duplicateInfo.commonFields = commonFields;
    if (difference) duplicateInfo.difference = difference;

    duplicates.push(duplicateInfo);
  }

  // Find types with identical structures but different names
  const byHash = new Map<string, TypeSignature[]>();
  for (const type of allTypes) {
    // Skip empty structures
    if (type.normalizedStructure.length < 5) continue;

    const existing = byHash.get(type.structureHash) ?? [];
    existing.push(type);
    byHash.set(type.structureHash, existing);
  }

  for (const [, types] of byHash) {
    if (types.length < 2) continue;

    // Skip if all have same name (already caught above)
    const uniqueNames = new Set(types.map((t) => t.name));
    if (uniqueNames.size === 1) continue;

    // Sort names for consistent output
    const sortedNames = [...uniqueNames].sort((a, b) => {
      const aExported = types.some((t) => t.name === a && t.exported);
      const bExported = types.some((t) => t.name === b && t.exported);
      if (aExported && !bExported) return -1;
      if (!aExported && bExported) return 1;
      return a.localeCompare(b);
    });

    const kinds = new Set(types.map((t) => t.kind));
    const kind = kinds.size === 1 ? [...kinds][0]! : 'mixed';

    duplicates.push({
      name: `[identical structure] ${sortedNames.join(' / ')}`,
      kind,
      locations: types.map((t) => ({
        file: t.file,
        line: t.line,
        exported: t.exported,
        name: t.name,
      })),
      similarity: 1,
      recommendation: 'merge',
    });
  }

  return duplicates;
}

/**
 * Quick scan for type duplicates without full AST parsing
 */
export async function quickScanTypeDuplicates(targetPath: string): Promise<string[]> {
  const typeNames = new Map<string, string[]>();

  const files = await findFiles(targetPath, {
    extensions: ['.ts', '.tsx'],
    skipDirs: ['node_modules', 'dist', '.next'],
  });

  const sourceFiles = files.filter((f) => !f.endsWith('.d.ts'));

  for (const file of sourceFiles) {
    const content = readFile(file);
    if (!content) continue;

    // Match: export interface Name
    const interfaces = content.match(/export\s+interface\s+(\w+)/g) ?? [];
    // Match: export type Name =
    const types = content.match(/export\s+type\s+(\w+)\s*=/g) ?? [];

    for (const match of interfaces) {
      const name = match.replace(/export\s+interface\s+/, '');
      const existing = typeNames.get(name) ?? [];
      existing.push(file);
      typeNames.set(name, existing);
    }

    for (const match of types) {
      const name = match.replace(/export\s+type\s+/, '').replace(/\s*=$/, '');
      const existing = typeNames.get(name) ?? [];
      existing.push(file);
      typeNames.set(name, existing);
    }
  }

  return [...typeNames.entries()]
    .filter(([, files]) => files.length > 1)
    .map(([name, files]) => `${name}: ${files.join(', ')}`);
}
