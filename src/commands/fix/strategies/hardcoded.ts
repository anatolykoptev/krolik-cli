/**
 * @module commands/fix/strategies/hardcoded
 * @description AST-based fix strategies for hardcoded values
 *
 * Uses ts-morph for safe code transformations:
 * - Magic numbers → Named constants
 * - URLs → Config constants
 */

import { Project, SyntaxKind, SourceFile, NumericLiteral } from 'ts-morph';
import type { QualityIssue } from '../../quality/types';
import type { FixOperation, FixStrategy } from '../types';

// ============================================================================
// PATTERNS
// ============================================================================

const FIXABLE_PATTERNS = {
  NUMBER: /hardcoded\s+number:\s*(\d+)/i,
  URL: /hardcoded\s+url:\s*(https?:\/\/[^\s]+)/i,
  COLOR: /hardcoded\s+color/i,
  TEXT: /hardcoded\s+string/i,
};

// Numbers that are typically intentional, not magic
const ALLOWED_NUMBERS = new Set([
  0, 1, 2, -1,  // Common indices/increments
  10, 100, 1000, // Common bases
  24, 60, 365,   // Time units
  1024, 2048,    // Binary sizes
]);

// ============================================================================
// CONSTANT NAME GENERATION
// ============================================================================

const CONTEXT_TO_NAME: Record<string, string> = {
  timeout: 'TIMEOUT_MS',
  delay: 'DELAY_MS',
  interval: 'INTERVAL_MS',
  duration: 'DURATION_MS',
  width: 'DEFAULT_WIDTH',
  height: 'DEFAULT_HEIGHT',
  size: 'MAX_SIZE',
  length: 'MAX_LENGTH',
  limit: 'MAX_LIMIT',
  max: 'MAX_VALUE',
  min: 'MIN_VALUE',
  count: 'DEFAULT_COUNT',
  total: 'TOTAL_COUNT',
  page: 'PAGE_SIZE',
  retry: 'MAX_RETRIES',
  attempt: 'MAX_ATTEMPTS',
  index: 'DEFAULT_INDEX',
  offset: 'DEFAULT_OFFSET',
  port: 'DEFAULT_PORT',
  threshold: 'THRESHOLD',
};

function generateConstName(value: number, context: string): string {
  const lower = context.toLowerCase();

  for (const [keyword, name] of Object.entries(CONTEXT_TO_NAME)) {
    if (lower.includes(keyword)) {
      return name;
    }
  }

  // Fallback with value hint
  if (value >= 1000) {
    return `LARGE_VALUE_${value}`;
  }
  return `MAGIC_${value}`;
}

// ============================================================================
// AST UTILITIES
// ============================================================================

/**
 * Create a ts-morph project for code manipulation
 */
function createProject(): Project {
  return new Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
      allowJs: true,
      checkJs: false,
    },
  });
}

/**
 * Find the optimal insertion point for constants
 * After imports, before first executable code or hooks
 */
function findInsertionPoint(sourceFile: SourceFile): number {
  const statements = sourceFile.getStatements();
  let insertPos = 0;

  for (const stmt of statements) {
    // Skip imports
    if (stmt.getKind() === SyntaxKind.ImportDeclaration) {
      insertPos = stmt.getEnd() + 1;
      continue;
    }

    // Skip type declarations (interface, type, enum)
    const kind = stmt.getKind();
    if (
      kind === SyntaxKind.InterfaceDeclaration ||
      kind === SyntaxKind.TypeAliasDeclaration ||
      kind === SyntaxKind.EnumDeclaration
    ) {
      insertPos = stmt.getEnd() + 1;
      continue;
    }

    // Found first executable code - insert before it
    break;
  }

  return insertPos;
}

/**
 * Check if a numeric literal is inside a type definition
 */
function isInsideTypeDefinition(node: NumericLiteral): boolean {
  let parent = node.getParent();
  while (parent) {
    const kind = parent.getKind();
    if (
      kind === SyntaxKind.InterfaceDeclaration ||
      kind === SyntaxKind.TypeAliasDeclaration ||
      kind === SyntaxKind.EnumDeclaration ||
      kind === SyntaxKind.PropertySignature
    ) {
      return true;
    }
    parent = parent.getParent();
  }
  return false;
}

/**
 * Check if a numeric literal is inside a string template
 */
function isInsideString(node: NumericLiteral): boolean {
  let parent = node.getParent();
  while (parent) {
    const kind = parent.getKind();
    if (
      kind === SyntaxKind.TemplateExpression ||
      kind === SyntaxKind.StringLiteral
    ) {
      return true;
    }
    parent = parent.getParent();
  }
  return false;
}

/**
 * Check if a numeric literal is inside a const declaration with given name
 * (to avoid replacing the value in `const FOO = 42;` with `const FOO = FOO;`)
 */
function isInsideConstDeclaration(node: NumericLiteral, constName: string): boolean {
  let parent = node.getParent();
  while (parent) {
    if (parent.getKind() === SyntaxKind.VariableDeclaration) {
      const varDecl = parent.asKind(SyntaxKind.VariableDeclaration);
      if (varDecl && varDecl.getName() === constName) {
        return true;
      }
    }
    parent = parent.getParent();
  }
  return false;
}

