/**
 * @module commands/fix/fixers/hardcoded-urls/ast-analyzer
 * @description AST-based analyzer for hardcoded URLs using ts-morph
 *
 * Uses ts-morph for accurate detection of:
 * - URLs in string literals
 * - URLs in template literals
 * - Skips URLs in comments, const declarations, and config objects
 */

import { Node, SyntaxKind } from 'ts-morph';
import { astPool } from '@/lib/@ast';
import type { QualityIssue } from '../../core/types';

// ============================================================================
// CONSTANTS
// ============================================================================

// URL pattern for validation
const URL_REGEX = /^https?:\/\/[^\s"'`]+$/;

// Hosts to skip (localhost, example domains, etc.)
const SKIP_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  'example.com',
  'example.org',
  'example.net',
  'test.com',
  'placeholder.com',
]);

// Common documentation/schema URLs to skip
const SKIP_URL_PATTERNS = [
  /^https?:\/\/schema\.org/,
  /^https?:\/\/www\.w3\.org/,
  /^https?:\/\/json-schema\.org/,
  /^https?:\/\/xmlns\./,
  /^https?:\/\/purl\.org/,
  /^https?:\/\/ogp\.me/,
  /^https?:\/\/opengraphprotocol\.org/,
];

// ============================================================================
// ANALYZER
// ============================================================================

/**
 * Analyze content for hardcoded URLs using ts-morph AST
 */
export function analyzeUrlsAST(content: string, file: string): QualityIssue[] {
  // Skip config and test files
  if (
    file.includes('.config.') ||
    file.includes('.test.') ||
    file.includes('.spec.') ||
    file.endsWith('.d.ts')
  ) {
    return [];
  }

  // Skip non-TypeScript files
  if (!file.endsWith('.ts') && !file.endsWith('.tsx')) {
    return [];
  }

  const issues: QualityIssue[] = [];
  const lines = content.split('\n');
  const seenLocations = new Set<string>();

  try {
    const [sourceFile, cleanup] = astPool.createSourceFile(content, file);

    try {
      // Find all string literals
      const stringLiterals = sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral);

      for (const literal of stringLiterals) {
        const value = literal.getLiteralValue();

        // Check if it's a URL
        if (!URL_REGEX.test(value)) continue;

        const { line, column } = sourceFile.getLineAndColumnAtPos(literal.getStart());

        // Skip duplicates
        const locationKey = `${line}:${column}`;
        if (seenLocations.has(locationKey)) continue;
        seenLocations.add(locationKey);

        // Skip if URL should be ignored
        if (shouldSkipUrl(value)) continue;

        // Skip if in allowed context
        if (isInAllowedContext(literal)) continue;

        const lineContent = lines[line - 1] ?? '';
        const truncatedUrl = value.length > 40 ? `${value.slice(0, 40)}...` : value;

        issues.push({
          file,
          line,
          severity: 'warning',
          category: 'hardcoded',
          message: `Hardcoded URL: ${truncatedUrl}`,
          suggestion: 'Extract to environment variable or constant',
          snippet: lineContent.trim().slice(0, 60),
          fixerId: 'hardcoded-urls',
        });
      }

      // Also check template literals for URLs
      const templateLiterals = sourceFile.getDescendantsOfKind(
        SyntaxKind.NoSubstitutionTemplateLiteral,
      );

      for (const literal of templateLiterals) {
        const value = literal.getLiteralValue();

        if (!URL_REGEX.test(value)) continue;

        const { line, column } = sourceFile.getLineAndColumnAtPos(literal.getStart());

        const locationKey = `${line}:${column}`;
        if (seenLocations.has(locationKey)) continue;
        seenLocations.add(locationKey);

        if (shouldSkipUrl(value)) continue;
        if (isInAllowedContext(literal)) continue;

        const lineContent = lines[line - 1] ?? '';
        const truncatedUrl = value.length > 40 ? `${value.slice(0, 40)}...` : value;

        issues.push({
          file,
          line,
          severity: 'warning',
          category: 'hardcoded',
          message: `Hardcoded URL: ${truncatedUrl}`,
          suggestion: 'Extract to environment variable or constant',
          snippet: lineContent.trim().slice(0, 60),
          fixerId: 'hardcoded-urls',
        });
      }

      return issues;
    } finally {
      cleanup();
    }
  } catch {
    // Fallback to regex analysis
    return analyzeUrlsFallback(content, file);
  }
}

