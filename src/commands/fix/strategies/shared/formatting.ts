/**
 * @module commands/fix/strategies/shared/formatting
 * @description Code formatting and validation utilities
 *
 * NOTE: createProject is re-exported from lib/ast for backwards compatibility.
 * New code should import directly from '@/lib/@ast'.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as prettier from 'prettier';
import {
  type CallExpression,
  type Diagnostic,
  DiagnosticCategory,
  type Statement,
  SyntaxKind,
} from 'ts-morph';
import { type CreateProjectOptions, createProject } from '@/lib';

// Re-export for backwards compatibility
export { createProject, type CreateProjectOptions };

// ============================================================================
// PRETTIER CONFIG CACHING
// ============================================================================

/**
 * Cache Prettier config by project root to avoid repeated filesystem walks
 */
const configCache = new Map<string, prettier.Options | null>();

/**
 * Find project root (directory with package.json)
 */
function findProjectRoot(filepath: string): string {
  let dir = path.dirname(filepath);
  const MAX_DEPTH = 10;

  for (let i = 0; i < MAX_DEPTH; i++) {
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return path.dirname(filepath);
}

/**
 * Get Prettier config with caching
 */
async function getPrettierConfig(filepath: string): Promise<prettier.Options | null> {
  const projectRoot = findProjectRoot(filepath);

  if (configCache.has(projectRoot)) {
    return configCache.get(projectRoot)!;
  }

  const config = await prettier.resolveConfig(filepath);
  configCache.set(projectRoot, config);
  return config;
}

/**
 * Clear Prettier config cache (call at end of session)
 */
export function clearPrettierCache(): void {
  configCache.clear();
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
    const { astPool } = require('../../core/ast-pool');
    const [sourceFile, cleanup] = astPool.createSourceFile(code, filepath);

    try {
      const diagnostics = sourceFile.getPreEmitDiagnostics();
      const syntaxErrors = diagnostics.filter(
        (d: Diagnostic) => d.getCategory() === DiagnosticCategory.Error,
      );

      return syntaxErrors.length === 0;
    } finally {
      cleanup();
    }
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
    const { astPool } = require('../../core/ast-pool');
    const [sourceFile, cleanup] = astPool.createSourceFile(code, filepath);

    try {
      const diagnostics = sourceFile.getPreEmitDiagnostics();
      const errors = diagnostics.filter(
        (d: Diagnostic) => d.getCategory() === DiagnosticCategory.Error,
      );

      return errors.map((error: Diagnostic) => ({
        line: error.getLineNumber() ?? 0,
        message: error.getMessageText().toString(),
      }));
    } finally {
      cleanup();
    }
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
// AST CHECKS
// ============================================================================

/**
 * Check if a line contains an actual debugger statement (not in string/regex)
 *
 * Uses AST to find DebuggerStatement nodes, which excludes:
 * - 'debugger' inside strings
 * - 'debugger' inside regex patterns
 * - 'debugger' in comments
 *
 * @param content - Full file content
 * @param lineNumber - 1-based line number to check
 */
export function hasDebuggerStatementAtLine(content: string, lineNumber: number): boolean {
  try {
    const { astPool } = require('../../core/ast-pool');
    const [sourceFile, cleanup] = astPool.createSourceFile(content, 'temp.ts');

    try {
      const debuggerStatements = sourceFile.getDescendantsOfKind(SyntaxKind.DebuggerStatement);

      return debuggerStatements.some((stmt: Statement) => stmt.getStartLineNumber() === lineNumber);
    } finally {
      cleanup();
    }
  } catch {
    // Parse error - assume no debugger (safe fallback)
    return false;
  }
}

/**
 * Check if a line contains an actual console call (not in string/regex)
 *
 * Uses AST to find CallExpression nodes where callee is console.*
 *
 * @param content - Full file content
 * @param lineNumber - 1-based line number to check
 */
export function hasConsoleCallAtLine(content: string, lineNumber: number): boolean {
  try {
    const { astPool } = require('../../core/ast-pool');
    const [sourceFile, cleanup] = astPool.createSourceFile(content, 'temp.ts');

    try {
      const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);

      return callExpressions.some((call: CallExpression) => {
        if (call.getStartLineNumber() !== lineNumber) return false;

        const expr = call.getExpression();
        const text = expr.getText();

        return text.startsWith('console.');
      });
    } finally {
      cleanup();
    }
  } catch {
    return false;
  }
}

/**
 * Check if a line contains an actual alert call (not in string/regex)
 */
export function hasAlertCallAtLine(content: string, lineNumber: number): boolean {
  try {
    const { astPool } = require('../../core/ast-pool');
    const [sourceFile, cleanup] = astPool.createSourceFile(content, 'temp.ts');

    try {
      const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);

      return callExpressions.some((call: CallExpression) => {
        if (call.getStartLineNumber() !== lineNumber) return false;

        const expr = call.getExpression();
        return expr.getText() === 'alert';
      });
    } finally {
      cleanup();
    }
  } catch {
    return false;
  }
}

// ============================================================================
// PRETTIER FORMATTING
// ============================================================================

/**
 * Format code with Prettier using cached project config
 * Falls back to original code if formatting fails
 */
export async function formatWithPrettier(code: string, filepath: string): Promise<string> {
  try {
    const config = await getPrettierConfig(filepath);
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
    const config = await getPrettierConfig(filepath);
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
export async function validateAndFormat(code: string, filepath: string): Promise<string | null> {
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
