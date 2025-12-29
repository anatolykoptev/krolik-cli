/**
 * @module lib/@patterns/complexity/detector
 * @description Complexity detection for unified AST pass
 *
 * Provides complexity counting and function extraction that can be
 * performed during a single AST traversal, eliminating separate
 * parseSync calls.
 *
 * Features:
 * - Cyclomatic complexity counting during traversal
 * - Function boundary tracking with span information
 * - Long function detection
 * - Export detection via parent context
 *
 * @example
 * ```typescript
 * import { ComplexityTracker } from './complexity-detector';
 *
 * const tracker = new ComplexityTracker();
 *
 * visitNode(ast, (node, context) => {
 *   tracker.visitNode(node, content, lineOffsets, baseOffset);
 * });
 *
 * const functions = tracker.getFunctions();
 * const issues = tracker.getIssues(filepath);
 * ```
 */

import type { Node, Span } from '@swc/core';
// Import from @ast (utils layer) to maintain proper layer dependencies
import { offsetToLine } from '@/lib/@ast';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Complexity detection result
 */
export interface ComplexityDetection {
  type: 'high-complexity' | 'long-function';
  functionName: string;
  startLine: number;
  endLine: number;
  /** For high-complexity: the cyclomatic complexity */
  complexity?: number;
  /** For long-function: the line count */
  lines?: number;
  offset: number;
}

/**
 * Function information collected during traversal
 */
export interface FunctionTrackingInfo {
  name: string;
  startOffset: number;
  endOffset: number;
  startLine: number;
  endLine: number;
  lines: number;
  params: number;
  isExported: boolean;
  isAsync: boolean;
  complexity: number;
}

/**
 * SWC base node with common properties
 */
interface BaseNode {
  type: string;
  span?: Span;
}

/**
 * Function declaration node
 */
interface FunctionDeclarationNode extends BaseNode {
  type: 'FunctionDeclaration';
  identifier?: { value: string };
  params: unknown[];
  body?: { span?: Span };
  async?: boolean;
}

/**
 * Arrow function expression
 */
interface ArrowFunctionNode extends BaseNode {
  type: 'ArrowFunctionExpression';
  params: unknown[];
  body: BaseNode;
  async?: boolean;
}

/**
 * Function expression
 */
interface FunctionExpressionNode extends BaseNode {
  type: 'FunctionExpression';
  identifier?: { value: string };
  params: unknown[];
  body?: { span?: Span };
  async?: boolean;
}

/**
 * Variable declarator
 */
interface VariableDeclaratorNode extends BaseNode {
  type: 'VariableDeclarator';
  id: BaseNode & { value?: string };
  init?: BaseNode;
}

/**
 * Class method
 */
interface ClassMethodNode extends BaseNode {
  type: 'ClassMethod';
  key: BaseNode & { value?: string };
  function: {
    params: unknown[];
    body?: { span?: Span };
    async?: boolean;
  };
}

/**
 * Binary expression
 */
interface BinaryExpressionNode extends BaseNode {
  type: 'BinaryExpression';
  operator: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Node types that increase cyclomatic complexity */
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

/** Binary operators that add to complexity */
const COMPLEXITY_OPERATORS = new Set(['&&', '||', '??']);

/** Default thresholds */
const DEFAULT_MAX_COMPLEXITY = 10;
const DEFAULT_MAX_FUNCTION_LINES = 50;

// ============================================================================
// COMPLEXITY TRACKER
// ============================================================================

/**
 * Tracks complexity metrics during AST traversal
 *
 * This class accumulates complexity information as nodes are visited,
 * allowing complexity analysis to be performed in a single pass.
 */
export class ComplexityTracker {
  private functions: FunctionTrackingInfo[] = [];
  private currentFunctionStack: Array<{
    name: string;
    startOffset: number;
    startLine: number;
    params: number;
    isAsync: boolean;
    isExported: boolean;
    complexity: number;
    bodySpan?: Span;
  }> = [];
  private exportedNames = new Set<string>();
  private maxComplexity: number;
  private maxFunctionLines: number;

  constructor(
    options: {
      maxComplexity?: number;
      maxFunctionLines?: number;
    } = {},
  ) {
    this.maxComplexity = options.maxComplexity ?? DEFAULT_MAX_COMPLEXITY;
    this.maxFunctionLines = options.maxFunctionLines ?? DEFAULT_MAX_FUNCTION_LINES;
  }

