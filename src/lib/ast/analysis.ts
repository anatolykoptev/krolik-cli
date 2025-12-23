/**
 * @module lib/ast/analysis
 * @description AST analysis utilities for code inspection
 *
 * Provides utilities for:
 * - Finding nodes by kind
 * - Checking node context (in string, comment, etc.)
 * - Getting code context (function, class, etc.)
 */

import {
  Node,
  SyntaxKind,
  SourceFile,
  DiagnosticCategory,
} from 'ts-morph';

// ============================================================================
// TYPES
// ============================================================================

export interface CodeContext {
  /** Function name if inside a function */
  functionName?: string;
  /** Class name if inside a class */
  className?: string;
  /** Method name if inside a method */
  methodName?: string;
  /** Whether async context */
  isAsync?: boolean;
  /** Whether in try-catch */
  inTryCatch?: boolean;
}

export interface SyntaxError {
  line: number;
  column: number;
  message: string;
  code?: string;
}

// ============================================================================
// NODE FINDING
// ============================================================================

/**
 * Find ancestor node of specific kind
 *
 * @example
 * const funcDecl = findAncestor(node, SyntaxKind.FunctionDeclaration);
 */
export function findAncestor(
  node: Node,
  kind: SyntaxKind,
): Node | undefined {
  let current: Node | undefined = node.getParent();

  while (current) {
    if (current.getKind() === kind) {
      return current;
    }
    current = current.getParent();
  }

  return undefined;
}

/**
 * Find ancestor node matching predicate
 */
export function findAncestorWhere(
  node: Node,
  predicate: (node: Node) => boolean,
): Node | undefined {
  let current: Node | undefined = node.getParent();

  while (current) {
    if (predicate(current)) {
      return current;
    }
    current = current.getParent();
  }

  return undefined;
}

/**
 * Get all descendants of specific kind
 */
export function getDescendants(
  node: Node,
  kind: SyntaxKind,
): Node[] {
  return node.getDescendantsOfKind(kind);
}

// ============================================================================
// CONTEXT CHECKING
// ============================================================================

/**
 * Check if node is inside a string literal
 */
export function isInsideString(node: Node): boolean {
  return !!findAncestorWhere(node, (n) => {
    const kind = n.getKind();
    return (
      kind === SyntaxKind.StringLiteral ||
      kind === SyntaxKind.TemplateExpression ||
      kind === SyntaxKind.NoSubstitutionTemplateLiteral ||
      kind === SyntaxKind.TemplateSpan
    );
  });
}

/**
 * Check if node is inside a comment
 * Note: ts-morph usually doesn't include comments in AST
 */
export function isInsideComment(node: Node): boolean {
  // Comments are typically trivia, not AST nodes
  // This checks if the position is within leading/trailing trivia
  const leadingTrivia = node.getLeadingCommentRanges();
  const trailingTrivia = node.getTrailingCommentRanges();

  return leadingTrivia.length > 0 || trailingTrivia.length > 0;
}

/**
 * Check if node is inside a const object literal (for config detection)
 */
export function isInsideConstObject(node: Node): boolean {
  const objLiteral = findAncestor(node, SyntaxKind.ObjectLiteralExpression);
  if (!objLiteral) return false;

  const varDecl = findAncestor(objLiteral, SyntaxKind.VariableDeclaration);
  if (!varDecl) return false;

  const varDeclList = varDecl.getParent();
  if (!varDeclList || !Node.isVariableDeclarationList(varDeclList)) return false;

  // Check if const
  return varDeclList.getDeclarationKind() === 1; // 1 = Const
}

/**
 * Check if node is inside an array literal
 */
export function isInsideArray(node: Node): boolean {
  return !!findAncestor(node, SyntaxKind.ArrayLiteralExpression);
}

/**
 * Check if node is inside a function body
 */
export function isInsideFunction(node: Node): boolean {
  return !!findAncestorWhere(node, (n) => {
    const kind = n.getKind();
    return (
      kind === SyntaxKind.FunctionDeclaration ||
      kind === SyntaxKind.FunctionExpression ||
      kind === SyntaxKind.ArrowFunction ||
      kind === SyntaxKind.MethodDeclaration
    );
  });
}

