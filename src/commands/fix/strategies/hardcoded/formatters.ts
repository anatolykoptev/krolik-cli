/**
 * @module commands/fix/strategies/hardcoded/formatters
 * @description Code formatting utilities
 */

import * as prettier from 'prettier';
import type { FixOperation } from '../../types';

// ============================================================================
// PRETTIER FORMATTING
// ============================================================================

/**
 * Format code with Prettier using project config or sensible defaults
 * Falls back to original code if formatting fails
 */
export async function formatWithPrettier(code: string, filepath: string): Promise<string> {
  try {
    const config = await prettier.resolveConfig(filepath);
    return await prettier.format(code, {
      ...config,
      filepath, // Let prettier infer parser from extension
    });
  } catch {
    return code;
  }
}

// ============================================================================
// FIX OPERATION HELPERS
// ============================================================================

/**
 * Create a replace-range FixOperation for full file replacement
 */
export function createReplaceOperation(
  file: string,
  oldCode: string,
  newCode: string,
): FixOperation {
  return {
    action: 'replace-range',
    file,
    line: 1,
    endLine: oldCode.split('\n').length,
    oldCode,
    newCode,
  };
}
