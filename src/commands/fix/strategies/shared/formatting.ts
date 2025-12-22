/**
 * @module commands/fix/strategies/shared/formatting
 * @description Code formatting and validation utilities
 */

import * as prettier from 'prettier';
import { Project, DiagnosticCategory } from 'ts-morph';

// ============================================================================
// PROJECT CREATION
// ============================================================================

/**
 * Create a ts-morph project for code analysis
 * Uses in-memory file system for performance
 */
export function createProject(): Project {
  return new Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
      allowJs: true,
      checkJs: false,
      noEmit: true,
      skipLibCheck: true,
    },
  });
}

// ============================================================================
// SYNTAX VALIDATION
// ============================================================================

/**
 * Validate TypeScript/JavaScript syntax
 * Returns true if code has no syntax errors
 */
export function validateSyntax(code: string, filepath: string): boolean {
  try {
    const project = createProject();
    const sourceFile = project.createSourceFile(filepath, code, {
      overwrite: true,
    });

    const diagnostics = sourceFile.getPreEmitDiagnostics();
    const syntaxErrors = diagnostics.filter(
      (d) => d.getCategory() === DiagnosticCategory.Error,
    );

    return syntaxErrors.length === 0;
  } catch {
    return false;
  }
}

/**
 * Get syntax errors from code
 * Returns empty array if no errors
 */
export function getSyntaxErrors(
  code: string,
  filepath: string,
): Array<{ line: number; message: string }> {
  try {
    const project = createProject();
    const sourceFile = project.createSourceFile(filepath, code, {
      overwrite: true,
    });

    const diagnostics = sourceFile.getPreEmitDiagnostics();
    const errors = diagnostics.filter(
      (d) => d.getCategory() === DiagnosticCategory.Error,
    );

    return errors.map((error) => ({
      line: error.getLineNumber() ?? 0,
      message: error.getMessageText().toString(),
    }));
  } catch (error) {
    return [
      {
        line: 0,
        message: error instanceof Error ? error.message : 'Parse error',
      },
    ];
  }
}

// ============================================================================
// PRETTIER FORMATTING
// ============================================================================

/**
 * Format code with Prettier using project config
 * Falls back to original code if formatting fails
 */
export async function formatWithPrettier(
  code: string,
  filepath: string,
): Promise<string> {
  try {
    const config = await prettier.resolveConfig(filepath);
    return await prettier.format(code, {
      ...config,
      filepath,
    });
  } catch {
    return code;
  }
}

/**
 * Format code with Prettier, returning null on failure
 * Use when you need to know if formatting succeeded
 */
export async function tryFormatWithPrettier(
  code: string,
  filepath: string,
): Promise<string | null> {
  try {
    const config = await prettier.resolveConfig(filepath);
    return await prettier.format(code, {
      ...config,
      filepath,
    });
  } catch {
    return null;
  }
}

// ============================================================================
// COMBINED VALIDATION & FORMATTING
// ============================================================================

/**
 * Validate syntax and format code with Prettier
 * Returns null if code has syntax errors
 *
 * @example
 * const result = await validateAndFormat(code, 'src/file.ts');
 * if (result === null) {
 *   // Syntax error - don't apply fix
 * }
 */
export async function validateAndFormat(
  code: string,
  filepath: string,
): Promise<string | null> {
  // First validate syntax
  if (!validateSyntax(code, filepath)) {
    return null;
  }

  // Then format with Prettier
  return formatWithPrettier(code, filepath);
}

/**
 * Validate syntax and format, with detailed error info
 */
export async function validateAndFormatWithErrors(
  code: string,
  filepath: string,
): Promise<
  | { success: true; formatted: string }
  | { success: false; errors: Array<{ line: number; message: string }> }
> {
  const errors = getSyntaxErrors(code, filepath);

  if (errors.length > 0) {
    return { success: false, errors };
  }

  const formatted = await formatWithPrettier(code, filepath);
  return { success: true, formatted };
}