/**
 * Check if a URL should be skipped based on its value
 */
function shouldSkipUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    // Skip localhost and example domains
    if (SKIP_HOSTS.has(parsed.hostname)) return true;

    // Skip if hostname contains localhost
    if (parsed.hostname.includes('localhost')) return true;

    // Skip documentation/schema URLs
    if (SKIP_URL_PATTERNS.some((pattern) => pattern.test(url))) return true;

    return false;
  } catch {
    // Invalid URL - skip it
    return true;
  }
}

/**
 * Check if a string literal is in an allowed context
 */
function isInAllowedContext(literal: Node): boolean {
  const parent = literal.getParent();
  if (!parent) return false;

  // 1. Variable declaration (const URL = "...")
  if (Node.isVariableDeclaration(parent)) {
    const name = parent.getName().toUpperCase();
    // If it's already a constant with URL/API/ENDPOINT in name, skip
    if (/URL|API|ENDPOINT|BASE|HOST/.test(name)) {
      return true;
    }
  }

  // 2. Property assignment with URL-related name
  if (Node.isPropertyAssignment(parent)) {
    const propName = parent.getName().toLowerCase();
    if (/url|endpoint|api|base|host|href|src/.test(propName)) {
      return true;
    }
  }

  // 3. In JSX attribute (src, href are common for URLs)
  if (Node.isJsxAttribute(parent)) {
    const attrName = parent.getNameNode().getText().toLowerCase();
    if (['src', 'href', 'action', 'poster', 'data'].includes(attrName)) {
      return true;
    }
  }

  // 4. In object with url/config pattern
  const objectLiteral = literal.getFirstAncestorByKind(SyntaxKind.ObjectLiteralExpression);
  if (objectLiteral) {
    // Check if any property in the object suggests it's a config
    const properties = objectLiteral.getProperties();
    for (const prop of properties) {
      if (Node.isPropertyAssignment(prop)) {
        const name = prop.getName().toLowerCase();
        if (/baseurl|apiurl|endpoint|config/.test(name)) {
          return true;
        }
      }
    }
  }

  // 5. In a comment (shouldn't happen with AST, but safety check)
  const leadingComments = literal.getLeadingCommentRanges();
  if (leadingComments.length > 0) {
    return true;
  }

  // 6. In type annotation
  const typeNode = literal.getFirstAncestorByKind(SyntaxKind.TypeLiteral);
  if (typeNode) {
    return true;
  }

  // 7. In test assertion
  const callExpr = literal.getFirstAncestorByKind(SyntaxKind.CallExpression);
  if (callExpr) {
    const callText = callExpr.getExpression().getText();
    if (/expect|assert|mock|stub|spy/.test(callText)) {
      return true;
    }
  }

  return false;
}

/**
 * Fallback regex-based analysis for files that fail to parse
 */
function analyzeUrlsFallback(content: string, file: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const lines = content.split('\n');
  const URL_PATTERN = /(["'`])(https?:\/\/[^"'`\s]+)\1/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();

    // Skip comments
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

    URL_PATTERN.lastIndex = 0;
    let match;

    while ((match = URL_PATTERN.exec(line)) !== null) {
      const url = match[2] ?? '';

      if (shouldSkipUrl(url)) continue;

      const truncatedUrl = url.length > 40 ? `${url.slice(0, 40)}...` : url;

      issues.push({
        file,
        line: i + 1,
        severity: 'warning',
        category: 'hardcoded',
        message: `Hardcoded URL: ${truncatedUrl}`,
        suggestion: 'Extract to environment variable or constant',
        snippet: trimmed.slice(0, 60),
        fixerId: 'hardcoded-urls',
      });
    }
  }

  return issues;
}
