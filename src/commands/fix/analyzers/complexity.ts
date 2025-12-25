/**
 * @module commands/quality/analyzers/complexity
 * @description Cyclomatic complexity calculation and function extraction
 *
 * Uses AST-based analysis for accurate complexity counting:
 * - Ignores keywords in strings/comments
 * - Properly handles nested structures
 * - Accurate function boundary detection
 */

import { Node, type SourceFile, SyntaxKind } from 'ts-morph';
import { astPool } from '@/lib/@ast';
import type { FunctionInfo, SplitSuggestion } from '../types';

// ============================================================================
// AST-BASED CYCLOMATIC COMPLEXITY
// ============================================================================

/**
 * SyntaxKinds that increase cyclomatic complexity
 */
const COMPLEXITY_SYNTAX_KINDS = new Set([
  SyntaxKind.IfStatement, // if
  SyntaxKind.ForStatement, // for
  SyntaxKind.ForInStatement, // for...in
  SyntaxKind.ForOfStatement, // for...of
  SyntaxKind.WhileStatement, // while
  SyntaxKind.DoStatement, // do...while
  SyntaxKind.CaseClause, // switch case
  SyntaxKind.CatchClause, // catch
  SyntaxKind.ConditionalExpression, // ternary ? :
]);

/**
 * Binary operators that add to complexity
 */
const COMPLEXITY_OPERATORS = new Set([
  SyntaxKind.AmpersandAmpersandToken, // &&
  SyntaxKind.BarBarToken, // ||
  SyntaxKind.QuestionQuestionToken, // ??
]);

/**
 * Calculate cyclomatic complexity using AST (accurate, ignores strings/comments)
 *
 * Base complexity is 1, each decision point adds 1:
 * - if, for, while, do, case, catch statements
 * - ternary operators
 * - && || ?? operators
 */
export function calculateComplexity(code: string): number {
  try {
    const [sourceFile, cleanup] = astPool.createSourceFile(code, 'temp.ts');
    try {
      return calculateComplexityFromAST(sourceFile);
    } finally {
      cleanup();
    }
  } catch {
    // Fallback to regex for invalid code
    return calculateComplexityRegex(code);
  }
}

/**
 * Calculate complexity from AST nodes
 */
function calculateComplexityFromAST(sourceFile: SourceFile): number {
  let complexity = 1; // Base complexity

  // Count decision point nodes
  sourceFile.forEachDescendant((node) => {
    const kind = node.getKind();

    // Direct decision points
    if (COMPLEXITY_SYNTAX_KINDS.has(kind)) {
      complexity++;
    }

    // Binary expressions with && || ??
    if (Node.isBinaryExpression(node)) {
      const operator = node.getOperatorToken().getKind();
      if (COMPLEXITY_OPERATORS.has(operator)) {
        complexity++;
      }
    }
  });

  return complexity;
}

/**
 * Calculate complexity inline from a node (avoids creating new source file)
 * Use this when you already have an AST node to avoid N+1 source file creations
 */
function calculateComplexityInline(node: Node): number {
  let complexity = 1; // Base complexity

  // Count decision point nodes in the node and its descendants
  node.forEachDescendant((child) => {
    const kind = child.getKind();

    // Direct decision points
    if (COMPLEXITY_SYNTAX_KINDS.has(kind)) {
      complexity++;
    }

    // Binary expressions with && || ??
    if (Node.isBinaryExpression(child)) {
      const operator = child.getOperatorToken().getKind();
      if (COMPLEXITY_OPERATORS.has(operator)) {
        complexity++;
      }
    }
  });

  return complexity;
}

/**
 * Regex fallback for complexity calculation (less accurate)
 */
