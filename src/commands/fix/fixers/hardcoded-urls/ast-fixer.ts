/**
 * @module commands/fix/fixers/hardcoded-urls/ast-fixer
 * @description AST-based fixer for hardcoded URLs
 *
 * Extracts hardcoded URLs to named constants using ts-morph.
 * The fixer:
 * - Generates semantic constant names based on URL structure
 * - Inserts const declarations after imports
 * - Replaces the URL string with the constant reference
 */

import { SyntaxKind } from 'ts-morph';
import { astPool } from '@/lib/@ast';
import { escapeRegex } from '@/lib/@security/regex';
import type { FixOperation, QualityIssue } from '../../core/types';
import { findInsertionLine } from '../../core/utils';

// ============================================================================
// FIXER
// ============================================================================

/**
 * Fix hardcoded URL issues using AST for accurate positioning
 */
export function fixUrlAST(issue: QualityIssue, content: string): FixOperation | null {
  if (!issue.line || !issue.file) return null;

  // Skip non-TypeScript files
  if (!issue.file.endsWith('.ts') && !issue.file.endsWith('.tsx')) {
    return null;
  }

  // Extract URL from the message
  const urlMatch = issue.message.match(/Hardcoded URL: (.+?)(?:\.\.\.|$)/);
  if (!urlMatch?.[1]) return null;

  const urlPrefix = urlMatch[1];
  const lines = content.split('\n');
  const targetLine = lines[issue.line - 1];
  if (!targetLine) return null;

  // Find the full URL in the line
  const fullUrl = findFullUrl(targetLine, urlPrefix);
  if (!fullUrl) return null;

  // Generate constant name based on URL
  const constName = generateConstantName(fullUrl);

  // Find the exact position of the URL using AST
  const urlInfo = findUrlPosition(content, issue.file, issue.line, fullUrl);

  if (urlInfo) {
    // Insert const after imports and replace the URL
    const insertLine = findInsertionLine(content, issue.file);
    const constDeclaration = `const ${constName} = '${fullUrl}';`;

    // Build new content
    const newLines = [...lines];

    // Replace the URL string with the constant name
    const lineIndex = issue.line - 1;
    const lineContent = newLines[lineIndex] ?? '';

    // Replace the quoted URL with just the constant name
    const urlPattern = new RegExp(`(['"\`])${escapeRegex(fullUrl)}\\1`);
    newLines[lineIndex] = lineContent.replace(urlPattern, constName);

    // Insert the constant declaration
    newLines.splice(insertLine, 0, constDeclaration);

    return {
      action: 'replace-range',
      file: issue.file,
      line: 1,
      endLine: lines.length,
      oldCode: content,
      newCode: newLines.join('\n'),
    };
  }

  // Fallback: simple line-based fix
  return fixUrlFallback(issue, content, fullUrl, constName);
}

/**
 * Find the full URL in a line given a prefix
 */
function findFullUrl(line: string, prefix: string): string | null {
  const patterns = [
    new RegExp(`['"\`](${escapeRegex(prefix)}[^'"\`\\s]*)['"\`]`),
    new RegExp(`['"\`](${escapeRegex(prefix)})['"\`]`),
  ];

  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Generate a semantic constant name based on URL structure
 */
function generateConstantName(url: string): string {
  try {
    const parsed = new URL(url);

    // Clean hostname
    const host =
      parsed.hostname
        .replace(/^www\./, '')
        .replace(/^api\./, '')
        .split('.')[0] ?? 'API';

    // Get path parts
    const pathParts = parsed.pathname.split('/').filter(Boolean);

    // Build name parts
    const nameParts: string[] = [];

    // Add host if not generic
    if (!['api', 'app', 'www'].includes(host.toLowerCase())) {
      nameParts.push(host.toUpperCase());
    }

    // Add first meaningful path segment
    if (pathParts.length > 0) {
      const firstPath = pathParts[0];
      if (firstPath && !['api', 'v1', 'v2', 'v3'].includes(firstPath.toLowerCase())) {
        nameParts.push(firstPath.toUpperCase().replace(/-/g, '_'));
      } else if (pathParts.length > 1 && pathParts[1]) {
        nameParts.push(pathParts[1].toUpperCase().replace(/-/g, '_'));
      }
    }

    // Add URL suffix
    nameParts.push('URL');

    // Join and clean
    const name = nameParts
      .join('_')
      .replace(/[^A-Z0-9_]/g, '_')
      .replace(/_+/g, '_');

    return name || 'API_URL';
  } catch {
    return 'API_URL';
  }
}

/**
 * Find the exact position of a URL string in the AST
 */
function findUrlPosition(
  content: string,
  file: string,
  targetLine: number,
  targetUrl: string,
): { start: number; end: number; quote: string } | null {
  try {
    const [sourceFile, cleanup] = astPool.createSourceFile(content, file);

    try {
      // Check string literals
      const stringLiterals = sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral);

      for (const literal of stringLiterals) {
        const value = literal.getLiteralValue();
        const { line } = sourceFile.getLineAndColumnAtPos(literal.getStart());

        if (line === targetLine && value === targetUrl) {
          const text = literal.getText();
          const quote = text[0] ?? '"';
          return {
            start: literal.getStart(),
            end: literal.getEnd(),
            quote,
          };
        }
      }

      // Check template literals
      const templateLiterals = sourceFile.getDescendantsOfKind(
        SyntaxKind.NoSubstitutionTemplateLiteral,
      );

      for (const literal of templateLiterals) {
        const value = literal.getLiteralValue();
        const { line } = sourceFile.getLineAndColumnAtPos(literal.getStart());

        if (line === targetLine && value === targetUrl) {
          return {
            start: literal.getStart(),
            end: literal.getEnd(),
            quote: '`',
          };
        }
      }

      return null;
    } finally {
      cleanup();
    }
  } catch {
    return null;
  }
}

/**
 * Fallback fixer using simple string operations
 */
function fixUrlFallback(
  issue: QualityIssue,
  content: string,
  url: string,
  constName: string,
): FixOperation | null {
  if (!issue.line || !issue.file) return null;

  const lines = content.split('\n');
  const lineIndex = issue.line - 1;
  const line = lines[lineIndex];
  if (!line) return null;

  // Find insert position (after imports)
  let insertLine = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i] ?? '';
    if (l.trim().startsWith('import ')) {
      insertLine = i + 1;
    }
  }

  // Detect quote style
  const quoteMatch = line.match(new RegExp(`(['"\`])${escapeRegex(url)}\\1`));
  const quote = quoteMatch?.[1] ?? "'";

  // Create the fix
  const constDeclaration = `const ${constName} = ${quote}${url}${quote};`;
  const newLines = [...lines];

  // Replace the URL with constant name
  const urlPattern = new RegExp(`(['"\`])${escapeRegex(url)}\\1`);
  newLines[lineIndex] = line.replace(urlPattern, constName);

  // Insert const declaration
  newLines.splice(insertLine, 0, constDeclaration);

  return {
    action: 'replace-range',
    file: issue.file,
    line: 1,
    endLine: lines.length,
    oldCode: content,
    newCode: newLines.join('\n'),
  };
}
