/**
 * @module commands/refactor/migration/type-execution
 * @description Type migration execution
 *
 * Executes type migration: remove types from files, update imports.
 * Uses ts-morph for precise AST manipulation.
 */

import * as path from 'path';
import { Project, SyntaxKind, SourceFile } from 'ts-morph';
import type {
  TypeMigrationAction,
  TypeMigrationPlan,
  ImportUpdateAction,
  TypeMigrationResult,
  TypeMigrationExecutionResult,
  TypeMigrationExecutionOptions,
} from '../core/types-migration';
import { createBackup } from './security';
import { exists } from '../../../lib';

// ============================================================================
// PLAN EXECUTION
// ============================================================================

/**
 * Execute full type migration plan
 */
export async function executeTypeMigrationPlan(
  plan: TypeMigrationPlan,
  projectRoot: string,
  options: TypeMigrationExecutionOptions = {},
): Promise<TypeMigrationExecutionResult> {
  const { dryRun = false, backup = true, stopOnError = false, verbose = false } = options;
  const results: TypeMigrationResult[] = [];

  if (plan.actions.length === 0) {
    return {
      success: true,
      results: [],
      summary: { succeeded: 0, failed: 0, skipped: 0 },
    };
  }

  // Create ts-morph project
  const project = new Project({
    tsConfigFilePath: path.join(projectRoot, 'tsconfig.json'),
    skipAddingFilesFromTsConfig: true,
  });

  // Add all affected files to project
  const affectedFiles = new Set<string>();
  for (const action of plan.actions) {
    affectedFiles.add(path.join(projectRoot, action.sourceFile));
  }
  for (const update of plan.importUpdates) {
    affectedFiles.add(path.join(projectRoot, update.file));
  }

  for (const file of affectedFiles) {
    if (exists(file)) {
      project.addSourceFileAtPath(file);
    }
  }

  // Execute type removal actions
  for (const action of plan.actions) {
    if (verbose) {
      console.log(`Processing: ${action.typeName} in ${action.sourceFile}`);
    }

    const result = await executeTypeRemoval(action, project, projectRoot, {
      dryRun,
      backup,
    });
    results.push(result);

    if (!result.success && stopOnError) {
      break;
    }
  }

  // Execute import updates
  for (const update of plan.importUpdates) {
    if (verbose) {
      console.log(`Updating import: ${update.typeName} in ${update.file}`);
    }

    const result = await executeImportUpdate(update, project, projectRoot, { dryRun });
    results.push(result);

    if (!result.success && stopOnError) {
      break;
    }
  }

  // Save all modified files
  if (!dryRun) {
    await project.save();
  }

  const summary = {
    succeeded: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    skipped: 0,
  };

  return {
    success: summary.failed === 0,
    results,
    summary,
  };
}

// ============================================================================
// TYPE REMOVAL
// ============================================================================

/**
 * Remove a type/interface from a source file
 */
