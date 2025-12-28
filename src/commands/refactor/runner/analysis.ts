/**
 * @module commands/refactor/runner/analysis
 * @description Analysis orchestration for refactor command
 */

import { exists, saveKrolikFile } from '../../../lib';
import {
  analyzeStructure,
  createEnhancedAnalysis,
  findDuplicates,
  findTypeDuplicates,
} from '../analyzers';
import type {
  DuplicateInfo,
  RefactorAnalysis,
  RefactorOptions,
  StructureAnalysis,
  TypeDuplicateInfo,
} from '../core';
import { clearFileCache, getModeFlags, resolveMode } from '../core';
import { createMigrationPlan, findAffectedImports } from '../migration';
import { formatAiNativeXml, formatMigrationPreview, formatRefactor } from '../output';
import { resolvePaths } from '../paths';

// ============================================================================
// RESULT MERGING UTILITIES
// ============================================================================

/**
 * Merge duplicate results from multiple paths
 * Deduplicates by name, merging locations from same-named duplicates
 */
function mergeDuplicates(results: DuplicateInfo[][]): DuplicateInfo[] {
  const byName = new Map<string, DuplicateInfo>();

  for (const duplicates of results) {
    for (const dup of duplicates) {
      const existing = byName.get(dup.name);
      if (existing) {
        // Merge locations (deduplicate by file:line)
        const locationKeys = new Set(existing.locations.map((l) => `${l.file}:${l.line}`));
        for (const loc of dup.locations) {
          const key = `${loc.file}:${loc.line}`;
          if (!locationKeys.has(key)) {
            existing.locations.push(loc);
            locationKeys.add(key);
          }
        }
        // Use higher similarity
        if (dup.similarity > existing.similarity) {
          existing.similarity = dup.similarity;
          existing.recommendation = dup.recommendation;
        }
      } else {
        byName.set(dup.name, { ...dup, locations: [...dup.locations] });
      }
    }
  }

  // Filter out entries with only 1 location (not duplicates anymore after merging)
  return [...byName.values()].filter((d) => d.locations.length >= 2);
}

/**
 * Merge type duplicate results from multiple paths
 */
function mergeTypeDuplicates(
  results: (TypeDuplicateInfo[] | undefined)[],
): TypeDuplicateInfo[] | undefined {
  const validResults = results.filter((r): r is TypeDuplicateInfo[] => r !== undefined);
  if (validResults.length === 0) return undefined;

  const byName = new Map<string, TypeDuplicateInfo>();

  for (const duplicates of validResults) {
    for (const dup of duplicates) {
      const existing = byName.get(dup.name);
      if (existing) {
        // Merge locations
        const locationKeys = new Set(existing.locations.map((l) => `${l.file}:${l.line}`));
        for (const loc of dup.locations) {
          const key = `${loc.file}:${loc.line}`;
          if (!locationKeys.has(key)) {
            existing.locations.push(loc);
            locationKeys.add(key);
          }
        }
        if (dup.similarity > existing.similarity) {
          existing.similarity = dup.similarity;
          existing.recommendation = dup.recommendation;
        }
      } else {
        byName.set(dup.name, { ...dup, locations: [...dup.locations] });
      }
    }
  }

  const merged = [...byName.values()].filter((d) => d.locations.length >= 2);
  return merged.length > 0 ? merged : undefined;
}

/**
 * Merge structure analysis results from multiple paths
 */
function mergeStructures(results: StructureAnalysis[]): StructureAnalysis {
  if (results.length === 0) {
    return {
      flatFiles: [],
      namespacedFolders: [],
      doubleNested: [],
      ungroupedFiles: [],
      score: 100,
      issues: [],
    };
  }

  if (results.length === 1) {
    return results[0]!;
  }

  // Merge all arrays, deduplicate strings
  const flatFiles = [...new Set(results.flatMap((r) => r.flatFiles))];
  const namespacedFolders = [...new Set(results.flatMap((r) => r.namespacedFolders))];
  const doubleNested = [...new Set(results.flatMap((r) => r.doubleNested))];

  // Merge ungroupedFiles (dedupe by file path)
  const ungroupedMap = new Map<string, { file: string; suggestedNamespace: string }>();
  for (const r of results) {
    for (const uf of r.ungroupedFiles) {
      if (!ungroupedMap.has(uf.file)) {
        ungroupedMap.set(uf.file, uf);
      }
    }
  }

  // Merge issues (dedupe by type+message)
  const issueMap = new Map<string, (typeof results)[0]['issues'][0]>();
  for (const r of results) {
    for (const issue of r.issues) {
      const key = `${issue.type}:${issue.message}`;
      if (!issueMap.has(key)) {
        issueMap.set(key, issue);
      }
    }
  }

  // Average score
  const avgScore = Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length);

  return {
    flatFiles,
    namespacedFolders,
    doubleNested,
    ungroupedFiles: [...ungroupedMap.values()],
    score: avgScore,
    issues: [...issueMap.values()],
  };
}

// ============================================================================
// MAIN ANALYSIS
// ============================================================================