  /**
   * Visit a node during AST traversal
   *
   * Call this for each node to track complexity metrics.
   * Must be called in pre-order (parent before children).
   */
  visitNode(
    node: Node,
    content: string,
    lineOffsets: number[],
    baseOffset: number,
    isExportContext: boolean = false,
  ): void {
    const baseNode = node as BaseNode;
    const nodeType = baseNode.type;

    // Track export declarations
    if (nodeType === 'ExportDeclaration') {
      const declaration = (node as { declaration?: BaseNode }).declaration;
      if (declaration) {
        this.collectExportedNames(declaration);
      }
    }

    // Track function entry
    const funcInfo = this.extractFunctionEntry(
      node,
      content,
      lineOffsets,
      baseOffset,
      isExportContext,
    );
    if (funcInfo) {
      this.currentFunctionStack.push(funcInfo);
    }

    // Count complexity for current function
    if (this.currentFunctionStack.length > 0) {
      const current = this.currentFunctionStack[this.currentFunctionStack.length - 1];
      if (current) {
        // Direct complexity nodes
        if (COMPLEXITY_NODE_TYPES.has(nodeType)) {
          current.complexity++;
        }

        // Binary operators
        if (nodeType === 'BinaryExpression') {
          const binExpr = node as BinaryExpressionNode;
          if (COMPLEXITY_OPERATORS.has(binExpr.operator)) {
            current.complexity++;
          }
        }
      }
    }
  }

  /**
   * Notify that we're exiting a node (for stack management)
   *
   * Must be called after visiting all children of a node.
   */
  exitNode(node: Node, lineOffsets: number[], baseOffset: number): void {
    const baseNode = node as BaseNode;
    const nodeType = baseNode.type;

    // Check if we're exiting a function
    if (this.isFunctionNode(nodeType)) {
      const current = this.currentFunctionStack.pop();
      if (current) {
        // Calculate end position from span
        const span = baseNode.span;
        if (span) {
          const adjustedEnd = span.end - baseOffset;
          const endLine = offsetToLine(adjustedEnd, lineOffsets);

          this.functions.push({
            name: current.name,
            startOffset: current.startOffset,
            endOffset: adjustedEnd,
            startLine: current.startLine,
            endLine,
            lines: endLine - current.startLine + 1,
            params: current.params,
            isExported: current.isExported || this.exportedNames.has(current.name),
            isAsync: current.isAsync,
            complexity: current.complexity,
          });
        }
      }
    }
  }

  /**
   * Get all collected functions
   */
  getFunctions(): FunctionTrackingInfo[] {
    return [...this.functions];
  }

  /**
   * Get complexity issues for functions that exceed thresholds
   */
  getIssues(_filepath: string): ComplexityDetection[] {
    const issues: ComplexityDetection[] = [];

    for (const func of this.functions) {
      // High complexity
      if (func.complexity > this.maxComplexity) {
        issues.push({
          type: 'high-complexity',
          functionName: func.name,
          startLine: func.startLine,
          endLine: func.endLine,
          complexity: func.complexity,
          offset: func.startOffset,
        });
      }

      // Long function
      if (func.lines > this.maxFunctionLines) {
        issues.push({
          type: 'long-function',
          functionName: func.name,
          startLine: func.startLine,
          endLine: func.endLine,
          lines: func.lines,
          offset: func.startOffset,
        });
      }
    }

    return issues;
  }

