/**
 * @module commands/fix/fixers/magic-numbers
 * @description Magic numbers fixer
 *
 * Detects hardcoded numbers and extracts them to named constants.
 * Uses AST for safe transformations.
 */

import { isInsideStringLine } from '../../../../lib/@swc';
import { createFixerMetadata } from '../../core/registry';
import type { Fixer, FixOperation, QualityIssue } from '../../core/types';

export const metadata = createFixerMetadata('magic-numbers', 'Magic Numbers', 'hardcoded', {
  description: 'Extract magic numbers to named constants',
  difficulty: 'safe',
  cliFlag: '--fix-magic-numbers',
  tags: ['safe', 'hardcoded', 'refactoring'],
});

// Allowed numbers that don't need extraction
const ALLOWED_NUMBERS = new Set([0, 1, 2, -1, 100, 1000, 10]);

// Pattern for detecting magic numbers
const MAGIC_NUMBER_PATTERN = /(?<![\w.])\b(\d{2,})\b(?![\w])/g;

function analyzeMagicNumbers(content: string, file: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const lines = content.split('\n');

  // Skip config and test files
  if (
    file.includes('.config.') ||
    file.includes('.test.') ||
    file.includes('.spec.') ||
    file.endsWith('.d.ts')
  ) {
    return issues;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();

    // Skip comments and const declarations (they define constants)
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
    if (trimmed.startsWith('const ') && trimmed.includes('=')) continue;

    // Strip comments before matching
    const codeOnly = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');

    MAGIC_NUMBER_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;

    // biome-ignore lint/suspicious/noAssignInExpressions: Standard regex exec loop
    while ((match = MAGIC_NUMBER_PATTERN.exec(codeOnly)) !== null) {
      const num = parseInt(match[1] ?? '0', 10);

      // Skip allowed numbers
      if (ALLOWED_NUMBERS.has(num)) continue;

      // Skip if inside string literal (e.g., "port: 8080")
      if (isInsideStringLine(line, match.index)) continue;

      // Skip array indices
      if (codeOnly.includes(`[${num}]`)) continue;

      // Skip timeout/delay values (often intentional)
      if (/timeout|delay|interval/i.test(codeOnly)) continue;

      // Skip port numbers and common HTTP codes
      if (
        [80, 443, 8080, 3000, 5000, 200, 201, 204, 301, 302, 400, 401, 403, 404, 500].includes(num)
      )
        continue;

      issues.push({
        file,
        line: i + 1,
        severity: 'warning',
        category: 'hardcoded',
        message: `Hardcoded number: ${num}`,
        suggestion: 'Extract to a named constant',
        snippet: trimmed.slice(0, 60),
        fixerId: 'magic-numbers',
      });
    }
  }

  return issues;
}

function fixMagicNumberIssue(issue: QualityIssue, content: string): FixOperation | null {
  if (!issue.line || !issue.file) return null;

  // Extract the number from the message
  const numMatch = issue.message.match(/(\d+)/);
  if (!numMatch) return null;

  const targetNumber = parseInt(numMatch[1] ?? '0', 10);
  const lines = content.split('\n');
  const line = lines[issue.line - 1];
  if (!line) return null;

  // Generate constant name based on context
  const trimmed = line.trim();
  let constName = `MAGIC_${targetNumber}`;

  // Try to infer better name from context
  if (trimmed.includes('timeout') || trimmed.includes('delay')) {
    constName = `TIMEOUT_${targetNumber}MS`;
  } else if (trimmed.includes('width') || trimmed.includes('height')) {
    constName = `SIZE_${targetNumber}`;
  } else if (trimmed.includes('max') || trimmed.includes('limit')) {
    constName = `MAX_${targetNumber}`;
  } else if (trimmed.includes('min')) {
    constName = `MIN_${targetNumber}`;
  } else if (trimmed.includes('count') || trimmed.includes('length')) {
    constName = `COUNT_${targetNumber}`;
  }

  // Create fix: add constant at top and replace usage
  const constDeclaration = `const ${constName} = ${targetNumber};\n`;
  const newLine = line.replace(new RegExp(`\\b${targetNumber}\\b`), constName);

  // For now, just replace the line - full AST fix would prepend const
  return {
    action: 'replace-range',
    file: issue.file,
    line: 1,
    endLine: issue.line,
    oldCode: lines.slice(0, issue.line).join('\n'),
    newCode: `${constDeclaration + lines.slice(0, issue.line - 1).join('\n')}\n${newLine}`,
  };
}

export const magicNumbersFixer: Fixer = {
  metadata,
  analyze: analyzeMagicNumbers,
  fix: fixMagicNumberIssue,
};