/**
 * Run refactor analysis
 * Analyzes all source paths (lib, components, app, etc.) for comprehensive duplicate detection
 */
export async function runRefactor(
  projectRoot: string,
  options: RefactorOptions = {},
): Promise<RefactorAnalysis> {
  clearFileCache();

  // Resolve mode from options (handles legacy flags)
  const mode = resolveMode(options);
  const modeFlags = getModeFlags(mode);

  // Use consolidated path resolution
  const resolved = resolvePaths(projectRoot, options);
  const { targetPaths, libPath, relativePaths } = resolved;

  // Filter to existing paths only
  const existingPaths = targetPaths.filter((p) => exists(p));
  const existingRelPaths = relativePaths.filter((_, i) => exists(targetPaths[i] ?? ''));

  if (existingPaths.length === 0) {
    throw new Error(`No valid target paths found. Checked: ${relativePaths.join(', ')}`);
  }

  // Create shared ts-morph Project only if we need type analysis (deep mode)
  // This avoids creating separate projects in each analyzer (significant performance gain)
  // Note: SWC is always used for function duplicates (fast parser)
  // ts-morph is only needed for type analysis
  let sharedProject:
    | ReturnType<typeof import('../analyzers/shared/helpers').createSharedProject>
    | undefined;

  if (modeFlags.analyzeTypeDuplicates) {
    const { createSharedProject } = await import('../analyzers/shared/helpers');
    // Use first path for project creation (it will find tsconfig from there)
    sharedProject = createSharedProject(existingPaths[0]!, projectRoot);
  }

  // Run analysis on all paths in parallel
  const analysisPromises = existingPaths.map(async (targetPath) => {
    const [duplicates, typeDuplicates, structure] = await Promise.all([
      // Function duplicates (default, deep modes - not quick)
      // Uses SWC parser (fast) for 10-20x faster parsing
      modeFlags.analyzeFunctionDuplicates
        ? findDuplicates(targetPath, projectRoot, {
            useFastParser: true, // Always use SWC (fast parser)
            ...(sharedProject ? { project: sharedProject } : {}),
          })
        : Promise.resolve([]),
      // Type/interface duplicates (deep mode only)
      modeFlags.analyzeTypeDuplicates
        ? findTypeDuplicates(targetPath, projectRoot, {
            ...(sharedProject ? { project: sharedProject } : {}),
          })
        : Promise.resolve(undefined),
      // Structure analysis (all modes)
      modeFlags.analyzeStructure
        ? Promise.resolve(analyzeStructure(targetPath, projectRoot))
        : Promise.resolve({
            flatFiles: [],
            namespacedFolders: [],
            doubleNested: [],
            ungroupedFiles: [],
            score: 100,
            issues: [],
          }),
    ]);

    return { duplicates, typeDuplicates, structure };
  });

  const pathResults = await Promise.all(analysisPromises);

  // Merge results from all paths
  const duplicates = mergeDuplicates(pathResults.map((r) => r.duplicates));
  const typeDuplicates = mergeTypeDuplicates(pathResults.map((r) => r.typeDuplicates));
  const structure = mergeStructures(pathResults.map((r) => r.structure));

  // Create migration plan (using libPath for file operations)
  let migration = createMigrationPlan(duplicates, structure, libPath);

  // Find affected imports for each action (parallel)
  const importResults = await Promise.all(
    migration.actions.map((action) => findAffectedImports(action.source, projectRoot)),
  );
  migration.actions.forEach((action, i) => {
    action.affectedImports = importResults[i] ?? [];
  });

  // Recalculate imports count
  migration = {
    ...migration,
    importsToUpdate: migration.actions.reduce((sum, a) => sum + a.affectedImports.length, 0),
  };

  // Display path as comma-separated list if multiple paths analyzed
  const displayPath =
    existingRelPaths.length > 1 ? existingRelPaths.join(', ') : (existingRelPaths[0] ?? '');

  const result: RefactorAnalysis = {
    path: displayPath,
    libPath,
    duplicates,
    structure,
    migration,
    timestamp: new Date().toISOString(),
  };

  if (typeDuplicates) {
    result.typeDuplicates = typeDuplicates;
  }

  return result;
}

/**
 * Format and print analysis
 */
export async function printAnalysis(
  analysis: RefactorAnalysis,
  projectRoot: string,
  targetPath: string,
  options: RefactorOptions = {},
): Promise<void> {
  const format = options.format ?? 'text';
  const mode = resolveMode(options);

  // Generate enhanced XML for saving (always)
  const enhanced = await createEnhancedAnalysis(analysis, projectRoot, targetPath);
  const xmlOutput = formatAiNativeXml(enhanced, { mode });

  // Always save to .krolik/REFACTOR.xml for AI access
  saveKrolikFile(projectRoot, 'REFACTOR.xml', xmlOutput);

  // For XML format, output XML
  if (format === 'xml') {
    console.log(xmlOutput);
    return;
  }

  // Otherwise output in requested format
  const output = formatRefactor(analysis, format);
  console.log(output);

  if (options.dryRun && analysis.migration.actions.length > 0) {
    console.log(formatMigrationPreview(analysis.migration));
  }
}
