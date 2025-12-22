/**
 * @module commands/quality/analyzers/documentation
 * @description Documentation (JSDoc) checks for exported functions
 */

import type { FunctionInfo, QualityIssue } from '../types';

/**
 * File patterns to skip for documentation checks
 */
const SKIP_PATTERNS = ['.test.', '.spec.', '.config.'];

/**
 * Check for missing JSDoc on exported functions
 */
export function checkDocumentation(
  functions: FunctionInfo[],
  filepath: string,
  requireJSDoc: boolean = true,
): QualityIssue[] {
  const issues: QualityIssue[] = [];

  if (!requireJSDoc) {
    return issues;
  }

  // Skip test files, config files
  for (const pattern of SKIP_PATTERNS) {
    if (filepath.includes(pattern)) {
      return issues;
    }
  }

  for (const fn of functions) {
    if (fn.isExported && !fn.hasJSDoc) {
      issues.push({
        file: filepath,
        line: fn.startLine,
        severity: 'info',
        category: 'documentation',
        message: `Exported function "${fn.name}" lacks JSDoc documentation`,
        suggestion: 'Add /** ... */ comment describing the function purpose and parameters',
      });
    }
  }

  return issues;
}
