/**
 * @module commands/fix/strategies/hardcoded/ast-utils
 * @description AST utilities for code analysis and transformation
 *
 * NOTE: Uses lib/ast for centralized ts-morph utilities.
 */

import { SyntaxKind, type SourceFile, type Node } from 'ts-morph';
import type { NumericLiteral } from 'ts-morph';
import { createProject } from '@/lib';

// Re-export for convenience
export { createProject };

// ============================================================================
// CONSTANTS
// ============================================================================

/** TypeScript NodeFlags for const declarations */
const NODE_FLAGS = {
  Const: 2,
} as const;

// ============================================================================
// GENERIC HELPERS
// ============================================================================

/**
 * Traverse parent nodes until predicate returns true or root is reached
 * @returns The matching parent node or null
 */
export function findAncestor<T extends Node>(
  node: Node,
  predicate: (parent: Node) => parent is T,
): T | null;
export function findAncestor(node: Node, predicate: (parent: Node) => boolean): Node | null;
export function findAncestor(node: Node, predicate: (parent: Node) => boolean): Node | null {
  let parent = node.getParent();
  while (parent) {
    if (predicate(parent)) {
      return parent;
    }
    parent = parent.getParent();
  }
  return null;
}

/**
 * Check if any ancestor matches the predicate
 */
export function hasAncestor(node: Node, predicate: (parent: Node) => boolean): boolean {
  return findAncestor(node, predicate) !== null;
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

/** SyntaxKinds that represent type definitions */
const TYPE_DEFINITION_KINDS = new Set([
  SyntaxKind.InterfaceDeclaration,
  SyntaxKind.TypeAliasDeclaration,
  SyntaxKind.EnumDeclaration,
  SyntaxKind.PropertySignature,
]);

/** SyntaxKinds that represent actual string content (not interpolations) */
const STRING_CONTEXT_KINDS = new Set([
  SyntaxKind.StringLiteral,
  SyntaxKind.NoSubstitutionTemplateLiteral,
  // Note: TemplateExpression is NOT included - numbers in ${...} are valid code
]);

/**
 * Check if a numeric literal is inside a type definition
 */
export function isInsideTypeDefinition(node: NumericLiteral): boolean {
  return hasAncestor(node, (parent) => TYPE_DEFINITION_KINDS.has(parent.getKind()));
}

/**
 * Check if a numeric literal is inside a string template
 */
export function isInsideString(node: NumericLiteral): boolean {
  return hasAncestor(node, (parent) => STRING_CONTEXT_KINDS.has(parent.getKind()));
}

/** Pattern for SCREAMING_SNAKE_CASE or PascalCase names (likely constants/mappings) */
const CONST_NAME_PATTERN = /^[A-Z][A-Z0-9_]*$|^[A-Z][a-zA-Z0-9]*$/;

/**
 * Check if a numeric literal is inside a const object literal (mapping/lookup)
 * Examples: `const LOG_LEVELS = { error: 3 }` - these are intentional
 */
export function isInsideConstObjectLiteral(node: NumericLiteral): boolean {
  // First check if we're inside an object literal
  const objectLiteral = findAncestor(
    node,
    (p) => p.getKind() === SyntaxKind.ObjectLiteralExpression,
  );
  if (!objectLiteral) return false;

  // Then check if the object is assigned to a CONST_CASE variable
  const varDecl = findAncestor(objectLiteral, (p) => p.getKind() === SyntaxKind.VariableDeclaration);
  if (varDecl) {
    const decl = varDecl.asKind(SyntaxKind.VariableDeclaration);
    if (decl && CONST_NAME_PATTERN.test(decl.getName())) {
      return true;
    }
  }

  // Or check if it's in a const statement
  const varStmt = findAncestor(objectLiteral, (p) => p.getKind() === SyntaxKind.VariableStatement);
  if (varStmt) {
    const stmt = varStmt.asKind(SyntaxKind.VariableStatement);
    if (stmt) {
      const declList = stmt.getDeclarationList();
      if (declList.getFlags() & NODE_FLAGS.Const) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if a numeric literal is inside a const declaration with given name
 * (to avoid replacing the value in `const FOO = 42;` with `const FOO = FOO;`)
 */
export function isInsideConstDeclaration(node: NumericLiteral, constName: string): boolean {
  return hasAncestor(node, (parent) => {
    if (parent.getKind() !== SyntaxKind.VariableDeclaration) return false;
    const varDecl = parent.asKind(SyntaxKind.VariableDeclaration);
    return varDecl?.getName() === constName;
  });
}

// ============================================================================
// CONTEXT EXTRACTION
// ============================================================================

/**
 * Extract context from AST node for better constant naming
 * Returns identifier name from parent context (property, variable, etc.)
 */
export function extractASTContext(node: NumericLiteral): string | null {
  const parent = node.getParent();
  if (!parent) return null;

  const kind = parent.getKind();

  switch (kind) {
    // Case 1: Property assignment - `{ foo: 42 }` → "foo"
    case SyntaxKind.PropertyAssignment: {
      const propAssign = parent.asKind(SyntaxKind.PropertyAssignment);
      return propAssign?.getName() ?? null;
    }

    // Case 2: Variable declaration - `const foo = 42` → "foo"
    case SyntaxKind.VariableDeclaration: {
      const varDecl = parent.asKind(SyntaxKind.VariableDeclaration);
      return varDecl?.getName() ?? null;
    }

    // Case 3: Function argument - `fn(42)` → "fn_arg0"
    case SyntaxKind.CallExpression: {
      const call = parent.asKind(SyntaxKind.CallExpression);
      if (!call) return null;
      const args = call.getArguments();
      const argIndex = args.findIndex((arg) => arg === node);
      const funcName = call.getExpression().getText();
      return funcName && argIndex >= 0 ? `${funcName}_arg${argIndex}` : null;
    }

    // Case 4: Binary expression - `x > 42` → "x"
    case SyntaxKind.BinaryExpression: {
      const binary = parent.asKind(SyntaxKind.BinaryExpression);
      if (!binary) return null;
      const left = binary.getLeft();
      return left.getKind() === SyntaxKind.Identifier ? left.getText() : null;
    }

    // Case 5: Array element - no good context
    case SyntaxKind.ArrayLiteralExpression:
      return null;

    default:
      return null;
  }
}

// ============================================================================
// VALUE CHECKS
// ============================================================================

/** Unix timestamp range (2000-2050) */
const TIMESTAMP_RANGE = {
  min: 946684800000,
  max: 2524608000000,
} as const;

/** Year range for date detection */
const YEAR_RANGE = {
  min: 1970,
  max: 2100,
} as const;

/**
 * Check if number looks like a timestamp or date component
 */
export function looksLikeTimestamp(value: number): boolean {
  // Unix timestamp range
  if (value > TIMESTAMP_RANGE.min && value < TIMESTAMP_RANGE.max) return true;
  // Year values
  if (value >= YEAR_RANGE.min && value <= YEAR_RANGE.max) return true;
  return false;
}
