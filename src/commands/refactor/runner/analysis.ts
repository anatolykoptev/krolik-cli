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
import type { RefactorAnalysis, RefactorOptions } from '../core';
import { clearFileCache, getModeFlags, resolveMode } from '../core';
import { createMigrationPlan, findAffectedImports } from '../migration';
import { formatAiNativeXml, formatMigrationPreview, formatRefactor } from '../output';
import { resolvePaths } from '../paths';

/**
 * Run refactor analysis
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
  const { targetPath, libPath, relativePath: relPath } = resolved;

  // Verify target exists
  if (!exists(targetPath)) {
    throw new Error(`Target path does not exist: ${targetPath}`);
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
    sharedProject = createSharedProject(targetPath, projectRoot);
  }

  // Run analysis based on mode flags (parallel execution for independent operations)
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

  const result: RefactorAnalysis = {
    path: relPath,
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