const COMPLEXITY_PATTERNS = [
  /\bif\s*\(/g,
  /\bfor\s*\(/g,
  /\bwhile\s*\(/g,
  /\bdo\s*\{/g,
  /\bcase\s+[^:]+:/g,
  /\bcatch\s*\(/g,
  /\?\s*[^:]+:/g,
  /&&/g,
  /\|\|/g,
  /\?\?/g,
];

function calculateComplexityRegex(code: string): number {
  let complexity = 1;

  for (const pattern of COMPLEXITY_PATTERNS) {
    const matches = code.match(pattern);
    if (matches) {
      complexity += matches.length;
    }
  }

  return complexity;
}

// ============================================================================
// SPLIT POINT ANALYSIS
// ============================================================================

const MIN_BLOCK_LINES = 5;
const MIN_BLOCK_COMPLEXITY = 2;

/**
 * Analyze a function body for potential split points
 */
export function analyzeSplitPoints(
  bodyText: string,
  functionName: string,
  baseLineOffset: number = 0,
): SplitSuggestion[] {
  const suggestions: SplitSuggestion[] = [];

  try {
    const [sourceFile, cleanup] = astPool.createSourceFile(
      `function __wrapper__() ${bodyText}`,
      'body.ts',
    );

    try {
      // Find the wrapper function body
      const wrapper = sourceFile.getFirstDescendantByKind(SyntaxKind.FunctionDeclaration);
      if (!wrapper) return suggestions;

      const body = wrapper.getBody();
      if (!body || !Node.isBlock(body)) return suggestions;

      // Analyze direct children of function body
      const statements = body.getStatements();

      for (const stmt of statements) {
        const suggestion = analyzeStatement(stmt, functionName, baseLineOffset);
        if (suggestion) {
          suggestions.push(suggestion);
        }
      }

      // Sort by complexity (highest first)
      suggestions.sort((a, b) => b.complexity - a.complexity);

      // Return top 3 suggestions
      return suggestions.slice(0, 3);
    } finally {
      cleanup();
    }
  } catch {
    return suggestions;
  }
}

/**
 * Analyze a single statement for extraction potential
 */
function analyzeStatement(
  stmt: Node,
  parentName: string,
  lineOffset: number,
): SplitSuggestion | null {
  const startLine = stmt.getStartLineNumber() + lineOffset - 1;
  const endLine = stmt.getEndLineNumber() + lineOffset - 1;
  const lines = endLine - startLine + 1;

  // Skip small blocks
  if (lines < MIN_BLOCK_LINES) return null;

  // Calculate complexity inline from the statement node (avoids creating temp file)
  const complexity = calculateComplexityInline(stmt);

  // Skip low-complexity blocks
  if (complexity < MIN_BLOCK_COMPLEXITY) return null;

  // If statement
  if (Node.isIfStatement(stmt)) {
    const condition = stmt.getExpression().getText().slice(0, 30);
    return {
      startLine,
      endLine,
      type: 'if-block',
      suggestedName: generateName(parentName, 'handle', condition),
      complexity,
      reason: `if-block with ${complexity} branches (lines ${startLine}-${endLine})`,
    };
  }

  // For/While loops
  if (
    Node.isForStatement(stmt) ||
    Node.isForOfStatement(stmt) ||
    Node.isForInStatement(stmt) ||
    Node.isWhileStatement(stmt)
  ) {
    return {
      startLine,
      endLine,
      type: 'loop',
      suggestedName: generateName(parentName, 'process', 'items'),
      complexity,
      reason: `loop with ${complexity} branches (lines ${startLine}-${endLine})`,
    };
  }

  // Switch statement
  if (Node.isSwitchStatement(stmt)) {
    const expr = stmt.getExpression().getText().slice(0, 20);
    return {
      startLine,
      endLine,
      type: 'switch',
      suggestedName: generateName(parentName, 'handle', expr),
      complexity,
      reason: `switch with ${complexity} cases (lines ${startLine}-${endLine})`,
    };
  }

  // Try-catch
  if (Node.isTryStatement(stmt)) {
    return {
      startLine,
      endLine,
      type: 'try-catch',
      suggestedName: generateName(parentName, 'tryExecute', ''),
      complexity,
      reason: `try-catch block (lines ${startLine}-${endLine})`,
    };
  }

  return null;
}

/**
 * Generate a suggested function name
 */
function generateName(parentName: string, action: string, context: string): string {
  // Clean up context
  const clean = context
    .replace(/[^a-zA-Z0-9]/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w, i) =>
      i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join('');

  if (clean) {
    return `${action}${clean.charAt(0).toUpperCase()}${clean.slice(1)}`;
  }

  // Use parent name as context
  const parentContext = parentName.replace(/^(run|handle|process|do|execute)/, '');
  return `${action}${parentContext || 'Block'}`;
}

// ============================================================================
// AST-BASED FUNCTION EXTRACTION
// ============================================================================

/**
 * Extract function information from file content using AST
 *
 * Finds all function types:
 * - function declarations (function foo() {})
 * - arrow functions (const foo = () => {})
 * - function expressions (const foo = function() {})
 * - method declarations (class methods)
 */
export function extractFunctions(content: string): FunctionInfo[] {
  try {
    const [sourceFile, cleanup] = astPool.createSourceFile(content, 'temp.ts');

    try {
      const functions: FunctionInfo[] = [];

      // Function declarations
      const funcDecls = sourceFile.getDescendantsOfKind(SyntaxKind.FunctionDeclaration);

      for (const func of funcDecls) {
        const name = func.getName() || 'anonymous';
        const startLine = func.getStartLineNumber();
        const endLine = func.getEndLineNumber();
        const body = func.getBody();

        // Calculate complexity inline from body node (avoids creating temp file)
        const complexity = body ? calculateComplexityInline(body) : 1;

        const funcInfo: FunctionInfo = {
          name,
          startLine,
          endLine,
          lines: endLine - startLine + 1,
          params: func.getParameters().length,
          isExported: func.isExported(),
          isAsync: func.isAsync(),
          hasJSDoc: func.getJsDocs().length > 0,
          complexity,
        };

        // Add split suggestions for complex functions
        if (complexity > 10 && body) {
          const bodyText = body.getText();
          const suggestions = analyzeSplitPoints(bodyText, name, startLine);
          if (suggestions.length > 0) {
            funcInfo.splitSuggestions = suggestions;
          }
        }

        functions.push(funcInfo);
      }

      // Arrow functions and function expressions in variable declarations
      const varDecls = sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration);

      for (const varDecl of varDecls) {
        const init = varDecl.getInitializer();
        if (!init) continue;

        // Arrow function or function expression
        if (Node.isArrowFunction(init) || Node.isFunctionExpression(init)) {
          const name = varDecl.getName();
          const startLine = varDecl.getStartLineNumber();
          const endLine = init.getEndLineNumber();
          const body = init.getBody();

          // Check if exported
          const varStmt = varDecl.getFirstAncestorByKind(SyntaxKind.VariableStatement);
          const isExported = varStmt?.isExported() || false;

          // Calculate complexity inline from body node (avoids creating temp file)
          const complexity = body ? calculateComplexityInline(body) : 1;

          const funcInfo: FunctionInfo = {
            name,
            startLine,
            endLine,
            lines: endLine - startLine + 1,
            params: init.getParameters().length,
            isExported,
            isAsync: init.isAsync(),
            hasJSDoc: varStmt?.getJsDocs?.()?.length ? varStmt.getJsDocs().length > 0 : false,
            complexity,
          };

          // Add split suggestions for complex functions
          if (complexity > 10 && body) {
            const bodyText = body.getText();
            const suggestions = analyzeSplitPoints(bodyText, name, startLine);
            if (suggestions.length > 0) {
              funcInfo.splitSuggestions = suggestions;
            }
          }

          functions.push(funcInfo);
        }
      }

      // Method declarations in classes
      const methods = sourceFile.getDescendantsOfKind(SyntaxKind.MethodDeclaration);

      for (const method of methods) {
        const name = method.getName();
        const startLine = method.getStartLineNumber();
        const endLine = method.getEndLineNumber();
        const body = method.getBody();

        // Check if parent class is exported
        const parentClass = method.getFirstAncestorByKind(SyntaxKind.ClassDeclaration);
        const isExported = parentClass?.isExported() || false;

        // Calculate complexity inline from body node (avoids creating temp file)
        const complexity = body ? calculateComplexityInline(body) : 1;

        const funcInfo: FunctionInfo = {
          name,
          startLine,
          endLine,
          lines: endLine - startLine + 1,
          params: method.getParameters().length,
          isExported,
          isAsync: method.isAsync(),
          hasJSDoc: method.getJsDocs().length > 0,
          complexity,
        };

        // Add split suggestions for complex functions
        if (complexity > 10 && body) {
          const bodyText = body.getText();
          const suggestions = analyzeSplitPoints(bodyText, name, startLine);
          if (suggestions.length > 0) {
            funcInfo.splitSuggestions = suggestions;
          }
        }

        functions.push(funcInfo);
      }

      // Sort by start line
      return functions.sort((a, b) => a.startLine - b.startLine);
    } finally {
      cleanup();
    }
  } catch {
    // Fallback to regex-based extraction
    return extractFunctionsRegex(content);
  }
}

/**
 * Regex fallback for function extraction
 */
function extractFunctionsRegex(content: string): FunctionInfo[] {
  const functions: FunctionInfo[] = [];
  const lines = content.split('\n');

  const FUNCTION_PATTERNS = [
    /^(export\s+)?(async\s+)?function\s+(\w+)\s*\(([^)]*)\)/,
    /^(export\s+)?const\s+(\w+)\s*=\s*(async\s+)?\([^)]*\)\s*=>/,
    /^(export\s+)?const\s+(\w+)\s*=\s*(async\s+)?function\s*\([^)]*\)/,
  ];

  let braceDepth = 0;
  let currentFunction: Partial<FunctionInfo> | null = null;
  let hasJSDoc = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();

    if (trimmed.startsWith('/**')) {
      hasJSDoc = true;
    }

    if (!currentFunction) {
      for (const pattern of FUNCTION_PATTERNS) {
        const match = line.match(pattern);
        if (match) {
          const name = match[3] || match[2] || 'anonymous';
          const params = (match[4] || '').split(',').filter(Boolean).length;

          currentFunction = {
            name,
            startLine: i + 1,
            isExported: line.includes('export'),
            isAsync: line.includes('async'),
            hasJSDoc,
            params,
          };
          hasJSDoc = false;
          break;
        }
      }
    }

    for (const char of line) {
      if (char === '{') braceDepth++;
      if (char === '}') braceDepth--;
    }

    if (currentFunction && braceDepth === 0 && line.includes('}')) {
      const startLine = currentFunction.startLine!;
      const endLine = i + 1;
      const functionBody = lines.slice(startLine - 1, endLine).join('\n');

      functions.push({
        name: currentFunction.name!,
        startLine,
        endLine,
        lines: endLine - startLine,
        params: currentFunction.params || 0,
        isExported: currentFunction.isExported || false,
        isAsync: currentFunction.isAsync || false,
        hasJSDoc: currentFunction.hasJSDoc || false,
        complexity: calculateComplexityRegex(functionBody),
      });
      currentFunction = null;
    }
  }

  return functions;
}
