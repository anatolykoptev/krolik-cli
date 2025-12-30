/**
 * @module commands/fix/analyzers/complexity-swc
 * @description SWC-based cyclomatic complexity calculation and function extraction
 *
 * Uses cached parseFile from @/lib/@swc for:
 * - Faster parsing (no type checking overhead)
 * - Lower memory usage (no persistent AST)
 * - Caching to avoid redundant parsing (4x → 1x)
 * - Accurate complexity counting via AST visitor pattern
 *
 * Features:
 * - Ignores keywords in strings/comments
 * - Properly handles nested structures
 * - Accurate function boundary detection
 * - JSDoc detection via comments array
 * - Export detection via parent node checking
 */

import type { Node, Span } from '@swc/core';
import { offsetToLine, parseFile, visitNode } from '@/lib/@ast/swc';
import type { FunctionInfo, SplitSuggestion } from '../core';

// ============================================================================
// TYPES
// ============================================================================

/**
 * SWC node with common properties
 */
interface BaseNode {
  type: string;
  span?: Span;
}

/**
 * Binary expression node
 */
interface BinaryExpression extends BaseNode {
  type: 'BinaryExpression';
  operator: string;
  left: Node;
  right: Node;
}

/**
 * If statement node
 */
interface IfStatement extends BaseNode {
  type: 'IfStatement';
  test: Node;
  consequent: Node;
  alternate?: Node;
}

/**
 * Function declaration node
 */
interface FunctionDeclaration extends BaseNode {
  type: 'FunctionDeclaration';
  identifier?: Identifier;
  params: Node[];
  body?: BlockStatement;
  async?: boolean;
  generator?: boolean;
}

/**
 * Arrow function expression
 */
interface ArrowFunctionExpression extends BaseNode {
  type: 'ArrowFunctionExpression';
  params: Node[];
  body: Node;
  async?: boolean;
  generator?: boolean;
}

/**
 * Function expression
 */
interface FunctionExpression extends BaseNode {
  type: 'FunctionExpression';
  identifier?: Identifier;
  params: Node[];
  body?: BlockStatement;
  async?: boolean;
  generator?: boolean;
}

/**
 * Variable declarator
 */
interface VariableDeclarator extends BaseNode {
  type: 'VariableDeclarator';
  id: Node;
  init?: Node;
}

/**
 * Variable declaration
 */
interface VariableDeclaration extends BaseNode {
  type: 'VariableDeclaration';
  kind: 'var' | 'let' | 'const';
  declarations: VariableDeclarator[];
}

/**
 * Export declaration
 */
interface ExportDeclaration extends BaseNode {
  type: 'ExportDeclaration';
  declaration?: Node;
}

/**
 * Block statement
 */
interface BlockStatement extends BaseNode {
  type: 'BlockStatement';
  stmts: Node[];
}

/**
 * Identifier node
 */
interface Identifier extends BaseNode {
  type: 'Identifier';
  value: string;
}

/**
 * Class method
 */
interface ClassMethod extends BaseNode {
  type: 'ClassMethod';
  key: Node;
  params: Node[];
  body?: BlockStatement;
  function: {
    params: Node[];
    body?: BlockStatement;
    async?: boolean;
    generator?: boolean;
  };
  isAsync?: boolean;
  isGenerator?: boolean;
}

/**
 * Class declaration
 */
interface ClassDeclaration extends BaseNode {
  type: 'ClassDeclaration';
  identifier: Identifier;
  body: ClassMethod[];
}

/**
 * Switch statement
 */
interface SwitchStatement extends BaseNode {
  type: 'SwitchStatement';
  discriminant: Node;
  cases: SwitchCase[];
}

/**
 * Switch case
 */
interface SwitchCase extends BaseNode {
  type: 'SwitchCase';
  test?: Node;
  consequent: Node[];
}

/**
 * Comment node
 */
interface Comment {
  type: 'CommentLine' | 'CommentBlock';
  value: string;
  span: Span;
}

// ============================================================================
// AST-BASED CYCLOMATIC COMPLEXITY
// ============================================================================

/**
 * Node types that increase cyclomatic complexity
 */
const COMPLEXITY_NODE_TYPES = new Set([
  'IfStatement',
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'WhileStatement',
  'DoWhileStatement',
  'SwitchCase', // Each case in switch
  'CatchClause',
  'ConditionalExpression', // Ternary ? :
]);

/**
 * Binary operators that add to complexity
 */
const COMPLEXITY_OPERATORS = new Set(['&&', '||', '??']);

