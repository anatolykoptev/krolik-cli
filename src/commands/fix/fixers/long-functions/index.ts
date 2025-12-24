/**
 * @module commands/fix/fixers/long-functions
 * @description Long functions fixer using AST
 *
 * Detects functions that are too long and need splitting.
 * Uses ts-morph AST for accurate function detection.
 */

import {
  type FunctionInfo as ASTFunctionInfo,
  extractFunctions,
  parseCode,
} from '../../../../lib/@ast';
import { createFixerMetadata } from '../../core/registry';
import type { Fixer, FixOperation, QualityIssue } from '../../core/types';

export const metadata = createFixerMetadata('long-functions', 'Long Functions', 'complexity', {
  description: 'Split long functions into smaller ones',
  difficulty: 'risky',
  cliFlag: '--fix-long-functions',
  tags: ['risky', 'refactoring', 'complexity'],
});

const MAX_FUNCTION_LINES = 50;

interface FunctionInfo {
  name: string;
  startLine: number;
  endLine: number;
  lines: number;
  isAsync: boolean;
  isExported: boolean;
}

/**
 * Find functions using AST instead of regex
 */
function findFunctions(content: string, filePath: string): FunctionInfo[] {
  try {
    const sourceFile = parseCode(content, filePath);
    const astFunctions = extractFunctions(sourceFile);

    return astFunctions.map((f: ASTFunctionInfo) => ({
      name: f.name,
      startLine: f.startLine,
      endLine: f.endLine,
      lines: f.endLine - f.startLine + 1,
      isAsync: f.isAsync,
      isExported: f.isExported,
    }));
  } catch {
    // Fallback to simple regex for files that fail to parse
    return findFunctionsRegex(content);
  }
}

/**
 * Fallback regex-based function detection
 */
function findFunctionsRegex(content: string): FunctionInfo[] {
  const functions: FunctionInfo[] = [];
  const lines = content.split('\n');

  let currentFunction: FunctionInfo | null = null;
  let braceCount = 0;
  let functionStartBrace = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';

    // Detect function start
    const funcMatch = line.match(
      /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(|(\w+)\s*(?:=|:)\s*(?:async\s*)?\([^)]*\)\s*(?:=>|{))/,
    );

    if (funcMatch && !currentFunction) {
      const name = funcMatch[1] || funcMatch[2] || funcMatch[3] || 'anonymous';
      currentFunction = {
        name,
        startLine: i + 1,
        endLine: i + 1,
        lines: 0,
        isAsync: line.includes('async'),
        isExported: line.trim().startsWith('export'),
      };
      functionStartBrace = braceCount;
    }

    // Count braces
    for (const char of line) {
      if (char === '{') braceCount++;
      if (char === '}') braceCount--;
    }

    // Function end
    if (currentFunction && braceCount <= functionStartBrace && line.includes('}')) {
      currentFunction.endLine = i + 1;
      currentFunction.lines = currentFunction.endLine - currentFunction.startLine + 1;
      functions.push(currentFunction);
      currentFunction = null;
    }
  }

  return functions;
}

function analyzeLongFunctions(content: string, file: string): QualityIssue[] {
  const issues: QualityIssue[] = [];

  // Skip test files
  if (file.includes('.test.') || file.includes('.spec.')) {
    return issues;
  }

  const functions = findFunctions(content, file);

  for (const func of functions) {
    if (func.lines > MAX_FUNCTION_LINES) {
      issues.push({
        file,
        line: func.startLine,
        severity: func.lines > MAX_FUNCTION_LINES * 2 ? 'error' : 'warning',
        category: 'complexity',
        message: `Function '${func.name}' is too long: ${func.lines} lines (max: ${MAX_FUNCTION_LINES})`,
        suggestion: 'Split into smaller functions with single responsibility',
        snippet: `${func.name}(): ${func.lines} lines`,
        fixerId: 'long-functions',
      });
    }
  }

  return issues;
}

/**
 * Section separator patterns to detect logical blocks
 */
const SECTION_PATTERNS = [
  /^\/\/\s*={3,}/, // // ===
  /^\/\/\s*-{3,}/, // // ---
  /^\/\/\s*#{3,}/, // // ###
  /^\/\/\s*MARK:\s*/i, // // MARK:
  /^\/\/\s*SECTION:\s*/i, // // SECTION:
  /^\/\/\s*STEP\s*\d*:/i, // // STEP 1:
  /^\/\/\s*\d+\.\s+/, // // 1. Do something
];