// ============================================================================
// CODE CONTEXT
// ============================================================================

/**
 * Get code context for a node
 *
 * Returns information about the surrounding code:
 * - Function/method name
 * - Class name
 * - Async context
 * - Try-catch context
 */
export function getCodeContext(node: Node): CodeContext {
  const context: CodeContext = {};

  // Check for function context
  const func = findAncestorWhere(node, (n) => {
    const kind = n.getKind();
    return (
      kind === SyntaxKind.FunctionDeclaration ||
      kind === SyntaxKind.FunctionExpression ||
      kind === SyntaxKind.ArrowFunction ||
      kind === SyntaxKind.MethodDeclaration
    );
  });

  if (func) {
    if (Node.isFunctionDeclaration(func)) {
      context.functionName = func.getName();
      context.isAsync = func.isAsync();
    } else if (Node.isMethodDeclaration(func)) {
      context.methodName = func.getName();
      context.isAsync = func.isAsync();
    } else if (Node.isArrowFunction(func) || Node.isFunctionExpression(func)) {
      // Try to get name from variable declaration
      const varDecl = findAncestor(func, SyntaxKind.VariableDeclaration);
      if (varDecl && Node.isVariableDeclaration(varDecl)) {
        context.functionName = varDecl.getName();
      }
      context.isAsync = func.isAsync();
    }
  }

  // Check for class context
  const classDecl = findAncestor(node, SyntaxKind.ClassDeclaration);
  if (classDecl && Node.isClassDeclaration(classDecl)) {
    context.className = classDecl.getName();
  }

  // Check for try-catch context
  context.inTryCatch = !!findAncestor(node, SyntaxKind.TryStatement);

  return context;
}

// ============================================================================
// SYNTAX VALIDATION
// ============================================================================

/**
 * Validate TypeScript/JavaScript syntax
 *
 * @returns true if code has no syntax errors
 */
export function hasValidSyntax(sourceFile: SourceFile): boolean {
  const diagnostics = sourceFile.getPreEmitDiagnostics();
  const syntaxErrors = diagnostics.filter(
    (d) => d.getCategory() === DiagnosticCategory.Error,
  );

  return syntaxErrors.length === 0;
}

/**
 * Get syntax errors from source file
 *
 * @returns Array of syntax errors with line/column info
 */
export function getSyntaxErrors(sourceFile: SourceFile): SyntaxError[] {
  const diagnostics = sourceFile.getPreEmitDiagnostics();
  const errors = diagnostics.filter(
    (d) => d.getCategory() === DiagnosticCategory.Error,
  );

  return errors.map((error) => {
    const start = error.getStart();
    const lineAndCol = start
      ? sourceFile.getLineAndColumnAtPos(start)
      : { line: 0, column: 0 };

    return {
      line: lineAndCol.line,
      column: lineAndCol.column,
      message: error.getMessageText().toString(),
      code: error.getCode()?.toString(),
    };
  });
}

// ============================================================================
// NODE UTILITIES
// ============================================================================

/**
 * Get the containing function body for a node
 */
export function getContainingFunctionBody(node: Node): Node | undefined {
  const func = findAncestorWhere(node, (n) => {
    const kind = n.getKind();
    return (
      kind === SyntaxKind.FunctionDeclaration ||
      kind === SyntaxKind.FunctionExpression ||
      kind === SyntaxKind.ArrowFunction ||
      kind === SyntaxKind.MethodDeclaration
    );
  });

  if (!func) return undefined;

  if (Node.isFunctionDeclaration(func) || Node.isMethodDeclaration(func)) {
    return func.getBody();
  }

  if (Node.isArrowFunction(func) || Node.isFunctionExpression(func)) {
    return func.getBody();
  }

  return undefined;
}

/**
 * Get line number range for a node
 */
export function getLineRange(node: Node): { start: number; end: number } {
  return {
    start: node.getStartLineNumber(),
    end: node.getEndLineNumber(),
  };
}