async function executeTypeRemoval(
  action: TypeMigrationAction,
  project: Project,
  projectRoot: string,
  options: { dryRun?: boolean; backup?: boolean },
): Promise<TypeMigrationResult> {
  const { dryRun = false, backup = true } = options;
  const fullPath = path.join(projectRoot, action.sourceFile);

  if (dryRun) {
    return {
      success: true,
      action,
      message: `Would remove ${action.typeName} from ${action.sourceFile}`,
    };
  }

  try {
    // Create backup
    if (backup) {
      createBackup(fullPath);
    }

    const sourceFile = project.getSourceFile(fullPath);
    if (!sourceFile) {
      return {
        success: false,
        action,
        message: `Source file not found: ${action.sourceFile}`,
        error: 'File not found in project',
      };
    }

    // Check if type is used locally in this file
    const localUsages = findLocalTypeUsages(sourceFile, action.typeName);

    // If type is used locally, add import from target before removing
    if (localUsages.length > 0) {
      addImportForType(sourceFile, action.typeName, action.targetFile, action.sourceFile);
    }

    // Remove the type
    const removed = removeTypeDeclaration(sourceFile, action.typeName);

    if (!removed) {
      return {
        success: false,
        action,
        message: `Type ${action.typeName} not found in ${action.sourceFile}`,
        error: 'Type declaration not found',
      };
    }

    return {
      success: true,
      action,
      message: `Removed ${action.typeName} from ${action.sourceFile}`,
      modifiedFiles: [action.sourceFile],
    };
  } catch (error) {
    return {
      success: false,
      action,
      message: `Failed to remove ${action.typeName} from ${action.sourceFile}`,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Find usages of a type within the same file (excluding the declaration itself)
 */
function findLocalTypeUsages(sourceFile: SourceFile, typeName: string): number[] {
  const usages: number[] = [];

  // Find all type references
  sourceFile.forEachDescendant((node) => {
    if (node.getKind() === SyntaxKind.TypeReference) {
      const text = node.getText();
      // Check if this references our type (but not in the declaration)
      if (text === typeName || text.startsWith(`${typeName}<`)) {
        const line = node.getStartLineNumber();
        // Check if this is not the declaration itself
        const parent = node.getParent();
        if (parent?.getKind() !== SyntaxKind.InterfaceDeclaration &&
            parent?.getKind() !== SyntaxKind.TypeAliasDeclaration) {
          usages.push(line);
        }
      }
    }
  });

  return usages;
}

/**
 * Add import for a type from another file
 */
function addImportForType(
  sourceFile: SourceFile,
  typeName: string,
  targetFile: string,
  currentFile: string,
): void {
  // Calculate relative path
  const currentDir = path.dirname(currentFile);
  let relativePath = path.relative(currentDir, targetFile);

  // Normalize path
  if (!relativePath.startsWith('.')) {
    relativePath = './' + relativePath;
  }
  relativePath = relativePath.replace(/\.ts$/, '');

  // Check if import already exists
  const existingImport = sourceFile.getImportDeclaration((imp) => {
    const moduleSpec = imp.getModuleSpecifierValue();
    return moduleSpec.includes(path.basename(targetFile, '.ts'));
  });

  if (existingImport) {
    // Add type to existing import
    const namedImports = existingImport.getNamedImports();
    const hasType = namedImports.some(ni => ni.getName() === typeName);
    if (!hasType) {
      existingImport.addNamedImport(typeName);
    }
  } else {
    // Add new import at the top
    sourceFile.addImportDeclaration({
      moduleSpecifier: relativePath,
      namedImports: [{ name: typeName }],
    });
  }
}

/**
 * Remove type or interface declaration from file
 */
function removeTypeDeclaration(sourceFile: SourceFile, typeName: string): boolean {
  // Try to find and remove interface
  const iface = sourceFile.getInterface(typeName);
  if (iface) {
    iface.remove();
    return true;
  }

  // Try to find and remove type alias
  const typeAlias = sourceFile.getTypeAlias(typeName);
  if (typeAlias) {
    typeAlias.remove();
    return true;
  }

  return false;
}

// ============================================================================
// IMPORT UPDATES
// ============================================================================

/**
 * Update import in a file to use new source
 */
async function executeImportUpdate(
  update: ImportUpdateAction,
  project: Project,
  projectRoot: string,
  options: { dryRun?: boolean },
): Promise<TypeMigrationResult> {
  const { dryRun = false } = options;
  const fullPath = path.join(projectRoot, update.file);

  if (dryRun) {
    return {
      success: true,
      action: update,
      message: `Would update import of ${update.typeName} in ${update.file}`,
    };
  }

  try {
    const sourceFile = project.getSourceFile(fullPath);
    if (!sourceFile) {
      return {
        success: false,
        action: update,
        message: `File not found: ${update.file}`,
        error: 'File not found in project',
      };
    }

    // Find the import that needs updating
    const oldBasename = path.basename(update.oldSource, '.ts');
    let updated = false;

    sourceFile.getImportDeclarations().forEach((imp) => {
      const moduleSpec = imp.getModuleSpecifierValue();
      if (moduleSpec.includes(oldBasename)) {
        // Check if this import includes our type
        const namedImports = imp.getNamedImports();
        const typeImport = namedImports.find(ni => ni.getName() === update.typeName);

        if (typeImport) {
          // Remove type from this import
          typeImport.remove();

          // If import is now empty, remove it entirely
          if (imp.getNamedImports().length === 0) {
            imp.remove();
          }

          // Add import from new source
          const newRelativePath = calculateRelativePath(update.file, update.newSource);
          sourceFile.addImportDeclaration({
            moduleSpecifier: newRelativePath,
            namedImports: [{ name: update.typeName }],
          });

          updated = true;
        }
      }
    });

    if (!updated) {
      return {
        success: false,
        action: update,
        message: `Import of ${update.typeName} not found in ${update.file}`,
        error: 'Import not found',
      };
    }

    return {
      success: true,
      action: update,
      message: `Updated import of ${update.typeName} in ${update.file}`,
      modifiedFiles: [update.file],
    };
  } catch (error) {
    return {
      success: false,
      action: update,
      message: `Failed to update import in ${update.file}`,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Calculate relative import path between two files
 */
function calculateRelativePath(fromFile: string, toFile: string): string {
  const fromDir = path.dirname(fromFile);
  let relativePath = path.relative(fromDir, toFile);

  // Normalize: use forward slashes
  relativePath = relativePath.replace(/\\/g, '/');

  // Ensure starts with ./
  if (!relativePath.startsWith('.')) {
    relativePath = './' + relativePath;
  }

  // Remove .ts extension
  relativePath = relativePath.replace(/\.ts$/, '');

  return relativePath;
}