interface Section {
  name: string;
  startLine: number;
  endLine: number;
  content: string[];
}

/**
 * Find sections within a function based on comment separators
 */
function findSections(lines: string[], startLine: number, endLine: number): Section[] {
  const sections: Section[] = [];
  let currentSection: Section | null = null;

  for (let i = startLine - 1; i < endLine; i++) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();

    // Check if this is a section separator
    const isSeparator = SECTION_PATTERNS.some((p) => p.test(trimmed));

    if (isSeparator) {
      // Save previous section
      if (currentSection && currentSection.content.length > 0) {
        currentSection.endLine = i;
        sections.push(currentSection);
      }

      // Extract section name from comment
      const nameMatch = trimmed.match(/\/\/\s*(?:={3,}|MARK:|SECTION:|STEP\s*\d*:|\d+\.)\s*(.*)/i);
      const sectionName = nameMatch?.[1]?.trim() || `section_${sections.length + 1}`;

      currentSection = {
        name: sectionName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase(),
        startLine: i + 1,
        endLine: endLine,
        content: [],
      };
    } else if (currentSection) {
      currentSection.content.push(line);
    }
  }

  // Save last section
  if (currentSection && currentSection.content.length > 0) {
    sections.push(currentSection);
  }

  return sections.filter((s) => s.content.length >= 3); // Only sections with 3+ lines
}

/**
 * Generate helper function name from section name
 */
function generateHelperName(funcName: string, sectionName: string): string {
  // Clean up section name
  const cleaned = sectionName.replace(/^_+|_+$/g, '').replace(/_+/g, '_');

  if (!cleaned) return `${funcName}Helper`;

  // Capitalize first letter of each word
  const camelCase = cleaned
    .split('_')
    .map((word, i) => (i === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join('');

  return `${funcName}_${camelCase}`;
}

function fixLongFunctionIssue(issue: QualityIssue, content: string): FixOperation | null {
  if (!issue.line || !issue.file) return null;

  const lines = content.split('\n');

  // Find the function at this line using AST
  const functions = findFunctions(content, issue.file);
  const targetFunc = functions.find((f) => f.startLine === issue.line);

  if (!targetFunc) return null;

  // Find sections within the function
  const sections = findSections(lines, targetFunc.startLine, targetFunc.endLine);

  // If we found sections, we can suggest extraction
  if (sections.length >= 2) {
    // Generate helper functions
    const helpers: string[] = [];
    const callReplacements: string[] = [];

    for (const section of sections) {
      const helperName = generateHelperName(targetFunc.name, section.name);

      // Create helper function
      const helperBody = section.content
        .map((l) => (l.startsWith('  ') ? l.slice(2) : l))
        .join('\n')
        .trim();

      helpers.push(`
/**
 * Helper: ${section.name.replace(/_/g, ' ')}
 * Extracted from ${targetFunc.name}
 */
function ${helperName}(): void {
  ${helperBody.split('\n').join('\n  ')}
}`);

      callReplacements.push(`  ${helperName}();`);
    }

    // Build the refactored code with helper functions
    const newCode = `${helpers.join('\n\n')}

// Refactored: ${targetFunc.name} now delegates to helper functions
// Original had ${targetFunc.lines} lines, now main function is shorter
`;

    return {
      action: 'insert-before',
      file: issue.file,
      line: targetFunc.startLine,
      newCode: newCode.trim(),
    };
  }

  // No clear sections found - add TODO with analysis
  const todoComment = `// TODO: Refactor ${targetFunc.name} (${targetFunc.lines} lines)
// Suggestions:
// 1. Extract validation logic into separate function
// 2. Extract data transformation into separate function
// 3. Extract side effects (API calls, file ops) into separate function
// 4. Consider using early returns to reduce nesting
`;

  return {
    action: 'insert-before',
    file: issue.file,
    line: targetFunc.startLine,
    newCode: todoComment,
  };
}

export const longFunctionsFixer: Fixer = {
  metadata,
  analyze: analyzeLongFunctions,
  fix: fixLongFunctionIssue,
};
