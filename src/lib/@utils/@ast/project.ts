/**
 * @module lib/ast/project
 * @description ts-morph Project and SourceFile utilities
 *
 * Centralized project creation for consistent configuration across all commands.
 * This is the SINGLE source of truth for ts-morph Project creation.
 */

import { Project, type SourceFile, ScriptKind } from 'ts-morph';

// ============================================================================
// TYPES
// ============================================================================

export interface CreateProjectOptions {
  /** Path to tsconfig.json (optional, uses in-memory if not provided) */
  tsConfigPath?: string;
  /** Use in-memory file system (default: true, faster for analysis) */
  inMemory?: boolean;
  /** Allow JavaScript files (default: true) */
  allowJs?: boolean;
}

export interface ParseFileOptions {
  /** Script kind (auto-detected from extension if not provided) */
  scriptKind?: ScriptKind;
  /** Overwrite existing file in project */
  overwrite?: boolean;
}

// ============================================================================
// PROJECT CREATION
// ============================================================================

/**
 * Create a ts-morph project for code analysis
 *
 * This is the ONLY place where Project should be instantiated.
 * All other modules should import this function.
 *
 * @example
 * // Fast in-memory project (default)
 * const project = createProject();
 *
 * // With tsconfig for type-aware analysis
 * const project = createProject({ tsConfigPath: './tsconfig.json' });
 */
export function createProject(options: CreateProjectOptions = {}): Project {
  const { tsConfigPath, inMemory = true, allowJs = true } = options;

  const projectOptions = {
    skipAddingFilesFromTsConfig: true,
    useInMemoryFileSystem: inMemory && !tsConfigPath,
    compilerOptions: {
      allowJs,
      checkJs: false,
      noEmit: true,
      skipLibCheck: true,
      // Enable strict mode for better type inference
      strict: false,
      // Don't fail on missing types
      noImplicitAny: false,
    },
  };

  // Only add tsConfigFilePath if provided (exactOptionalPropertyTypes)
  if (tsConfigPath) {
    return new Project({
      ...projectOptions,
      tsConfigFilePath: tsConfigPath,
    });
  }

  return new Project(projectOptions);
}

// ============================================================================
// SOURCE FILE CREATION
// ============================================================================

/**
 * Create a source file from code string
 *
 * @param project - ts-morph Project instance
 * @param filePath - Virtual file path (used for extension detection)
 * @param content - Source code content
 * @param options - Parse options
 */
export function createSourceFile(
  project: Project,
  filePath: string,
  content: string,
  options: ParseFileOptions = {},
): SourceFile {
  const { scriptKind, overwrite = true } = options;

  const createOptions: { overwrite: boolean; scriptKind?: ScriptKind } = {
    overwrite,
  };

  if (scriptKind !== undefined) {
    createOptions.scriptKind = scriptKind;
  }

  return project.createSourceFile(filePath, content, createOptions);
}

/**
 * Parse code string into a SourceFile (convenience function)
 *
 * Creates a temporary project and parses the code.
 * Use this for one-off parsing where you don't need the project.
 *
 * @example
 * const sourceFile = parseCode('const x = 1;');
 * const vars = sourceFile.getVariableDeclarations();
 */
export function parseCode(
  code: string,
  filePath: string = 'temp.ts',
): SourceFile {
  const project = createProject();
  return createSourceFile(project, filePath, code);
}

/**
 * Detect script kind from file extension
 */
export function getScriptKind(filePath: string): ScriptKind {
  const ext = filePath.split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'ts':
      return ScriptKind.TS;
    case 'tsx':
      return ScriptKind.TSX;
    case 'js':
      return ScriptKind.JS;
    case 'jsx':
      return ScriptKind.JSX;
    case 'json':
      return ScriptKind.JSON;
    default:
      return ScriptKind.TS;
  }
}

// ============================================================================
// PROJECT UTILITIES
// ============================================================================

/**
 * Add multiple files to a project
 *
 * @param project - ts-morph Project instance
 * @param files - Map of filePath to content
 */
export function addFiles(
  project: Project,
  files: Record<string, string>,
): SourceFile[] {
  return Object.entries(files).map(([filePath, content]) =>
    createSourceFile(project, filePath, content),
  );
}

/**
 * Get all source files from project
 */
export function getSourceFiles(project: Project): SourceFile[] {
  return project.getSourceFiles();
}
