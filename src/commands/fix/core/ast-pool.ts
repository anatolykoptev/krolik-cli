/**
 * @module commands/fix/core/ast-pool
 * @description Pooled AST project for efficient reuse and memory leak prevention
 *
 * CRITICAL: ts-morph Project instances must be properly disposed to prevent memory leaks.
 * This pool provides a shared Project instance that can be cleared and reused across operations.
 *
 * Usage:
 * ```typescript
 * import { astPool } from '../core/ast-pool';
 *
 * // Use pooled source file
 * const [sourceFile, cleanup] = astPool.createSourceFile(content, 'temp.ts');
 * try {
 *   // ... analyze sourceFile
 * } finally {
 *   cleanup(); // Always cleanup
 * }
 *
 * // Or use project directly
 * const project = astPool.getProject();
 * // ... but remember to call astPool.clear() when done
 * ```
 */

import { Project, type SourceFile } from 'ts-morph';

/**
 * Pooled AST project for efficient reuse
 * Avoids memory leaks from creating many Project instances
 */
class ASTPool {
  private project: Project | null = null;

  /**
   * Get or create the shared project
   * Uses in-memory file system for fast operations
   */
  getProject(): Project {
    if (!this.project) {
      this.project = new Project({
        useInMemoryFileSystem: true,
        skipFileDependencyResolution: true,
        skipAddingFilesFromTsConfig: true,
        compilerOptions: {
          target: 99, // ESNext
          module: 99, // ESNext
          strict: false,
          skipLibCheck: true,
          allowJs: true,
          checkJs: false,
          noEmit: true,
          noImplicitAny: false,
        },
      });
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
  createSourceFile(content: string, _filename = 'temp.ts'): [SourceFile, () => void] {
    const project = this.getProject();

    // Generate unique filename to avoid collisions
    const tempName = `temp_${Date.now()}_${Math.random().toString(36).slice(2)}.ts`;
    const sourceFile = project.createSourceFile(tempName, content, { overwrite: true });

    const cleanup = () => {
      try {
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
      } catch {
        // If clearing fails, recreate project
        this.project = null;
      }
    }
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
}

/**
 * Shared AST pool instance
 * Import and use this across all fixers and strategies
 */
export const astPool = new ASTPool();

/**
 * Helper: Create temporary source file with auto-cleanup
 * Wraps astPool.createSourceFile for convenience
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
