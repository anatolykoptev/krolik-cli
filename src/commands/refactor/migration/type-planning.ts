/**
 * @module commands/refactor/migration/type-planning
 * @description Type migration plan creation from duplicate detection
 *
 * Creates migration plans for merging duplicate types/interfaces.
 * Phase 1: Only 100% identical types for safe auto-merge.
 */

import * as path from 'node:path';
import { findFiles, readFile } from '../../../lib/@core/fs';
import type { TypeDuplicateInfo } from '../core/types';
import type {
  ImportUpdateAction,
  TypeLocationInfo,
  TypeMigrationAction,
  TypeMigrationPlan,
  TypeMigrationPlanOptions,
} from '../core/types-migration';
import { DEFAULT_CANONICAL_CRITERIA } from '../core/types-migration';

// ============================================================================
// PLAN CREATION
// ============================================================================

/**
 * Create type migration plan from duplicate detection results
 */
export async function createTypeMigrationPlan(
  duplicates: TypeDuplicateInfo[],
  projectRoot: string,
  options: TypeMigrationPlanOptions = {},
): Promise<TypeMigrationPlan> {
  const { onlyIdentical = true, minSimilarity = 1.0 } = options;

  const actions: TypeMigrationAction[] = [];
  const importUpdates: ImportUpdateAction[] = [];

  for (const dup of duplicates) {
    // Skip non-merge candidates
    if (dup.recommendation !== 'merge') continue;

    // Apply similarity filter
    if (onlyIdentical && dup.similarity < 1) continue;
    if (dup.similarity < minSimilarity) continue;

    // Analyze usage to select canonical location
    const locationInfos = await analyzeTypeLocations(dup, projectRoot);
    const canonical = selectCanonicalLocation(locationInfos);

    if (!canonical) continue;

    // Create removal actions for non-canonical locations
    for (const loc of locationInfos) {
      if (loc.file === canonical.file && loc.name === canonical.name) continue;

      const action: TypeMigrationAction = {
        type: 'remove-type',
        typeName: loc.name,
        sourceFile: loc.file,
        targetFile: canonical.file,
        risk: dup.similarity === 1 ? 'safe' : 'medium',
        similarity: dup.similarity,
      };

      // Only add optional properties if they have values
      if (loc.name !== canonical.name) {
        action.originalName = loc.name;
      }
      if (loc.hasJSDoc && !canonical.hasJSDoc) {
        action.preserveJSDoc = true;
      }

      actions.push(action);

      // Find files that need import updates
      const importers = await findTypeImporters(loc.name, loc.file, projectRoot);
      for (const importer of importers) {
        importUpdates.push({
          file: importer,
          typeName: loc.name,
          oldSource: loc.file,
          newSource: canonical.file,
        });
      }
    }
  }

  // Calculate statistics
  const filesAffected = new Set([
    ...actions.map((a) => a.sourceFile),
    ...importUpdates.map((u) => u.file),
  ]).size;

  return {
    actions,
    importUpdates,
    stats: {
      typesToRemove: actions.length,
      importsToUpdate: importUpdates.length,
      filesAffected,
    },
    riskSummary: {
      safe: actions.filter((a) => a.risk === 'safe').length,
      medium: actions.filter((a) => a.risk === 'medium').length,
      risky: actions.filter((a) => a.risk === 'risky').length,
    },
  };
}

// ============================================================================
// LOCATION ANALYSIS
// ============================================================================

/**
 * Analyze type locations with usage info for canonical selection
 */
async function analyzeTypeLocations(
  dup: TypeDuplicateInfo,
  projectRoot: string,
): Promise<TypeLocationInfo[]> {
  const result: TypeLocationInfo[] = [];

  for (const loc of dup.locations) {
    // Find importers for this type from this location
    const importers = await findTypeImporters(loc.name, loc.file, projectRoot);

    // Check if this is a dedicated types file
    const isTypeFile = isTypesFile(loc.file);

    // Check for JSDoc
    const hasJSDoc = await checkHasJSDoc(loc.file, loc.name, projectRoot);

    // Calculate path depth
    const pathDepth = loc.file.split('/').length;

    result.push({
      file: loc.file,
      name: loc.name,
      line: loc.line,
      exported: loc.exported,
      importerCount: importers.length,
      isTypeFile,
      hasJSDoc,
      pathDepth,
    });
  }

  return result;
}

/**
 * Check if file is a dedicated types file
 */
function isTypesFile(filePath: string): boolean {
  const basename = path.basename(filePath);
  return (
    basename === 'types.ts' ||
    basename === 'types.d.ts' ||
    basename.endsWith('.types.ts') ||
    filePath.includes('/types/') ||
    filePath.includes('/core/types')
  );
}

/**
 * Check if type has JSDoc documentation
 */
async function checkHasJSDoc(
  filePath: string,
  typeName: string,
  projectRoot: string,
): Promise<boolean> {
  try {
    const fullPath = path.join(projectRoot, filePath);
    const content = readFile(fullPath);
    if (!content) return false;

    // Simple regex check for JSDoc before type/interface
    const jsdocPattern = new RegExp(
      `\\/\\*\\*[\\s\\S]*?\\*/\\s*(export\\s+)?(interface|type)\\s+${typeName}\\b`,
    );
    return jsdocPattern.test(content);
  } catch {
    return false;
  }
}

// ============================================================================
// CANONICAL SELECTION
// ============================================================================

/**
 * Select the canonical location where the type should remain
 *
 * Priority:
 * 1. Exported > non-exported
 * 2. Dedicated types file > regular file
 * 3. More importers > fewer importers
 * 4. Has JSDoc > no JSDoc
 * 5. Shorter path > longer path
 */
