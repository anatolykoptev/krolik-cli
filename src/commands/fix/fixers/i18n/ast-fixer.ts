/**
 * @module commands/fix/fixers/i18n/ast-fixer
 * @description AST-based i18n fixer using ts-morph transformer
 *
 * Provides accurate context detection for i18n string replacement
 * using TypeScript's AST. Integrates with the krolik fix command system.
 *
 * @example
 * ```typescript
 * import { fixWithAST } from './ast-fixer';
 *
 * const result = await fixWithAST(filePath, content, {
 *   catalog,
 *   projectRoot: '/path/to/project',
 *   dryRun: true,
 * });
 * ```
 */

import {
  type ReplacementResult,
  type TransformOptions,
  transformFile,
} from '../../../../lib/@i18n/ast-transformer';
import type { LocaleCatalog } from '../../../../lib/@i18n/catalog';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Result of AST-based i18n fix
 */
export interface ASTFixResult {
  /** Modified file content (empty if dryRun or no changes) */
  content: string;
  /** Number of strings transformed */
  transformedCount: number;
  /** Details of each replacement */
  replacements: Array<{
    originalText: string;
    key: string;
    line: number;
    isNew: boolean;
  }>;
  /** Error message if transformation failed */
  error?: string;
}

/**
 * Options for AST-based fixing
 */
export interface ASTFixOptions {
  /** Locale catalog for key resolution */
  catalog: LocaleCatalog;
  /** Project root for namespace detection */
  projectRoot: string;
  /** Dry run - don't modify files */
  dryRun?: boolean;
  /** Import path for t function (default: '@piternow/shared') */
  tImportPath?: string;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Fix i18n issues in a file using AST transformation
 *
 * Uses ts-morph for accurate context detection:
 * - JSX attributes: prop="text" -> prop={t('key')}
 * - JSX text: >text< -> >{t('key')}<
 * - Object properties: { key: "text" } -> { key: t('key') }
 * - Function arguments: fn("text") -> fn(t('key'))
 *
 * @param filePath - Absolute path to the file
 * @param content - Current file content (used for validation, not transformation)
 * @param options - Fix options
 * @returns Fix result with transformed content and stats
 */
export async function fixWithAST(
  filePath: string,
  _content: string, // Content param kept for interface compatibility, AST reads from disk
  options: ASTFixOptions,
): Promise<ASTFixResult> {
  const { catalog, projectRoot, dryRun = false, tImportPath = '@piternow/shared' } = options;

  const result: ASTFixResult = {
    content: '',
    transformedCount: 0,
    replacements: [],
  };

  try {
    // Build transform options
    const transformOptions: TransformOptions = {
      catalog,
      projectRoot,
      tImportPath,
      dryRun,
    };

    // Run AST transformation
    const transformResult = await transformFile(filePath, transformOptions);

    // Handle errors
    if (transformResult.error) {
      result.error = transformResult.error;
      return result;
    }

    // Map replacements to simpler format
    result.replacements = transformResult.replacements.map((r: ReplacementResult) => ({
      originalText: r.originalText,
      key: r.key,
      line: r.line,
      isNew: r.isNew,
    }));

    result.transformedCount = transformResult.transformedCount;

    // If modified and not dry run, read the updated content
    if (transformResult.modified && !dryRun) {
      const fs = await import('node:fs/promises');
      result.content = await fs.readFile(filePath, 'utf-8');
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  }

  return result;
}

/**
 * Analyze a file for i18n issues without modifying it
 *
 * @param filePath - Absolute path to the file
 * @param options - Analysis options (dryRun is forced to true)
 * @returns Analysis result with found strings
 */
export async function analyzeWithAST(
  filePath: string,
  options: Omit<ASTFixOptions, 'dryRun'>,
): Promise<ASTFixResult> {
  // Import dynamically to avoid circular dependencies
  const { analyzeFile } = await import('../../../../lib/@i18n/ast-transformer');

  const result: ASTFixResult = {
    content: '',
    transformedCount: 0,
    replacements: [],
  };

  try {
    const analysisResult = await analyzeFile(filePath, {
      catalog: options.catalog,
      projectRoot: options.projectRoot,
      tImportPath: options.tImportPath ?? '@piternow/shared',
    });

    if (analysisResult.error) {
      result.error = analysisResult.error;
      return result;
    }

    result.replacements = analysisResult.replacements.map((r: ReplacementResult) => ({
      originalText: r.originalText,
      key: r.key,
      line: r.line,
      isNew: r.isNew,
    }));

    result.transformedCount = analysisResult.transformedCount;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  }

  return result;
}
