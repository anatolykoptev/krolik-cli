/**
 * @module lib/ast/pool
 * @description Pooled AST Project for efficient reuse and memory leak prevention
 *
 * CRITICAL: ts-morph Project instances must be properly disposed to prevent memory leaks.
 * This pool provides a shared Project instance that can be cleared and reused across operations.
 *
 * This is the RECOMMENDED way to work with ts-morph in krolik CLI.
 *
 * Usage:
 * ```typescript
 * import { withSourceFile, getProject, releaseProject } from '@/lib/@ast';
 *
 * // Recommended: Auto-cleanup with callback
 * const result = withSourceFile(content, 'temp.ts', (sourceFile) => {
 *   return sourceFile.getFunctions().length;
 * });
 *
 * // Advanced: Manual project management
 * const project = getProject();
 * try {
 *   // ... use project
 * } finally {
 *   releaseProject(project);
 * }
 * ```
 */

import { Project, type ProjectOptions, type SourceFile } from 'ts-morph';

// ============================================================================
// TYPES
// ============================================================================

export interface PoolOptions {
  /** Use in-memory file system (default: true) */
  inMemory?: boolean;
  /** Path to tsconfig.json (optional) */
  tsConfigPath?: string;
  /** Allow JavaScript files (default: true) */
  allowJs?: boolean;
}

// ============================================================================
// AST POOL
// ============================================================================

/**
 * Pooled AST project for efficient reuse
 * Avoids memory leaks from creating many Project instances
 */
class ASTPool {
  private project: Project | null = null;
  private activeFiles = new Set<string>();
  private fileCounter = 0;

  /**
   * Get or create the shared project
   * Uses in-memory file system for fast operations
   */
  getProject(options: PoolOptions = {}): Project {
    if (!this.project) {
      const { inMemory = true, tsConfigPath, allowJs = true } = options;

      const projectOptions: ProjectOptions = {
        useInMemoryFileSystem: inMemory && !tsConfigPath,
        skipFileDependencyResolution: true,
        skipAddingFilesFromTsConfig: true,
        compilerOptions: {
          target: 99, // ESNext
          module: 99, // ESNext
          strict: false,
          skipLibCheck: true,
          allowJs,
          checkJs: false,
          noEmit: true,
          noImplicitAny: false,
        },
      };

      // Add tsConfigFilePath if provided (exactOptionalPropertyTypes)
      if (tsConfigPath) {
        this.project = new Project({
          ...projectOptions,
          tsConfigFilePath: tsConfigPath,
        });
      } else {
        this.project = new Project(projectOptions);
      }
    }
    return this.project;
  }

  /**
   * Create a temporary source file for analysis
   * Returns a cleanup function that MUST be called to prevent memory leaks
   *
   * @example
   * const [sourceFile, cleanup] = astPool.createSourceFile(content);
   * try {
   *   const complexity = calculateComplexity(sourceFile);
   * } finally {
   *   cleanup(); // Always cleanup
   * }
   *
   * @param content - Source code content
   * @param filename - Virtual filename (for extension detection)
   * @returns Tuple of [SourceFile, cleanup function]
   */
  createSourceFile(content: string, filename = 'temp.ts'): [SourceFile, () => void] {
    const project = this.getProject();

    // Generate unique filename to avoid collisions
    const tempName = `temp_${Date.now()}_${this.fileCounter++}_${Math.random().toString(36).slice(2)}.${
      filename.split('.').pop() || 'ts'
    }`;

    const sourceFile = project.createSourceFile(tempName, content, { overwrite: true });
    this.activeFiles.add(tempName);

    const cleanup = () => {
      try {
        this.activeFiles.delete(tempName);
        project.removeSourceFile(sourceFile);
      } catch {
        // Ignore errors if file already removed
      }
    };

    return [sourceFile, cleanup];
  }

  /**
   * Clear all source files from project (but keep project alive)
   * Call this between operations to free memory
   */
  clear(): void {
    if (this.project) {
      try {
        const sourceFiles = this.project.getSourceFiles();
        for (const sourceFile of sourceFiles) {
          this.project.removeSourceFile(sourceFile);
        }
        this.activeFiles.clear();
      } catch {
        // If clearing fails, recreate project
        this.project = null;
        this.activeFiles.clear();
      }
    }
  }

  /**
   * Release project (cleanup hint, but keep pool alive)
   * This is called automatically by withSourceFile
   */
  release(): void {
    // For now, just clear. In future, could implement ref counting
    this.clear();
  }

  /**
   * Dispose project completely (call at end of session)
   * After calling this, a new project will be created on next getProject()
   */
  dispose(): void {
    this.clear();
    this.project = null;
  }

  /**
   * Get number of source files currently in project (for debugging)
   */
  getSourceFileCount(): number {
    return this.project?.getSourceFiles().length ?? 0;
  }

  /**
   * Get number of active tracked files (for debugging)
   */
  getActiveFileCount(): number {
    return this.activeFiles.size;
  }
}

/**
 * Shared AST pool instance
 * Import and use this across all commands and fixers
 */
export const astPool = new ASTPool();

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Recommended: Create temporary source file with auto-cleanup
 *
 * @example
 * const count = withSourceFile(content, 'temp.ts', (sourceFile) => {
 *   return sourceFile.getFunctions().length;
 * });
 *
 * @param content - Source code content
 * @param filename - Virtual filename (for extension detection)
 * @param fn - Callback that receives the SourceFile
 * @returns Result of the callback
 */
export function withSourceFile<T>(
  content: string,
  filename: string,
  fn: (sourceFile: SourceFile) => T,
): T {
  const [sourceFile, cleanup] = astPool.createSourceFile(content, filename);
  try {
    return fn(sourceFile);
  } finally {
    cleanup();
  }
}

/**
 * Advanced: Get shared Project instance
 * IMPORTANT: Call releaseProject() when done to prevent memory leaks
 *
 * @example
 * const project = getProject();
 * try {
 *   // ... use project
 * } finally {
 *   releaseProject(project);
 * }
 *
 * @param options - Pool options
 * @returns Shared Project instance
 */
export function getProject(options?: PoolOptions): Project {
  return astPool.getProject(options);
}

/**
 * Release Project after use
 * This clears all source files from the project
 *
 * @param _project - Project instance (for API compatibility, currently ignored)
 */
export function releaseProject(_project: Project): void {
  astPool.release();
}

/**
 * Dispose the entire pool (call at end of session)
 * After this, a new project will be created on next getProject()
 */
export function disposePool(): void {
  astPool.dispose();
}