function selectCanonicalLocation(locations: TypeLocationInfo[]): TypeLocationInfo | undefined {
  if (locations.length === 0) return undefined;
  if (locations.length === 1) return locations[0];

  const criteria = DEFAULT_CANONICAL_CRITERIA;

  return [...locations].sort((a, b) => {
    // 1. Prefer exported
    if (criteria.preferExported && a.exported !== b.exported) {
      return a.exported ? -1 : 1;
    }

    // 2. Prefer dedicated type files
    if (criteria.preferTypeFiles && a.isTypeFile !== b.isTypeFile) {
      return a.isTypeFile ? -1 : 1;
    }

    // 3. Prefer more importers
    if (criteria.preferMostUsed && a.importerCount !== b.importerCount) {
      return b.importerCount - a.importerCount;
    }

    // 4. Prefer with JSDoc
    if (criteria.preferWithJSDoc && a.hasJSDoc !== b.hasJSDoc) {
      return a.hasJSDoc ? -1 : 1;
    }

    // 5. Prefer shorter path
    if (criteria.preferShorterPath) {
      return a.pathDepth - b.pathDepth;
    }

    return 0;
  })[0];
}

// ============================================================================
// IMPORT ANALYSIS
// ============================================================================

/**
 * Find all files that import a specific type from a specific file
 */
async function findTypeImporters(
  typeName: string,
  sourceFile: string,
  projectRoot: string,
): Promise<string[]> {
  const importers: string[] = [];
  const srcPath = path.join(projectRoot, 'src');

  const files = await findFiles(srcPath, {
    extensions: ['.ts', '.tsx'],
    skipDirs: ['node_modules', 'dist', '.next'],
  });

  // Normalize source file path for matching
  const sourceBasename = path.basename(sourceFile, '.ts');

  for (const file of files) {
    // Skip the source file itself
    const relPath = path.relative(projectRoot, file);
    if (relPath === sourceFile) continue;

    const content = readFile(file);
    if (!content) continue;

    // Check for import of this type from this source
    // Pattern: import { TypeName, ... } from './path/to/source'
    const importPatterns = [
      // Named import: import { TypeName } from './source'
      new RegExp(
        `import\\s+(?:type\\s+)?\\{[^}]*\\b${typeName}\\b[^}]*\\}\\s+from\\s+['"][^'"]*${sourceBasename}['"]`,
      ),
      // Import type: import type { TypeName } from './source'
      new RegExp(
        `import\\s+type\\s+\\{[^}]*\\b${typeName}\\b[^}]*\\}\\s+from\\s+['"][^'"]*${sourceBasename}['"]`,
      ),
    ];

    if (importPatterns.some((p) => p.test(content))) {
      importers.push(relPath);
    }
  }

  return importers;
}

// ============================================================================
// PLAN UTILITIES
// ============================================================================

/**
 * Filter plan to only include safe actions
 */
export function filterSafeTypeMigrations(plan: TypeMigrationPlan): TypeMigrationPlan {
  const safeActions = plan.actions.filter((a) => a.risk === 'safe');
  const affectedSourceFiles = new Set(safeActions.map((a) => a.sourceFile));

  // Only include import updates for safe actions
  const safeImportUpdates = plan.importUpdates.filter((u) => affectedSourceFiles.has(u.oldSource));

  return {
    actions: safeActions,
    importUpdates: safeImportUpdates,
    stats: {
      typesToRemove: safeActions.length,
      importsToUpdate: safeImportUpdates.length,
      filesAffected: new Set([
        ...safeActions.map((a) => a.sourceFile),
        ...safeImportUpdates.map((u) => u.file),
      ]).size,
    },
    riskSummary: {
      safe: safeActions.length,
      medium: 0,
      risky: 0,
    },
  };
}

/**
 * Preview plan as string for dry-run output
 */
export function previewTypeMigrationPlan(plan: TypeMigrationPlan): string {
  const lines: string[] = [];

  lines.push('Type Migration Plan');
  lines.push('===================');
  lines.push('');

  if (plan.actions.length === 0) {
    lines.push('No type migrations to apply.');
    return lines.join('\n');
  }

  lines.push(`Types to remove: ${plan.stats.typesToRemove}`);
  lines.push(`Imports to update: ${plan.stats.importsToUpdate}`);
  lines.push(`Files affected: ${plan.stats.filesAffected}`);
  lines.push('');

  lines.push('Risk Summary:');
  lines.push(`  Safe: ${plan.riskSummary.safe}`);
  lines.push(`  Medium: ${plan.riskSummary.medium}`);
  lines.push(`  Risky: ${plan.riskSummary.risky}`);
  lines.push('');

  lines.push('Actions:');
  for (const action of plan.actions) {
    const risk = action.risk === 'safe' ? '✅' : action.risk === 'medium' ? '⚠️' : '🔴';
    lines.push(`  ${risk} Remove ${action.typeName} from ${action.sourceFile}`);
    lines.push(`     → Canonical: ${action.targetFile}`);
    if (action.originalName) {
      lines.push(`     → Will rename to: ${action.typeName}`);
    }
  }

  if (plan.importUpdates.length > 0) {
    lines.push('');
    lines.push('Import Updates:');
    for (const update of plan.importUpdates.slice(0, 10)) {
      lines.push(`  ${update.file}: ${update.typeName}`);
      lines.push(`     ${update.oldSource} → ${update.newSource}`);
    }
    if (plan.importUpdates.length > 10) {
      lines.push(`  ... and ${plan.importUpdates.length - 10} more`);
    }
  }

  return lines.join('\n');
}
