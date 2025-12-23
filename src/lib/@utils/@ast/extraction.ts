/**
 * @module lib/ast/extraction
 * @description Code extraction utilities
 *
 * Provides utilities for extracting information from AST:
 * - Import/export statements
 * - Function declarations
 * - Variable usage
 */

import {
  Node,
  SyntaxKind,
  type SourceFile,
} from 'ts-morph';

// ============================================================================
// TYPES
// ============================================================================

export interface ImportInfo {
  /** Module specifier (e.g., 'react', './utils') */
  module: string;
  /** Named imports (e.g., ['useState', 'useEffect']) */
  namedImports: string[];
  /** Default import name if any */
  defaultImport?: string;
  /** Namespace import (e.g., '* as React') */
  namespaceImport?: string;
  /** Whether type-only import */
  isTypeOnly: boolean;
  /** Line number */
  line: number;
}

export interface ExportInfo {
  /** Export name */
  name: string;
  /** Whether default export */
  isDefault: boolean;
  /** Whether type-only export */
  isTypeOnly: boolean;
  /** Kind of export (function, class, variable, etc.) */
  kind: 'function' | 'class' | 'variable' | 'type' | 'interface' | 'unknown';
  /** Line number */
  line: number;
}

export interface FunctionInfo {
  /** Function name */
  name: string;
  /** Start line */
  startLine: number;
  /** End line */
  endLine: number;
  /** Number of parameters */
  paramCount: number;
  /** Whether async */
  isAsync: boolean;
  /** Whether exported */
  isExported: boolean;
  /** Whether has JSDoc */
  hasJsDoc: boolean;
}

export interface VariableUsage {
  /** Variable name */
  name: string;
  /** Where it's used (line numbers) */
  usages: number[];
  /** Where it's declared (line number) */
  declaration?: number;
}

// ============================================================================
// IMPORT EXTRACTION
// ============================================================================

/**
 * Extract all imports from a source file
 */
export function extractImports(sourceFile: SourceFile): ImportInfo[] {
  const imports: ImportInfo[] = [];
  const importDeclarations = sourceFile.getImportDeclarations();

  for (const imp of importDeclarations) {
    const moduleSpecifier = imp.getModuleSpecifierValue();
    const namedImports: string[] = [];
    let defaultImport: string | undefined;
    let namespaceImport: string | undefined;

    // Get default import
    const defaultImportNode = imp.getDefaultImport();
    if (defaultImportNode) {
      defaultImport = defaultImportNode.getText();
    }

    // Get namespace import
    const namespaceImportNode = imp.getNamespaceImport();
    if (namespaceImportNode) {
      namespaceImport = namespaceImportNode.getText();
    }

    // Get named imports
    const namedImportNodes = imp.getNamedImports();
    for (const named of namedImportNodes) {
      namedImports.push(named.getName());
    }

    imports.push({
      module: moduleSpecifier,
      namedImports,
      ...(defaultImport ? { defaultImport } : {}),
      ...(namespaceImport ? { namespaceImport } : {}),
      isTypeOnly: imp.isTypeOnly(),
      line: imp.getStartLineNumber(),
    });
  }

  return imports;
}

/**
 * Get all imported module names
 */
export function getImportedModules(sourceFile: SourceFile): string[] {
  return sourceFile
    .getImportDeclarations()
    .map((imp) => imp.getModuleSpecifierValue());
}

// ============================================================================
// EXPORT EXTRACTION
// ============================================================================

/**
 * Extract all exports from a source file
 */
export function extractExports(sourceFile: SourceFile): ExportInfo[] {
  const exports: ExportInfo[] = [];

  // Exported declarations (export function, export class, etc.)
  const exportedDeclarations = sourceFile.getExportedDeclarations();

  for (const [name, declarations] of exportedDeclarations) {
    for (const decl of declarations) {
      let kind: ExportInfo['kind'] = 'unknown';

      if (Node.isFunctionDeclaration(decl)) {
        kind = 'function';
      } else if (Node.isClassDeclaration(decl)) {
        kind = 'class';
      } else if (Node.isVariableDeclaration(decl)) {
        kind = 'variable';
      } else if (Node.isTypeAliasDeclaration(decl)) {
        kind = 'type';
      } else if (Node.isInterfaceDeclaration(decl)) {
        kind = 'interface';
      }

      exports.push({
        name,
        isDefault: false, // Will be updated below
        isTypeOnly: Node.isTypeAliasDeclaration(decl) || Node.isInterfaceDeclaration(decl),
        kind,
        line: decl.getStartLineNumber(),
      });
    }
  }

  // Check for default export
  const defaultExportSymbol = sourceFile.getDefaultExportSymbol();
  if (defaultExportSymbol) {
    const existing = exports.find((e) => e.name === 'default');
    if (existing) {
      existing.isDefault = true;
    } else {
      exports.push({
        name: 'default',
        isDefault: true,
        isTypeOnly: false,
        kind: 'unknown',
        line: 0,
      });
    }
  }

  return exports;
}