// ============================================================================
// STRATEGY
// ============================================================================

export const hardcodedStrategy: FixStrategy = {
  categories: ['hardcoded'],

  canFix(issue: QualityIssue, _content: string): boolean {
    const { message } = issue;

    if (FIXABLE_PATTERNS.NUMBER.test(message)) {
      const match = message.match(/(\d+)/);
      const value = match ? parseInt(match[1] || '0', 10) : 0;
      // Skip commonly acceptable numbers
      return !ALLOWED_NUMBERS.has(value);
    }

    if (FIXABLE_PATTERNS.URL.test(message)) {
      return true;
    }

    // Colors and text need theme/i18n systems
    return false;
  },

  generateFix(issue: QualityIssue, content: string): FixOperation | null {
    const { message, file, snippet } = issue;

    if (FIXABLE_PATTERNS.NUMBER.test(message)) {
      return generateNumberFixAST(content, file, message, snippet);
    }

    if (FIXABLE_PATTERNS.URL.test(message)) {
      return generateUrlFix(content, file, snippet);
    }

    return null;
  },
};

// ============================================================================
// AST-BASED FIX GENERATORS
// ============================================================================

/**
 * Extract magic number into a named constant using AST
 *
 * Key fix: Don't rely on line numbers after insertion - search by value only
 */
function generateNumberFixAST(
  content: string,
  file: string,
  message: string,
  snippet: string | undefined,
): FixOperation | null {
  // Extract the target value
  const match = message.match(/(\d+)/);
  if (!match) return null;
  const targetValue = parseInt(match[1] || '0', 10);

  // Skip allowed numbers
  if (ALLOWED_NUMBERS.has(targetValue)) return null;

  try {
    const project = createProject();
    const sourceFile = project.createSourceFile('temp.ts', content);

    // Find ALL numeric literals with this value that are safe to replace
    const candidates = sourceFile
      .getDescendantsOfKind(SyntaxKind.NumericLiteral)
      .filter(n => {
        const value = n.getLiteralValue();
        return (
          value === targetValue &&
          !isInsideTypeDefinition(n) &&
          !isInsideString(n)
        );
      });

    if (candidates.length === 0) return null;

    // Generate constant name from context
    const context = snippet || message;
    const constName = generateConstName(targetValue, context);

    // Check if constant already exists
    const existingConst = sourceFile
      .getVariableDeclarations()
      .find(v => v.getName() === constName);

    if (!existingConst) {
      // Find insertion point and add constant
      const insertPos = findInsertionPoint(sourceFile);
      const constDecl = `\nconst ${constName} = ${targetValue};\n`;
      sourceFile.insertText(insertPos, constDecl);
    }

    // After insertion, re-find candidates (positions have changed)
    // Replace FIRST matching literal only (safe approach)
    // IMPORTANT: Skip the literal inside the const declaration we just created!
    const updatedCandidates = sourceFile
      .getDescendantsOfKind(SyntaxKind.NumericLiteral)
      .filter(n => {
        const value = n.getLiteralValue();
        return (
          value === targetValue &&
          !isInsideTypeDefinition(n) &&
          !isInsideString(n) &&
          !isInsideConstDeclaration(n, constName)
        );
      });

    // Replace first candidate (safe, single replacement per issue)
    if (updatedCandidates.length > 0) {
      updatedCandidates[0]?.replaceWithText(constName);
    }

    const newContent = sourceFile.getFullText();

    return {
      action: 'replace-range',
      file,
      line: 1,
      endLine: content.split('\n').length,
      oldCode: content,
      newCode: newContent,
    };
  } catch {
    // AST parsing failed - skip this fix
    return null;
  }
}

/**
 * Extract URL into a named constant
 */
function generateUrlFix(
  content: string,
  file: string,
  snippet: string | undefined,
): FixOperation | null {
  if (!snippet) return null;

  const urlMatch = snippet.match(/(["'`])(https?:\/\/[^"'`\s]+)\1/);
  if (!urlMatch) return null;

  const url = urlMatch[2] || '';
  const quote = urlMatch[1] || '"';

  // Generate constant name from URL
  let constName = 'API_URL';
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/\./g, '_').toUpperCase();
    constName = `${host}_URL`;
  } catch {
    // Keep default
  }

  try {
    const project = createProject();
    const sourceFile = project.createSourceFile('temp.ts', content);

    // Check if constant exists
    const existingConst = sourceFile
      .getVariableDeclarations()
      .find(v => v.getName() === constName);

    if (!existingConst) {
      const insertPos = findInsertionPoint(sourceFile);
      const constDecl = `\nconst ${constName} = ${quote}${url}${quote};\n`;
      sourceFile.insertText(insertPos, constDecl);
    }

    // Find and replace the URL string
    const stringLiterals = sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral);
    for (const literal of stringLiterals) {
      if (literal.getLiteralValue() === url) {
        literal.replaceWithText(constName);
        break;
      }
    }

    return {
      action: 'replace-range',
      file,
      line: 1,
      endLine: content.split('\n').length,
      oldCode: content,
      newCode: sourceFile.getFullText(),
    };
  } catch {
    return null;
  }
}
