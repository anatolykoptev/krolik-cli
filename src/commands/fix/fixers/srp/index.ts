/**
 * @module commands/fix/fixers/srp
 * @description Single Responsibility Principle fixer
 *
 * Detects files with too many exports/functions and suggests splitting.
 */

import type { Fixer, QualityIssue, FixOperation } from '../../core/types';
import { createFixerMetadata } from '../../core/registry';

export const metadata = createFixerMetadata('srp', 'SRP Violations', 'srp', {
  description: 'Split files with too many responsibilities',
  difficulty: 'risky',
  cliFlag: '--fix-srp',
  tags: ['risky', 'refactoring', 'architecture'],
});

const MAX_FUNCTIONS = 10;
const MAX_EXPORTS = 5;
const MAX_FILE_LINES = 400;

interface FileMetrics {
  lines: number;
  functions: number;
  exports: number;
}

function analyzeFileMetrics(content: string): FileMetrics {
  const lines = content.split('\n');

  let functions = 0;
  let exports = 0;

  for (const line of lines) {
    // Count function declarations
    if (/(?:function\s+\w+|(?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?\()/.test(line)) {
      functions++;
    }

    // Count exports
    if (/^export\s+(?:const|let|var|function|class|type|interface|enum)/.test(line.trim())) {
      exports++;
    }
    if (/^export\s*\{/.test(line.trim())) {
      // Count items in export { ... }
      const match = line.match(/export\s*\{([^}]+)\}/);
      if (match) {
        exports += match[1]!.split(',').length;
      }
    }
  }

  return { lines: lines.length, functions, exports };
}

function analyzeSrp(content: string, file: string): QualityIssue[] {
  const issues: QualityIssue[] = [];

  // Skip test, config, and type definition files
  if (
    file.includes('.test.') ||
    file.includes('.spec.') ||
    file.includes('.config.') ||
    file.endsWith('.d.ts') ||
    file.includes('index.ts') // Index files often have many exports
  ) {
    return issues;
  }

  const metrics = analyzeFileMetrics(content);

  // Check file size
  if (metrics.lines > MAX_FILE_LINES) {
    issues.push({
      file,
      line: 1,
      severity: metrics.lines > MAX_FILE_LINES * 1.5 ? 'error' : 'warning',
      category: 'srp',
      message: `File has ${metrics.lines} lines (max: ${MAX_FILE_LINES})`,
      suggestion: 'Split into smaller, focused modules',
      fixerId: 'srp',
    });
  }

  // Check function count
  if (metrics.functions > MAX_FUNCTIONS) {
    issues.push({
      file,
      line: 1,
      severity: metrics.functions > MAX_FUNCTIONS * 1.5 ? 'error' : 'warning',
      category: 'srp',
      message: `File has ${metrics.functions} functions (max: ${MAX_FUNCTIONS})`,
      suggestion: 'Group related functions into separate modules',
      fixerId: 'srp',
    });
  }

  // Check export count
  if (metrics.exports > MAX_EXPORTS) {
    issues.push({
      file,
      line: 1,
      severity: 'warning',
      category: 'srp',
      message: `File has ${metrics.exports} exports (max: ${MAX_EXPORTS})`,
      suggestion: 'Split exports into related modules with barrel file',
      fixerId: 'srp',
    });
  }

  return issues;
}

function fixSrpIssue(_issue: QualityIssue, _content: string): FixOperation | null {
  // SRP fixes require AST-based file splitting which is complex and risky
  // Return null - this would need AI assistance or manual review
  // The splitFile utility exists but requires careful analysis of exports/imports
  return null;
}

export const srpFixer: Fixer = {
  metadata,
  analyze: analyzeSrp,
  fix: fixSrpIssue,
};