// ============================================================================
// FUNCTION EXTRACTION
// ============================================================================

/**
 * Extract all functions from a source file
 */
export function extractFunctions(sourceFile: SourceFile): FunctionInfo[] {
  const functions: FunctionInfo[] = [];

  // Regular function declarations
  const funcDecls = sourceFile.getFunctions();
  for (const func of funcDecls) {
    functions.push({
      name: func.getName() || 'anonymous',
      startLine: func.getStartLineNumber(),
      endLine: func.getEndLineNumber(),
      paramCount: func.getParameters().length,
      isAsync: func.isAsync(),
      isExported: func.isExported(),
      hasJsDoc: func.getJsDocs().length > 0,
    });
  }

  // Arrow functions in variable declarations
  const varDecls = sourceFile.getVariableDeclarations();
  for (const varDecl of varDecls) {
    const init = varDecl.getInitializer();
    if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) {
      const varStmt = varDecl.getFirstAncestorByKind(SyntaxKind.VariableStatement);

      functions.push({
        name: varDecl.getName(),
        startLine: varDecl.getStartLineNumber(),
        endLine: init.getEndLineNumber(),
        paramCount: init.getParameters().length,
        isAsync: init.isAsync(),
        isExported: varStmt?.isExported() ?? false,
        hasJsDoc: varStmt?.getJsDocs()?.length ? varStmt.getJsDocs().length > 0 : false,
      });
    }
  }

  // Class methods
  const classDecls = sourceFile.getClasses();
  for (const classDecl of classDecls) {
    const methods = classDecl.getMethods();
    for (const method of methods) {
      functions.push({
        name: `${classDecl.getName()}.${method.getName()}`,
        startLine: method.getStartLineNumber(),
        endLine: method.getEndLineNumber(),
        paramCount: method.getParameters().length,
        isAsync: method.isAsync(),
        isExported: classDecl.isExported(),
        hasJsDoc: method.getJsDocs().length > 0,
      });
    }
  }

  return functions.sort((a, b) => a.startLine - b.startLine);
}

// ============================================================================
// VARIABLE ANALYSIS
// ============================================================================

/**
 * Find all variables used in a code block
 */
export function findUsedVariables(code: string): string[] {
  // Match identifiers that look like variable names
  const identifierPattern = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g;
  const matches = new Set<string>();

  // Keywords to exclude
  const keywords = new Set([
    'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue',
    'return', 'throw', 'try', 'catch', 'finally', 'new', 'delete', 'typeof',
    'instanceof', 'in', 'void', 'this', 'super', 'class', 'extends', 'function',
    'const', 'let', 'var', 'import', 'export', 'default', 'from', 'as',
    'async', 'await', 'yield', 'true', 'false', 'null', 'undefined',
    'NaN', 'Infinity', 'arguments', 'eval',
  ]);

  let match;
  while ((match = identifierPattern.exec(code)) !== null) {
    const name = match[1];
    if (name && !keywords.has(name)) {
      matches.add(name);
    }
  }

  return Array.from(matches);
}

/**
 * Find all variables declared in a code block
 */
export function findDeclaredVariables(code: string): string[] {
  const declared = new Set<string>();

  // const/let/var declarations
  const varPattern = /\b(?:const|let|var)\s+(?:\{([^}]+)\}|([a-zA-Z_$][a-zA-Z0-9_$]*))/g;
  let match;

  while ((match = varPattern.exec(code)) !== null) {
    if (match[1]) {
      // Destructuring
      const names = match[1].split(',').map((s) => s.trim().split(':')[0]?.trim());
      names.filter(Boolean).forEach((n) => n && declared.add(n));
    } else if (match[2]) {
      declared.add(match[2]);
    }
  }

  // Function parameters
  const paramPattern = /function\s*\w*\s*\(([^)]*)\)/g;
  while ((match = paramPattern.exec(code)) !== null) {
    if (match[1]) {
      const params = match[1].split(',').map((s) => s.trim().split(/[=:]/)[0]?.trim());
      params.filter(Boolean).forEach((p) => p && declared.add(p));
    }
  }

  // Arrow function parameters
  const arrowPattern = /\(([^)]*)\)\s*=>/g;
  while ((match = arrowPattern.exec(code)) !== null) {
    if (match[1]) {
      const params = match[1].split(',').map((s) => s.trim().split(/[=:]/)[0]?.trim());
      params.filter(Boolean).forEach((p) => p && declared.add(p));
    }
  }

  return Array.from(declared);
}

/**
 * Find variables that are modified (assigned to) in a code block
 */
export function findModifiedVariables(
  code: string,
  declaredVars: string[],
): string[] {
  const modified = new Set<string>();

  // Assignment patterns
  const assignPattern = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?:=(?!=)|[+\-*/%]=|\+\+|--)/g;

  let match;
  while ((match = assignPattern.exec(code)) !== null) {
    const name = match[1];
    if (name && declaredVars.includes(name)) {
      modified.add(name);
    }
  }

  return Array.from(modified);
}
