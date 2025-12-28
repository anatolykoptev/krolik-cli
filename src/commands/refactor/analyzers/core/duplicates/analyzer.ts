/**
 * @module commands/refactor/analyzers/core/duplicates/analyzer
 * @description Main duplicate function detection and analysis
 */

import { findFiles, readFile } from '../../../../../lib';
import type { Project } from '../../../../../lib/@ast';
import type { DuplicateInfo, FunctionSignature } from '../../../core';
import { SIMILARITY_THRESHOLDS } from '../../shared';
import { isMeaningfulFunctionName } from './name-detection';
import { findSourceFiles, parseFilesWithSwc, parseFilesWithTsMorph } from './parsing';
import { calculateGroupSimilarity } from './similarity';

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

  // Group functions by name (skip generic names using dynamic heuristics)
  const byName = new Map<string, FunctionSignature[]>();
  for (const func of allFunctions) {
    if (!isMeaningfulFunctionName(func.name)) continue;

    const existing = byName.get(func.name) ?? [];
    existing.push(func);
    byName.set(func.name, existing);
  }

  // Find duplicates (same name in multiple files)
  for (const [name, funcs] of byName) {
    if (funcs.length < 2) continue;

    const similarity = calculateGroupSimilarity(funcs);

    let recommendation: 'merge' | 'rename' | 'keep-both' = 'keep-both';
    if (similarity > SIMILARITY_THRESHOLDS.MERGE) {
      recommendation = 'merge';
    } else if (similarity > SIMILARITY_THRESHOLDS.RENAME_FUNCTIONS) {
      recommendation = 'rename';
    }

    duplicates.push({
      name,
      locations: funcs.map((f) => ({
        file: f.file,
        line: f.line,
        exported: f.exported,
      })),
      similarity,
      recommendation,
    });
  }

  // Also find functions with identical bodies but different names
  const byHash = new Map<string, FunctionSignature[]>();
  for (const func of allFunctions) {
    if (func.normalizedBody.length < SIMILARITY_THRESHOLDS.MIN_BODY_LENGTH) continue;

    const existing = byHash.get(func.bodyHash) ?? [];
    existing.push(func);
    byHash.set(func.bodyHash, existing);
  }

  for (const [, funcs] of byHash) {
    if (funcs.length < 2) continue;

    const uniqueNames = new Set(funcs.map((f) => f.name));
    if (uniqueNames.size === 1) continue;

    const sortedNames = [...uniqueNames].sort((a, b) => {
      const aExported = funcs.some((f) => f.name === a && f.exported);
      const bExported = funcs.some((f) => f.name === b && f.exported);
      if (aExported && !bExported) return -1;
      if (!aExported && bExported) return 1;
      return a.localeCompare(b);
    });

    duplicates.push({
      name: `[identical body] ${sortedNames.join(' / ')}`,
      locations: funcs.map((f) => ({
        file: f.file,
        line: f.line,
        exported: f.exported,
      })),
      similarity: 1,
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
