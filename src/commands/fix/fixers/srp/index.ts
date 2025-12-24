/**
 * @module commands/fix/fixers/srp
 * @description Single Responsibility Principle fixer using AST
 *
 * Detects files with too many exports/functions and suggests splitting.
 * Uses ts-morph AST for accurate function/export detection.
 */

import {
  type ExportInfo,
  extractExports,
  extractFunctions,
  type FunctionInfo,
  parseCode,
} from '../../../../lib/@ast';
import { createFixerMetadata } from '../../core/registry';
import type { Fixer, FixOperation, QualityIssue } from '../../core/types';

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
  functionNames: string[];
  exportNames: string[];
}

/**
 * Analyze file metrics using AST
 */
function analyzeFileMetrics(content: string, filePath: string): FileMetrics {
  const lines = content.split('\n');

  try {
    const sourceFile = parseCode(content, filePath);
    const functions = extractFunctions(sourceFile);
    const exports = extractExports(sourceFile);

    return {
      lines: lines.length,
      functions: functions.length,
      exports: exports.length,
      functionNames: functions.map((f: FunctionInfo) => f.name),
      exportNames: exports.map((e: ExportInfo) => e.name),
    };
  } catch {
    // Fallback to regex-based analysis
    return analyzeFileMetricsRegex(content);
  }
}

/**
 * Fallback regex-based metrics analysis
 */
function analyzeFileMetricsRegex(content: string): FileMetrics {
  const lines = content.split('\n');
  const functionNames: string[] = [];
  const exportNames: string[] = [];

  for (const line of lines) {
    // Count function declarations
    const funcMatch = line.match(
      /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\()/,
    );
    if (funcMatch) {
      functionNames.push(funcMatch[1] || funcMatch[2] || 'anonymous');
    }

    // Count exports
    const exportMatch = line.match(
      /^export\s+(?:const|let|var|function|class|type|interface|enum)\s+(\w+)/,
    );
    if (exportMatch?.[1]) {
      exportNames.push(exportMatch[1]);
    }
    if (/^export\s*\{/.test(line.trim())) {
      const match = line.match(/export\s*\{([^}]+)\}/);
      if (match) {
        const items = match[1]?.split(',').map((s) =>
          s
            .trim()
            .split(/\s+as\s+/)[0]
            ?.trim(),
        );
        items.forEach((item) => {
          if (item) exportNames.push(item);
        });
      }
    }
  }

  return {
    lines: lines.length,
    functions: functionNames.length,
    exports: exportNames.length,
    functionNames,
    exportNames,
  };
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

  const metrics = analyzeFileMetrics(content, file);

  // Check file size
  if (metrics.lines > MAX_FILE_LINES) {
    issues.push({
      file,
      line: 1,
      severity: metrics.lines > MAX_FILE_LINES * 1.5 ? 'error' : 'warning',
      category: 'srp',
      message: `File has ${metrics.lines} lines (max: ${MAX_FILE_LINES})`,
      suggestion: 'Split into smaller, focused modules',
      snippet: `Functions: ${metrics.functionNames.slice(0, 5).join(', ')}${metrics.functionNames.length > 5 ? '...' : ''}`,
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
      snippet: metrics.functionNames.join(', '),
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
      snippet: metrics.exportNames.join(', '),
      fixerId: 'srp',
    });
  }

  return issues;
}

/**
 * Group functions by common prefix/pattern for splitting suggestions
 */
function groupFunctionsByPrefix(names: string[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();

  for (const name of names) {
    // Extract prefix (get, set, create, update, delete, handle, on, use, etc.)
    const prefixMatch = name.match(
      /^(get|set|create|update|delete|handle|on|use|is|has|can|should|validate|parse|format|render|load|save|fetch|find|build|make|init|reset|clear|add|remove)/i,
    );
    const prefix = prefixMatch ? prefixMatch[1]?.toLowerCase() : 'misc';

    const existing = groups.get(prefix) ?? [];
    existing.push(name);
    groups.set(prefix, existing);
  }

  return groups;
}

/**
 * Generate file split suggestions based on function grouping
 */
function generateSplitSuggestions(metrics: FileMetrics): string[] {
  const suggestions: string[] = [];
  const groups = groupFunctionsByPrefix(metrics.functionNames);

  // Find groups with 2+ functions
  const significantGroups: [string, string[]][] = [];
  for (const [prefix, funcs] of groups.entries()) {
    if (funcs.length >= 2) {
      significantGroups.push([prefix, funcs]);
    }
  }

  if (significantGroups.length >= 2) {
    suggestions.push('Suggested file split:');
    for (const [prefix, funcs] of significantGroups.slice(0, 4)) {
      const filename = prefix === 'misc' ? 'helpers.ts' : `${prefix}ers.ts`;
      suggestions.push(
        `  • ${filename}: ${funcs.slice(0, 3).join(', ')}${funcs.length > 3 ? '...' : ''}`,
      );
    }
  }

  // Suggest index.ts for re-exports
  if (metrics.exports > MAX_EXPORTS) {
    suggestions.push('');
    suggestions.push('Create barrel file (index.ts) to re-export from submodules');
  }

  return suggestions;
}

function fixSrpIssue(issue: QualityIssue, content: string): FixOperation | null {
  if (!issue.file) return null;

  const metrics = analyzeFileMetrics(content, issue.file);
  const suggestions = generateSplitSuggestions(metrics);

  if (suggestions.length === 0) {
    return null;
  }

  // Extract filename for comment
  const fileName = issue.file.split('/').pop() ?? issue.file;

  const todoComment = `/**
 * TODO: Refactor ${fileName} - SRP Violation
 *
 * Current metrics:
 *   - Lines: ${metrics.lines} (max: ${MAX_FILE_LINES})
 *   - Functions: ${metrics.functions} (max: ${MAX_FUNCTIONS})
 *   - Exports: ${metrics.exports} (max: ${MAX_EXPORTS})
 *
 * ${suggestions.join('\n * ')}
 *
 * Steps:
 * 1. Create new files for each logical group
 * 2. Move related functions to their new files
 * 3. Update imports in this file
 * 4. Create index.ts to re-export public API
 */
`;

  return {
    action: 'insert-before',
    file: issue.file,
    line: 1,
    newCode: todoComment,
  };
}

export const srpFixer: Fixer = {
  metadata,
  analyze: analyzeSrp,
  fix: fixSrpIssue,
};