  /**
   * Reset tracker state
   */
  reset(): void {
    this.functions = [];
    this.currentFunctionStack = [];
    this.exportedNames.clear();
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private isFunctionNode(nodeType: string): boolean {
    return (
      nodeType === 'FunctionDeclaration' ||
      nodeType === 'ArrowFunctionExpression' ||
      nodeType === 'FunctionExpression' ||
      nodeType === 'ClassMethod'
    );
  }

  private extractFunctionEntry(
    node: Node,
    _content: string,
    lineOffsets: number[],
    baseOffset: number,
    isExportContext: boolean,
  ): {
    name: string;
    startOffset: number;
    startLine: number;
    params: number;
    isAsync: boolean;
    isExported: boolean;
    complexity: number;
    bodySpan?: Span;
  } | null {
    const baseNode = node as BaseNode;
    const nodeType = baseNode.type;
    const span = baseNode.span;

    if (!span) return null;

    const adjustedStart = span.start - baseOffset;
    const startLine = offsetToLine(adjustedStart, lineOffsets);

    // Helper to create result with optional bodySpan
    const createResult = (
      name: string,
      params: number,
      isAsync: boolean,
      isExported: boolean,
      bodySpan: Span | undefined,
    ): {
      name: string;
      startOffset: number;
      startLine: number;
      params: number;
      isAsync: boolean;
      isExported: boolean;
      complexity: number;
      bodySpan?: Span;
    } => {
      const result: {
        name: string;
        startOffset: number;
        startLine: number;
        params: number;
        isAsync: boolean;
        isExported: boolean;
        complexity: number;
        bodySpan?: Span;
      } = {
        name,
        startOffset: adjustedStart,
        startLine,
        params,
        isAsync,
        isExported,
        complexity: 1, // Base complexity
      };
      if (bodySpan) {
        result.bodySpan = bodySpan;
      }
      return result;
    };

    // Function declaration
    if (nodeType === 'FunctionDeclaration') {
      const funcDecl = node as FunctionDeclarationNode;
      return createResult(
        funcDecl.identifier?.value || 'anonymous',
        funcDecl.params.length,
        funcDecl.async || false,
        isExportContext || this.exportedNames.has(funcDecl.identifier?.value || ''),
        funcDecl.body?.span,
      );
    }

    // Arrow function (need parent context for name)
    if (nodeType === 'ArrowFunctionExpression') {
      const arrowFunc = node as ArrowFunctionNode;
      const bodySpan = arrowFunc.body.type === 'BlockStatement' ? arrowFunc.body.span : undefined;
      return createResult(
        'arrow', // Will be updated by parent variable declarator
        arrowFunc.params.length,
        arrowFunc.async || false,
        isExportContext,
        bodySpan,
      );
    }

    // Function expression
    if (nodeType === 'FunctionExpression') {
      const funcExpr = node as FunctionExpressionNode;
      return createResult(
        funcExpr.identifier?.value || 'anonymous',
        funcExpr.params.length,
        funcExpr.async || false,
        isExportContext,
        funcExpr.body?.span,
      );
    }

    // Class method
    if (nodeType === 'ClassMethod') {
      const classMethod = node as ClassMethodNode;
      const keyNode = classMethod.key;
      return createResult(
        keyNode.value || 'method',
        classMethod.function.params.length,
        classMethod.function.async || false,
        isExportContext,
        classMethod.function.body?.span,
      );
    }

    return null;
  }

  private collectExportedNames(declaration: BaseNode): void {
    if (declaration.type === 'FunctionDeclaration') {
      const funcDecl = declaration as FunctionDeclarationNode;
      if (funcDecl.identifier?.value) {
        this.exportedNames.add(funcDecl.identifier.value);
      }
    }

    if (declaration.type === 'VariableDeclaration') {
      const varDecl = declaration as { declarations?: VariableDeclaratorNode[] };
      for (const declarator of varDecl.declarations || []) {
        if (declarator.id.value) {
          this.exportedNames.add(declarator.id.value);
        }
      }
    }

    if (declaration.type === 'ClassDeclaration') {
      const classDecl = declaration as { identifier?: { value: string } };
      if (classDecl.identifier?.value) {
        this.exportedNames.add(classDecl.identifier.value);
      }
    }
  }
}

// ============================================================================
// STANDALONE DETECTION FUNCTIONS
// ============================================================================

/**
 * Check if a node increases cyclomatic complexity
 *
 * This is a pure function that can be used in the unified visitor
 * to count complexity incrementally.
 */
export function isComplexityNode(node: Node): boolean {
  const baseNode = node as BaseNode;
  const nodeType = baseNode.type;

  if (COMPLEXITY_NODE_TYPES.has(nodeType)) {
    return true;
  }

  if (nodeType === 'BinaryExpression') {
    const binExpr = node as BinaryExpressionNode;
    return COMPLEXITY_OPERATORS.has(binExpr.operator);
  }

  return false;
}

/**
 * Get complexity weight for a node
 *
 * Most nodes add 1, but this can be extended for weighted complexity.
 */
export function getComplexityWeight(node: Node): number {
  return isComplexityNode(node) ? 1 : 0;
}