/**
 * Calculate cyclomatic complexity using SWC AST (accurate, ignores strings/comments)
 *
 * Base complexity is 1, each decision point adds 1:
 * - if, for, while, do, case, catch statements
 * - ternary operators
 * - && || ?? operators
 *
 * @param code - Code to analyze
 * @returns Cyclomatic complexity score
 */
export function calculateComplexitySwc(code: string): number {
  try {
    const { ast } = parseFile('complexity.tsx', code);

    return calculateComplexityFromAST(ast);
  } catch {
    // Fallback to regex for invalid code
    return calculateComplexityRegex(code);
  }
}

/**
 * Calculate complexity from AST nodes
 */
function calculateComplexityFromAST(ast: Node): number {
  let complexity = 1; // Base complexity

  // Visit all nodes and count decision points
  visitNode(ast, (node, _context) => {
    const baseNode = node as BaseNode;
    const nodeType = baseNode.type;

    // Direct decision points
    if (COMPLEXITY_NODE_TYPES.has(nodeType)) {
      complexity++;
    }

    // Binary expressions with && || ??
    if (nodeType === 'BinaryExpression') {
      const binaryExpr = node as BinaryExpression;
      if (COMPLEXITY_OPERATORS.has(binaryExpr.operator)) {
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
 *
 * @param bodyText - Function body text (including braces)
 * @param functionName - Name of the function being analyzed
 * @param baseLineOffset - Line offset in original file
 * @returns Array of split suggestions
 */
export function analyzeSplitPointsSwc(
  bodyText: string,
  functionName: string,
  baseLineOffset: number = 0,
): SplitSuggestion[] {
  const suggestions: SplitSuggestion[] = [];

  try {
    // Parse as a function wrapper to get proper body analysis
    const code = `function __wrapper__() ${bodyText}`;
    const { ast, lineOffsets } = parseFile('split-analysis.tsx', code);

    // Find the wrapper function
    let wrapperBody: BlockStatement | undefined;
    visitNode(ast, (node, _context) => {
      const baseNode = node as BaseNode;
      if (baseNode.type === 'FunctionDeclaration') {
        const funcDecl = node as FunctionDeclaration;
        wrapperBody = funcDecl.body;
      }
    });

    if (!wrapperBody) return suggestions;

    // Analyze direct children of function body
    for (const stmt of wrapperBody.stmts) {
      const suggestion = analyzeStatement(stmt, functionName, baseLineOffset, lineOffsets, code);
      if (suggestion) {
        suggestions.push(suggestion);
      }
    }

    // Sort by complexity (highest first)
    suggestions.sort((a, b) => b.complexity - a.complexity);

    // Return top 3 suggestions
    return suggestions.slice(0, 3);
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
  lineOffsets: number[],
  fullCode: string,
): SplitSuggestion | null {
  const baseNode = stmt as BaseNode;
  const span = baseNode.span;
  if (!span) return null;

  const startLine = offsetToLine(span.start, lineOffsets) + lineOffset - 1;
  const endLine = offsetToLine(span.end, lineOffsets) + lineOffset - 1;
  const lines = endLine - startLine + 1;

  // Skip small blocks
  if (lines < MIN_BLOCK_LINES) return null;

  // Get statement text
  const stmtText = fullCode.slice(span.start, span.end);
  const complexity = calculateComplexitySwc(stmtText);

  // Skip low-complexity blocks
  if (complexity < MIN_BLOCK_COMPLEXITY) return null;

  const nodeType = baseNode.type;

  // If statement
  if (nodeType === 'IfStatement') {
    const ifStmt = stmt as IfStatement;
    const condition = fullCode
      .slice((ifStmt.test as BaseNode).span?.start ?? 0, (ifStmt.test as BaseNode).span?.end ?? 0)
      .slice(0, 30);
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
    nodeType === 'ForStatement' ||
    nodeType === 'ForOfStatement' ||
    nodeType === 'ForInStatement' ||
    nodeType === 'WhileStatement'
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
  if (nodeType === 'SwitchStatement') {
    const switchStmt = stmt as SwitchStatement;
    const expr = fullCode
      .slice(
        (switchStmt.discriminant as BaseNode).span?.start ?? 0,
        (switchStmt.discriminant as BaseNode).span?.end ?? 0,
      )
      .slice(0, 20);
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
  if (nodeType === 'TryStatement') {
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
 * Extract function information from file content using SWC AST
 *
 * Finds all function types:
 * - function declarations (function foo() {})
 * - arrow functions (const foo = () => {})
 * - function expressions (const foo = function() {})
 * - method declarations (class methods)
 *
 * @param content - File content to analyze
 * @returns Array of function information
 */
export function extractFunctionsSwc(content: string): FunctionInfo[] {
  try {
    const { ast, lineOffsets } = parseFile('functions.tsx', content);

    const functions: FunctionInfo[] = [];

    // Collect all comments for JSDoc detection
    const comments: Comment[] = (ast as { type: string; comments?: Comment[] }).comments || [];
    const jsDocLineNumbers = new Set<number>();

    // Build JSDoc line number set
    for (const comment of comments) {
      if (comment.type === 'CommentBlock' && comment.value.trim().startsWith('*')) {
        const commentLine = offsetToLine(comment.span.start, lineOffsets);
        jsDocLineNumbers.add(commentLine);
      }
    }

    // Track export declarations for export detection
    const exportedDeclarations = new Set<string>();

    // First pass: collect exported declarations
    visitNode(ast, (node, _context) => {
      const baseNode = node as BaseNode;

      if (baseNode.type === 'ExportDeclaration') {
        const exportDecl = node as ExportDeclaration;
        if (exportDecl.declaration) {
          collectExportedNames(exportDecl.declaration, exportedDeclarations);
        }
      }

      if (baseNode.type === 'ExportDefaultDeclaration') {
        exportedDeclarations.add('__default__');
      }
    });

    // Second pass: extract function information
    visitNode(ast, (node, _context) => {
      const baseNode = node as BaseNode;
      const nodeType = baseNode.type;

      // Function declarations
      if (nodeType === 'FunctionDeclaration') {
        const funcDecl = node as FunctionDeclaration;
        const funcInfo = extractFunctionDeclaration(
          funcDecl,
          content,
          lineOffsets,
          jsDocLineNumbers,
          exportedDeclarations,
        );
        if (funcInfo) functions.push(funcInfo);
      }

      // Variable declarations (for arrow functions and function expressions)
      if (nodeType === 'VariableDeclaration') {
        const varDecl = node as VariableDeclaration;
        for (const declarator of varDecl.declarations) {
          const funcInfo = extractVariableFunction(
            declarator,
            content,
            lineOffsets,
            jsDocLineNumbers,
            exportedDeclarations,
          );
          if (funcInfo) functions.push(funcInfo);
        }
      }

      // Class methods
      if (nodeType === 'ClassMethod') {
        const classMethod = node as ClassMethod;
        const funcInfo = extractClassMethod(
          classMethod,
          content,
          lineOffsets,
          jsDocLineNumbers,
          exportedDeclarations,
        );
        if (funcInfo) functions.push(funcInfo);
      }
    });

    // Sort by start line
    return functions.sort((a, b) => a.startLine - b.startLine);
  } catch {
    // Fallback to regex-based extraction
    return extractFunctionsRegex(content);
  }
}

/**
 * Collect exported declaration names
 */
function collectExportedNames(declaration: Node, exportedSet: Set<string>): void {
  const baseNode = declaration as BaseNode;

  if (baseNode.type === 'FunctionDeclaration') {
    const funcDecl = declaration as FunctionDeclaration;
    if (funcDecl.identifier) {
      exportedSet.add(funcDecl.identifier.value);
    }
  }

  if (baseNode.type === 'VariableDeclaration') {
    const varDecl = declaration as VariableDeclaration;
    for (const declarator of varDecl.declarations) {
      if ((declarator.id as BaseNode).type === 'Identifier') {
        exportedSet.add((declarator.id as Identifier).value);
      }
    }
  }

  if (baseNode.type === 'ClassDeclaration') {
    const classDecl = declaration as ClassDeclaration;
    exportedSet.add(classDecl.identifier.value);
  }
}

/**
 * Extract function declaration information
 */
function extractFunctionDeclaration(
  funcDecl: FunctionDeclaration,
  content: string,
  lineOffsets: number[],
  jsDocLines: Set<number>,
  exportedDeclarations: Set<string>,
): FunctionInfo | null {
  const span = funcDecl.span;
  if (!span) return null;

  const name = funcDecl.identifier?.value || 'anonymous';
  const startLine = offsetToLine(span.start, lineOffsets);
  const endLine = offsetToLine(span.end, lineOffsets);
  const bodyText = funcDecl.body
    ? content.slice(funcDecl.body.span?.start ?? 0, funcDecl.body.span?.end ?? 0)
    : '';

  const complexity = bodyText ? calculateComplexitySwc(bodyText) : 1;

  // Check if function has JSDoc (comment block immediately before function)
  const hasJSDoc = jsDocLines.has(startLine - 1) || jsDocLines.has(startLine - 2);

  // Check if exported
  const isExported = exportedDeclarations.has(name);

  const funcInfo: FunctionInfo = {
    name,
    startLine,
    endLine,
    lines: endLine - startLine + 1,
    params: funcDecl.params.length,
    isExported,
    isAsync: funcDecl.async || false,
    hasJSDoc,
    complexity,
  };

  // Add split suggestions for complex functions
  if (complexity > 10 && bodyText) {
    const suggestions = analyzeSplitPointsSwc(bodyText, name, startLine);
    if (suggestions.length > 0) {
      funcInfo.splitSuggestions = suggestions;
    }
  }

  return funcInfo;
}

/**
 * Extract variable function (arrow or function expression)
 */
function extractVariableFunction(
  declarator: VariableDeclarator,
  content: string,
  lineOffsets: number[],
  jsDocLines: Set<number>,
  exportedDeclarations: Set<string>,
): FunctionInfo | null {
  const init = declarator.init;
  if (!init) return null;

  const initNode = init as BaseNode;
  const initType = initNode.type;

  // Only process arrow functions and function expressions
  if (initType !== 'ArrowFunctionExpression' && initType !== 'FunctionExpression') {
    return null;
  }

  const funcExpr = init as ArrowFunctionExpression | FunctionExpression;
  const idNode = declarator.id as BaseNode;

  if (idNode.type !== 'Identifier') return null;

  const name = (declarator.id as Identifier).value;
  const span = declarator.span;
  const funcSpan = funcExpr.span;

  if (!span || !funcSpan) return null;

  const startLine = offsetToLine(span.start, lineOffsets);
  const endLine = offsetToLine(funcSpan.end, lineOffsets);

  // Get body text
  const bodyNode = funcExpr.body as BaseNode;
  let bodyText = '';

  if (bodyNode.type === 'BlockStatement') {
    const blockBody = funcExpr.body as BlockStatement;
    bodyText = content.slice(blockBody.span?.start ?? 0, blockBody.span?.end ?? 0);
  } else {
    // Arrow function with expression body
    bodyText = content.slice(bodyNode.span?.start ?? 0, bodyNode.span?.end ?? 0);
  }

  const complexity = bodyText ? calculateComplexitySwc(bodyText) : 1;

  // Check if function has JSDoc
  const hasJSDoc = jsDocLines.has(startLine - 1) || jsDocLines.has(startLine - 2);

  // Check if exported
  const isExported = exportedDeclarations.has(name);

  const funcInfo: FunctionInfo = {
    name,
    startLine,
    endLine,
    lines: endLine - startLine + 1,
    params: funcExpr.params.length,
    isExported,
    isAsync: funcExpr.async || false,
    hasJSDoc,
    complexity,
  };

  // Add split suggestions for complex functions
  if (complexity > 10 && bodyText && bodyNode.type === 'BlockStatement') {
    const suggestions = analyzeSplitPointsSwc(bodyText, name, startLine);
    if (suggestions.length > 0) {
      funcInfo.splitSuggestions = suggestions;
    }
  }

  return funcInfo;
}

/**
 * Extract class method information
 */
function extractClassMethod(
  classMethod: ClassMethod,
  content: string,
  lineOffsets: number[],
  jsDocLines: Set<number>,
  exportedDeclarations: Set<string>,
): FunctionInfo | null {
  const span = classMethod.span;
  if (!span) return null;

  const keyNode = classMethod.key as BaseNode;
  if (keyNode.type !== 'Identifier') return null;

  const name = (classMethod.key as Identifier).value;
  const startLine = offsetToLine(span.start, lineOffsets);
  const endLine = offsetToLine(span.end, lineOffsets);

  const bodyText = classMethod.function.body
    ? content.slice(
        classMethod.function.body.span?.start ?? 0,
        classMethod.function.body.span?.end ?? 0,
      )
    : '';

  const complexity = bodyText ? calculateComplexitySwc(bodyText) : 1;

  // Check if method has JSDoc
  const hasJSDoc = jsDocLines.has(startLine - 1) || jsDocLines.has(startLine - 2);

  // Check if parent class is exported (simplified - just check if class is in exported set)
  const isExported =
    exportedDeclarations.has('__class__') || exportedDeclarations.has('__default__');

  const funcInfo: FunctionInfo = {
    name,
    startLine,
    endLine,
    lines: endLine - startLine + 1,
    params: classMethod.function.params.length,
    isExported,
    isAsync: classMethod.function.async || false,
    hasJSDoc,
    complexity,
  };

  // Add split suggestions for complex methods
  if (complexity > 10 && bodyText) {
    const suggestions = analyzeSplitPointsSwc(bodyText, name, startLine);
    if (suggestions.length > 0) {
      funcInfo.splitSuggestions = suggestions;
    }
  }

  return funcInfo;
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
