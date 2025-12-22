/**
 * @module commands/fix/strategies/hardcoded/ast-utils
 * @description AST utilities for code analysis and transformation
 */

import { Project, SyntaxKind, SourceFile, NumericLiteral } from 'ts-morph';

// ============================================================================
// PROJECT CREATION
// ============================================================================

/**
 * Create a ts-morph project for code manipulation
 */
export function createProject(): Project {
  return new Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
      allowJs: true,
      checkJs: false,
    },
  });
}

// ============================================================================
// INSERTION POINT
// ============================================================================

/**
 * Find the optimal insertion point for constants
 * After imports, before first executable code or hooks
 */
export function findInsertionPoint(sourceFile: SourceFile): number {
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

// ============================================================================
// NODE CHECKS
// ============================================================================

/**
 * Check if a numeric literal is inside a type definition
 */
export function isInsideTypeDefinition(node: NumericLiteral): boolean {
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
export function isInsideString(node: NumericLiteral): boolean {
  let parent = node.getParent();
  while (parent) {
    const kind = parent.getKind();
    if (kind === SyntaxKind.TemplateExpression || kind === SyntaxKind.StringLiteral) {
      return true;
    }
    parent = parent.getParent();
  }
  return false;
}

/**
 * Check if a numeric literal is inside a const object literal (mapping/lookup)
 * Examples: `const LOG_LEVELS = { error: 3 }` - these are intentional
 */
export function isInsideConstObjectLiteral(node: NumericLiteral): boolean {
  let parent = node.getParent();
  let foundObjectLiteral = false;

  while (parent) {
    const kind = parent.getKind();

    // Track if we're inside an object literal
    if (kind === SyntaxKind.ObjectLiteralExpression) {
      foundObjectLiteral = true;
    }

    // If we find a const variable declaration containing an object literal
    if (kind === SyntaxKind.VariableDeclaration && foundObjectLiteral) {
      const varDecl = parent.asKind(SyntaxKind.VariableDeclaration);
      if (varDecl) {
        // Check if it's a SCREAMING_SNAKE_CASE or PascalCase const (likely a mapping)
        const name = varDecl.getName();
        if (name === name.toUpperCase() || /^[A-Z][a-zA-Z]*$/.test(name)) {
          return true;
        }
      }
    }

    // If we hit a VariableStatement with const keyword and object literal
    if (kind === SyntaxKind.VariableStatement && foundObjectLiteral) {
      const varStmt = parent.asKind(SyntaxKind.VariableStatement);
      if (varStmt) {
        const declList = varStmt.getDeclarationList();
        if (declList.getFlags() & 2 /* ConstKeyword */) {
          return true;
        }
      }
    }

    parent = parent.getParent();
  }
  return false;
}

/**
 * Check if a numeric literal is inside a const declaration with given name
 * (to avoid replacing the value in `const FOO = 42;` with `const FOO = FOO;`)
 */
export function isInsideConstDeclaration(node: NumericLiteral, constName: string): boolean {
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
// VALUE CHECKS
// ============================================================================

/**
 * Check if number looks like a timestamp or date component
 */
export function looksLikeTimestamp(value: number): boolean {
  // Unix timestamp range (roughly 2000-2050)
  if (value > 946684800000 && value < 2524608000000) return true;
  // Year values
  if (value >= 1970 && value <= 2100) return true;
  // Month/day values in date context handled by ALLOWED_NUMBERS
  return false;
}
