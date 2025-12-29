/**
 * @module commands/fix/analyzers/unified-swc
 * @description Unified SWC AST analyzer - single parse + visit pass for all detections
 *
 * Combines multiple analyzers into one:
 * - lint-rules-swc.ts (console, debugger, alert, eval)
 * - type-safety-swc.ts (any, as any, @ts-expect-error, non-null assertion)
 * - hardcoded-swc.ts (magic numbers, URLs, hex colors)
 * - complexity-swc.ts (cyclomatic complexity, long functions)
 *
 * Performance benefits:
 * - Single parseSync() call instead of multiple
 * - Single visitNode() pass for all detections
 * - Shared lineOffsets calculation
 * - ~30% speedup by eliminating redundant AST parsing
 *
 * Usage:
 * ```typescript
 * import { analyzeFileUnified } from './unified-swc';
 *
 * const {
 *   lintIssues,
 *   typeSafetyIssues,
 *   hardcodedValues,
 *   complexityIssues,
 *   functions
 * } = analyzeFileUnified(content, filepath);
 * ```
 */

import type { Node, Span } from '@swc/core';
import { parseSync } from '@swc/core';
import { calculateLineOffsets, getContext, getSnippet, offsetToLine } from '../../../lib/@ast/swc';
import { isCliFile, shouldSkipForAnalysis } from '../../../lib/@detectors';
import {
  type DetectorContext,
  detectHardcodedValue,
  detectLintIssue,
  detectModernizationIssue,
  detectReturnTypeIssue,
  detectSecurityIssue,
  detectTypeSafetyIssue,
  type FunctionTrackingInfo,
  type HardcodedDetection,
  isComplexityNode,
  isInConstDeclaration,
  type LintDetection,
  type ModernizationDetection,
  type ReturnTypeDetection,
  type SecurityDetection,
  type TypeSafetyDetection,
} from '../../../lib/@detectors/ast';
import { shouldSkipFile } from '../../../lib/@detectors/hardcoded/index';
import type { FunctionInfo, HardcodedValue, QualityIssue } from '../types';

// Note: All detection types and functions are now imported from lib/@detectors/ast

// Default thresholds for complexity detection
const DEFAULT_MAX_COMPLEXITY = 10;
const DEFAULT_MAX_FUNCTION_LINES = 50;

// ============================================================================
// UNIFIED ANALYSIS RESULT
// ============================================================================

/**
 * Unified analysis result containing all detected issues
 */
export interface UnifiedAnalysisResult {
  /** Lint issues (console, debugger, alert, eval, empty-catch) */
  lintIssues: QualityIssue[];
  /** Type-safety issues (any, as any, @ts-expect-error, non-null assertion) */
  typeSafetyIssues: QualityIssue[];
  /** Security issues (command injection, path traversal) */
  securityIssues: QualityIssue[];
  /** Modernization issues (require, legacy patterns) */
  modernizationIssues: QualityIssue[];
  /** Hardcoded values (magic numbers, URLs, hex colors) */
  hardcodedValues: HardcodedValue[];
  /** Return type issues (missing explicit return types on exported functions) */
  returnTypeIssues: QualityIssue[];
  /** Complexity issues (high cyclomatic complexity, long functions) */
  complexityIssues: QualityIssue[];
  /** Extracted function information with complexity metrics */
  functions: FunctionInfo[];
}

// ============================================================================
// COMPLEXITY TRACKING STATE
// ============================================================================

/**
 * Function scope entry for tracking complexity during traversal
 */
interface FunctionScope {
  name: string;
  startOffset: number;
  startLine: number;
  params: number;
  isAsync: boolean;
  isExported: boolean;
  complexity: number;
  bodySpan?: Span;
}

/**
 * State for tracking complexity across the AST traversal
 */
interface ComplexityState {
  functionStack: FunctionScope[];
  functions: FunctionTrackingInfo[];
  exportedNames: Set<string>;
}

// ============================================================================
// MAIN UNIFIED ANALYZER
// ============================================================================

/**
 * Analyze file using unified SWC AST pass
 *
 * Performs single parse + single visit pass to detect:
 * 1. Lint issues: console, debugger, alert, eval, empty-catch
 * 2. Type-safety issues: any, as any, @ts-expect-error, non-null assertion
 * 3. Security issues: command injection, path traversal
 * 4. Modernization issues: require, legacy patterns
 * 5. Hardcoded values: magic numbers, URLs, hex colors
 * 6. Complexity issues: high cyclomatic complexity, long functions
 *
 * @param content - File content
 * @param filepath - File path
 * @param options - Optional complexity thresholds
 * @returns Unified analysis result
 */
export function analyzeFileUnified(
  content: string,
  filepath: string,
  options: {
    maxComplexity?: number;
    maxFunctionLines?: number;
  } = {},
): UnifiedAnalysisResult {
  const maxComplexity = options.maxComplexity ?? DEFAULT_MAX_COMPLEXITY;
  const maxFunctionLines = options.maxFunctionLines ?? DEFAULT_MAX_FUNCTION_LINES;

  const result: UnifiedAnalysisResult = {
    lintIssues: [],
    typeSafetyIssues: [],
    securityIssues: [],
    modernizationIssues: [],
    hardcodedValues: [],
    returnTypeIssues: [],
    complexityIssues: [],
    functions: [],
  };

  // Skip infrastructure files
  const shouldSkipLint = shouldSkipForAnalysis(filepath);
  const shouldSkipTypeSafety =
    filepath.endsWith('.d.ts') ||
    filepath.includes('.test.') ||
    filepath.includes('.spec.') ||
    shouldSkipForAnalysis(filepath);
  const shouldSkipSecurity = shouldSkipForAnalysis(filepath);
  const shouldSkipModernization = shouldSkipForAnalysis(filepath);
  const shouldSkipHardcoded = shouldSkipFile(filepath);
  // Return types use same skip rules as type-safety
  const shouldSkipReturnTypes = shouldSkipTypeSafety;
  // Complexity analysis runs for all files (used for function extraction)
  const shouldSkipComplexity = false;

  // If all analyzers should skip (except complexity), return empty result
  if (
    shouldSkipLint &&
    shouldSkipTypeSafety &&
    shouldSkipSecurity &&
    shouldSkipModernization &&
    shouldSkipHardcoded &&
    shouldSkipReturnTypes &&
    shouldSkipComplexity
  ) {
    return result;
  }

  const isCli = isCliFile(filepath);

  try {
    // Determine syntax based on file extension
    const isTypeScript = filepath.endsWith('.ts') || filepath.endsWith('.tsx');
    const isJsx = filepath.endsWith('.jsx') || filepath.endsWith('.tsx');

    // ⭐ SINGLE PARSE - Parse file once with SWC
    const ast = parseSync(content, {
      syntax: isTypeScript ? 'typescript' : 'ecmascript',
      ...(isTypeScript && isJsx ? { tsx: true } : {}),
      ...(!isTypeScript && isJsx ? { jsx: true } : {}),
      comments: true, // Enable for @ts-ignore detection
    });

    // Workaround for SWC global state bug (span offset accumulation)
    let baseOffset = 0;
    if (ast.body.length > 0) {
      const firstStmt = ast.body[0] as { span?: Span };
      if (firstStmt.span) {
        baseOffset = firstStmt.span.start - 1; // Adjust to 0-based
      }
    }

    // ⭐ SHARED LINE OFFSETS - Calculate once
    const lineOffsets = calculateLineOffsets(content);

    // Collect detections from single AST pass
    const lintDetections: LintDetection[] = [];
    const typeSafetyDetections: TypeSafetyDetection[] = [];
    const securityDetections: SecurityDetection[] = [];
    const modernizationDetections: ModernizationDetection[] = [];
    const hardcodedDetections: HardcodedDetection[] = [];
    const returnTypeDetections: ReturnTypeDetection[] = [];

    // ⭐ COMPLEXITY STATE - Track functions and complexity during traversal
    const complexityState: ComplexityState = {
      functionStack: [],
      functions: [],
      exportedNames: new Set(),
    };

    // ⭐ SINGLE VISIT - Visit AST once and collect all issue types
    visitNodeUnified(
      ast,
      content,
      filepath,
      {
        skipLint: shouldSkipLint,
        skipTypeSafety: shouldSkipTypeSafety,
        skipSecurity: shouldSkipSecurity,
        skipModernization: shouldSkipModernization,
        skipHardcoded: shouldSkipHardcoded,
        skipReturnTypes: shouldSkipReturnTypes,
        skipComplexity: shouldSkipComplexity,
      },
      lintDetections,
      typeSafetyDetections,
      securityDetections,
      modernizationDetections,
      hardcodedDetections,
      returnTypeDetections,
      complexityState,
      lineOffsets,
      baseOffset,
      {
        isTopLevel: true,
        inConstDeclaration: undefined,
        inMemberExpression: undefined,
        parentType: undefined,
      },
    );

    // Convert detections to quality issues
    if (!shouldSkipLint) {
      for (const detection of lintDetections) {
        // Skip console in CLI files
        if (detection.type === 'console' && isCli) {
          continue;
        }

        const issue = createLintIssue(detection, filepath, content, lineOffsets, baseOffset);
        if (issue) {
          result.lintIssues.push(issue);
        }
      }
    }

    if (!shouldSkipTypeSafety) {
      for (const detection of typeSafetyDetections) {
        const issue = createTypeSafetyIssue(detection, filepath, content, lineOffsets, baseOffset);
        if (issue) {
          result.typeSafetyIssues.push(issue);
        }
      }
    }

    if (!shouldSkipSecurity) {
      for (const detection of securityDetections) {
        const issue = createSecurityIssue(detection, filepath, content, lineOffsets, baseOffset);
        if (issue) {
          result.securityIssues.push(issue);
        }
      }
    }

    if (!shouldSkipModernization) {
      for (const detection of modernizationDetections) {
        const issue = createModernizationIssue(
          detection,
          filepath,
          content,
          lineOffsets,
          baseOffset,
        );
        if (issue) {
          result.modernizationIssues.push(issue);
        }
      }
    }

    if (!shouldSkipHardcoded) {
      for (const detection of hardcodedDetections) {
        const value = createHardcodedValue(detection, content, lineOffsets, baseOffset);
        if (value) {
          result.hardcodedValues.push(value);
        }
      }
    }

    if (!shouldSkipReturnTypes) {
      for (const detection of returnTypeDetections) {
        const issue = createReturnTypeIssue(detection, filepath, content, lineOffsets, baseOffset);
        if (issue) {
          result.returnTypeIssues.push(issue);
        }
      }
    }

    // ⭐ CONVERT COMPLEXITY DATA TO ISSUES AND FUNCTION INFO
    if (!shouldSkipComplexity) {
      for (const func of complexityState.functions) {
        // Convert to FunctionInfo format
        result.functions.push({
          name: func.name,
          startLine: func.startLine,
          endLine: func.endLine,
          lines: func.lines,
          params: func.params,
          isExported: func.isExported,
          isAsync: func.isAsync,
          hasJSDoc: false, // Would need comment analysis to detect
          complexity: func.complexity,
        });

        // Create complexity issues for functions exceeding thresholds
        if (func.complexity > maxComplexity) {
          result.complexityIssues.push({
            file: filepath,
            line: func.startLine,
            severity: 'warning',
            category: 'complexity',
            message: `Function "${func.name}" has high cyclomatic complexity (${func.complexity})`,
            suggestion: `Consider refactoring to reduce complexity below ${maxComplexity}`,
            snippet: getSnippet(content, func.startOffset, lineOffsets),
            fixerId: 'complexity',
          });
        }

        if (func.lines > maxFunctionLines) {
          result.complexityIssues.push({
            file: filepath,
            line: func.startLine,
            severity: 'warning',
            category: 'complexity',
            message: `Function "${func.name}" is too long (${func.lines} lines)`,
            suggestion: `Consider splitting into smaller functions (max ${maxFunctionLines} lines)`,
            snippet: getSnippet(content, func.startOffset, lineOffsets),
            fixerId: 'long-function',
          });
        }
      }
    }

    // Check @ts-expect-error/@ts-nocheck in comments (regex-based, no AST needed)
    if (!shouldSkipTypeSafety) {
      result.typeSafetyIssues.push(...checkTsDirectives(content, filepath));
    }
  } catch {
    // Parse error - return empty results
  }

  return result;
}

// ============================================================================
// BACKWARD COMPATIBILITY WRAPPERS
// ============================================================================

/**
 * Check lint rules using unified analyzer
 * (Backward-compatible wrapper for lint-rules-swc.ts)
 */
export function checkLintRulesSwc(content: string, filepath: string): QualityIssue[] {
  const { lintIssues } = analyzeFileUnified(content, filepath);
  return lintIssues;
}

/**
 * Check type-safety issues using unified analyzer
 * (Backward-compatible wrapper for type-safety-swc.ts)
 */
export function checkTypeSafetySwc(content: string, filepath: string): QualityIssue[] {
  const { typeSafetyIssues } = analyzeFileUnified(content, filepath);
  return typeSafetyIssues;
}

/**
 * Detect hardcoded values using unified analyzer
 * (Backward-compatible wrapper for hardcoded-swc.ts)
 */
export function detectHardcodedSwc(content: string, filepath: string): HardcodedValue[] {
  const { hardcodedValues } = analyzeFileUnified(content, filepath);
  return hardcodedValues;
}

/**
 * Check for missing return types using unified analyzer
 * (Backward-compatible wrapper for return-types-swc.ts)
 */
export function checkReturnTypesSwcUnified(content: string, filepath: string): QualityIssue[] {
  const { returnTypeIssues } = analyzeFileUnified(content, filepath);
  return returnTypeIssues;
}

/**
 * Extract functions with complexity metrics using unified analyzer
 * (Backward-compatible wrapper for complexity-swc.ts extractFunctionsSwc)
 */
export function extractFunctionsUnified(content: string, filepath: string): FunctionInfo[] {
  const { functions } = analyzeFileUnified(content, filepath);
  return functions;
}

// ============================================================================
// UNIFIED AST VISITOR
// ============================================================================

interface SkipOptions {
  skipLint: boolean;
  skipTypeSafety: boolean;
  skipSecurity: boolean;
  skipModernization: boolean;
  skipHardcoded: boolean;
  skipReturnTypes: boolean;
  skipComplexity: boolean;
}

/**
 * Check if a node type represents a function
 */
function isFunctionNode(nodeType: string): boolean {
  return (
    nodeType === 'FunctionDeclaration' ||
    nodeType === 'ArrowFunctionExpression' ||
    nodeType === 'FunctionExpression' ||
    nodeType === 'ClassMethod'
  );
}

/**
 * Type definitions for SWC node casting
 */
interface FunctionDeclNode {
  identifier?: { value: string };
  params: unknown[];
  body?: { span?: Span };
  async?: boolean;
}

interface ArrowFunctionNode {
  params: unknown[];
  body: { type?: string; span?: Span };
  async?: boolean;
}

interface FunctionExprNode {
  identifier?: { value: string };
  params: unknown[];
  body?: { span?: Span };
  async?: boolean;
}

interface ClassMethodNode {
  key: { value?: string };
  function: {
    params: unknown[];
    body?: { span?: Span };
    async?: boolean;
  };
}

/**
 * Create a FunctionScope with optional bodySpan
 */
function createFunctionScope(
  name: string,
  startOffset: number,
  startLine: number,
  params: number,
  isAsync: boolean,
  isExported: boolean,
  bodySpan: Span | undefined,
): FunctionScope {
  const base: FunctionScope = {
    name,
    startOffset,
    startLine,
    params,
    isAsync,
    isExported,
    complexity: 1, // Base complexity
  };
  if (bodySpan) {
    base.bodySpan = bodySpan;
  }
  return base;
}

/**
 * Extract function entry information from a node
 */
function extractFunctionEntry(
  node: Node,
  nodeType: string,
  lineOffsets: number[],
  baseOffset: number,
  exportedNames: Set<string>,
  isExportContext: boolean,
): FunctionScope | null {
  const span = (node as { span?: Span }).span;
  if (!span) return null;

  const adjustedStart = span.start - baseOffset;
  const startLine = offsetToLine(adjustedStart, lineOffsets);

  // Function declaration
  if (nodeType === 'FunctionDeclaration') {
    const funcDecl = node as unknown as FunctionDeclNode;
    const name = funcDecl.identifier?.value || 'anonymous';
    return createFunctionScope(
      name,
      adjustedStart,
      startLine,
      funcDecl.params?.length ?? 0,
      funcDecl.async ?? false,
      isExportContext || exportedNames.has(name),
      funcDecl.body?.span,
    );
  }

  // Arrow function
  if (nodeType === 'ArrowFunctionExpression') {
    const arrowFunc = node as unknown as ArrowFunctionNode;
    const bodySpan = arrowFunc.body?.type === 'BlockStatement' ? arrowFunc.body.span : undefined;
    return createFunctionScope(
      'arrow', // Will be updated by parent variable declarator context
      adjustedStart,
      startLine,
      arrowFunc.params?.length ?? 0,
      arrowFunc.async ?? false,
      isExportContext,
      bodySpan,
    );
  }

  // Function expression
  if (nodeType === 'FunctionExpression') {
    const funcExpr = node as unknown as FunctionExprNode;
    return createFunctionScope(
      funcExpr.identifier?.value || 'anonymous',
      adjustedStart,
      startLine,
      funcExpr.params?.length ?? 0,
      funcExpr.async ?? false,
      isExportContext,
      funcExpr.body?.span,
    );
  }

  // Class method
  if (nodeType === 'ClassMethod') {
    const classMethod = node as unknown as ClassMethodNode;
    return createFunctionScope(
      classMethod.key?.value || 'method',
      adjustedStart,
      startLine,
      classMethod.function?.params?.length ?? 0,
      classMethod.function?.async ?? false,
      isExportContext,
      classMethod.function?.body?.span,
    );
  }

  return null;
}

/**
 * Unified AST visitor - single pass collecting all issue types
 */
function visitNodeUnified(
  node: Node,
  content: string,
  filepath: string,
  skipOptions: SkipOptions,
  lintDetections: LintDetection[],
  typeSafetyDetections: TypeSafetyDetection[],
  securityDetections: SecurityDetection[],
  modernizationDetections: ModernizationDetection[],
  hardcodedDetections: HardcodedDetection[],
  returnTypeDetections: ReturnTypeDetection[],
  complexityState: ComplexityState,
  lineOffsets: number[],
  baseOffset: number,
  context: DetectorContext,
  visited = new WeakSet<object>(),
  isExportContext = false,
): void {
  if (!node || typeof node !== 'object') {
    return;
  }

  // Prevent infinite loops from circular references
  if (visited.has(node)) {
    return;
  }
  visited.add(node);

  const nodeType = (node as { type?: string }).type;
  const span = (node as { span?: Span }).span;

  if (!nodeType) return;

  // Track export declarations for complexity tracking
  let currentExportContext = isExportContext;
  if (nodeType === 'ExportDeclaration') {
    currentExportContext = true;
    const declaration = (
      node as { declaration?: { type?: string; identifier?: { value: string } } }
    ).declaration;
    if (declaration?.type === 'FunctionDeclaration' && declaration.identifier?.value) {
      complexityState.exportedNames.add(declaration.identifier.value);
    }
    if (declaration?.type === 'VariableDeclaration') {
      const varDecl = declaration as { declarations?: Array<{ id?: { value?: string } }> };
      for (const decl of varDecl.declarations || []) {
        if (decl.id?.value) {
          complexityState.exportedNames.add(decl.id.value);
        }
      }
    }
  }

  // Update context for MemberExpression
  let inMemberExpression = context.inMemberExpression;
  if (nodeType === 'MemberExpression') {
    const property = (node as { property?: { type?: string } }).property;
    inMemberExpression = property?.type === 'Computed';
  }

  // Update context based on current node
  const newContext: DetectorContext = {
    isTopLevel: context.isTopLevel && nodeType !== 'FunctionDeclaration',
    inConstDeclaration: isInConstDeclaration(node, context),
    inMemberExpression: inMemberExpression,
    parentType: nodeType,
  };

  // ⭐ COMPLEXITY TRACKING - Function entry
  if (!skipOptions.skipComplexity && isFunctionNode(nodeType)) {
    const funcEntry = extractFunctionEntry(
      node,
      nodeType,
      lineOffsets,
      baseOffset,
      complexityState.exportedNames,
      currentExportContext,
    );
    if (funcEntry) {
      // Check if we're in a variable declarator to get the function name
      if (nodeType === 'ArrowFunctionExpression' || nodeType === 'FunctionExpression') {
        // Name will be set by the parent if this is a variable declaration
        // For now, use a placeholder
      }
      complexityState.functionStack.push(funcEntry);
    }
  }

  // ⭐ COMPLEXITY COUNTING - Increment for current function
  if (!skipOptions.skipComplexity && complexityState.functionStack.length > 0) {
    if (isComplexityNode(node)) {
      const current = complexityState.functionStack[complexityState.functionStack.length - 1];
      if (current) {
        current.complexity++;
      }
    }
  }

  // ⭐ LINT DETECTION
  if (!skipOptions.skipLint && span) {
    const lintDetection = detectLintIssue(node);
    if (lintDetection) {
      lintDetections.push(lintDetection);
    }
  }

  // ⭐ TYPE-SAFETY DETECTION
  if (!skipOptions.skipTypeSafety && span) {
    const typeSafetyDetection = detectTypeSafetyIssue(node);
    if (typeSafetyDetection) {
      typeSafetyDetections.push(typeSafetyDetection);
    }
  }

  // ⭐ SECURITY DETECTION
  if (!skipOptions.skipSecurity && span) {
    const securityDetection = detectSecurityIssue(node);
    if (securityDetection) {
      securityDetections.push(securityDetection);
    }
  }

  // ⭐ MODERNIZATION DETECTION
  if (!skipOptions.skipModernization && span) {
    const modernizationDetection = detectModernizationIssue(node);
    if (modernizationDetection) {
      modernizationDetections.push(modernizationDetection);
    }
  }

  // ⭐ HARDCODED VALUE DETECTION
  if (!skipOptions.skipHardcoded && span) {
    const hardcodedDetection = detectHardcodedValue(node, content, filepath, newContext, context);
    if (hardcodedDetection) {
      hardcodedDetections.push(hardcodedDetection);
    }
  }

  // ⭐ RETURN TYPE DETECTION
  if (!skipOptions.skipReturnTypes && span) {
    const returnTypeDetection = detectReturnTypeIssue(node);
    if (returnTypeDetection) {
      returnTypeDetections.push(returnTypeDetection);
    }
  }

  // Visit children
  for (const key of Object.keys(node)) {
    const value = (node as unknown as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === 'object') {
          visitNodeUnified(
            item as Node,
            content,
            filepath,
            skipOptions,
            lintDetections,
            typeSafetyDetections,
            securityDetections,
            modernizationDetections,
            hardcodedDetections,
            returnTypeDetections,
            complexityState,
            lineOffsets,
            baseOffset,
            newContext,
            visited,
            currentExportContext,
          );
        }
      }
    } else if (value && typeof value === 'object' && key !== 'span') {
      visitNodeUnified(
        value as Node,
        content,
        filepath,
        skipOptions,
        lintDetections,
        typeSafetyDetections,
        securityDetections,
        modernizationDetections,
        hardcodedDetections,
        returnTypeDetections,
        complexityState,
        lineOffsets,
        baseOffset,
        newContext,
        visited,
        currentExportContext,
      );
    }
  }

  // ⭐ COMPLEXITY TRACKING - Function exit (after visiting children)
  if (!skipOptions.skipComplexity && isFunctionNode(nodeType)) {
    const funcScope = complexityState.functionStack.pop();
    if (funcScope && span) {
      const adjustedEnd = span.end - baseOffset;
      const endLine = offsetToLine(adjustedEnd, lineOffsets);

      complexityState.functions.push({
        name: funcScope.name,
        startOffset: funcScope.startOffset,
        endOffset: adjustedEnd,
        startLine: funcScope.startLine,
        endLine,
        lines: endLine - funcScope.startLine + 1,
        params: funcScope.params,
        isExported: funcScope.isExported || complexityState.exportedNames.has(funcScope.name),
        isAsync: funcScope.isAsync,
        complexity: funcScope.complexity,
      });
    }
  }
}

// ============================================================================
// FIXER ID MAPPING
// ============================================================================

/**
 * Lookup table mapping detection types to registered fixer IDs.
 * Uses O(1) Map lookup instead of repeated string matching.
 *
 * Keys correspond to detection.type values from detectors.
 * Values are the metadata.id from registered fixers.
 */
const LINT_FIXER_IDS: ReadonlyMap<string, string> = new Map([
  ['console', 'console'],
  ['debugger', 'debugger'],
  ['alert', 'alert'],
  ['eval', 'eval'],
  ['empty-catch', 'empty-catch'],
]);

const TYPE_SAFETY_FIXER_IDS: ReadonlyMap<string, string> = new Map([
  ['any-annotation', 'any-type'],
  ['any-assertion', 'any-type'],
  ['any-param', 'any-type'],
  ['any-array', 'any-type'],
  ['non-null', 'non-null-assertion'],
  ['double-assertion', 'double-assertion'],
]);

const SECURITY_FIXER_IDS: ReadonlyMap<string, string> = new Map([
  ['command-injection', 'command-injection'],
  ['path-traversal', 'path-traversal'],
]);

const MODERNIZATION_FIXER_IDS: ReadonlyMap<string, string> = new Map([['require', 'require']]);

/** Fixer ID for return type issues - matches explicit-return-types fixer metadata.id */
const RETURN_TYPE_FIXER_ID = 'explicit-return-types';

// ============================================================================
// ISSUE CREATION
// ============================================================================

/**
 * Get fixer ID from lookup table with type-safe fallback.
 * Since we control both the detection types and lookup tables,
 * missing entries indicate a code maintenance issue.
 */
function getFixerId(map: ReadonlyMap<string, string>, key: string): string | undefined {
  return map.get(key);
}

/**
 * Create quality issue from lint detection
 */
function createLintIssue(
  detection: LintDetection,
  filepath: string,
  content: string,
  lineOffsets: number[],
  baseOffset: number,
): QualityIssue | null {
  // Adjust for SWC's global offset accumulation bug
  const adjustedOffset = detection.offset - baseOffset;
  const lineNumber = offsetToLine(adjustedOffset, lineOffsets);
  const snippet = getSnippet(content, adjustedOffset, lineOffsets);
  const fixerId = getFixerId(LINT_FIXER_IDS, detection.type);

  switch (detection.type) {
    case 'console':
      return {
        file: filepath,
        line: lineNumber,
        severity: 'warning',
        category: 'lint',
        message: `Unexpected console statement: console.${detection.method ?? 'log'}`,
        suggestion: 'Remove console statement or use a proper logging library',
        snippet,
        ...(fixerId && { fixerId }),
      };

    case 'debugger':
      return {
        file: filepath,
        line: lineNumber,
        severity: 'error',
        category: 'lint',
        message: 'Unexpected debugger statement',
        suggestion: 'Remove debugger statement before committing',
        snippet,
        ...(fixerId && { fixerId }),
      };

    case 'alert':
      return {
        file: filepath,
        line: lineNumber,
        severity: 'warning',
        category: 'lint',
        message: `Unexpected native dialog: ${detection.method ?? 'alert'}()`,
        suggestion: 'Use a modal component instead of native browser dialogs',
        snippet,
        ...(fixerId && { fixerId }),
      };

    case 'eval':
      return {
        file: filepath,
        line: lineNumber,
        severity: 'error',
        category: 'lint',
        message: 'eval() is a security risk',
        suggestion:
          'Avoid eval() - use safer alternatives like JSON.parse() or Function constructor',
        snippet,
        ...(fixerId && { fixerId }),
      };

    case 'empty-catch':
      return {
        file: filepath,
        line: lineNumber,
        severity: 'warning',
        category: 'lint',
        message: 'Empty catch block',
        suggestion: 'Add error handling logic or at minimum log the error',
        snippet,
        ...(fixerId && { fixerId }),
      };

    default:
      return null;
  }
}

/**
 * Create quality issue from type-safety detection
 */
function createTypeSafetyIssue(
  detection: TypeSafetyDetection,
  filepath: string,
  content: string,
  lineOffsets: number[],
  baseOffset: number,
): QualityIssue | null {
  const adjustedOffset = detection.offset - baseOffset;
  const lineNumber = offsetToLine(adjustedOffset, lineOffsets);
  const snippet = getSnippet(content, adjustedOffset, lineOffsets);
  const fixerId = TYPE_SAFETY_FIXER_IDS.get(detection.type);

  switch (detection.type) {
    case 'any-annotation':
      return {
        file: filepath,
        line: lineNumber,
        severity: 'warning',
        category: 'type-safety',
        message: 'Using `any` type',
        suggestion: 'Use proper TypeScript types, `unknown`, or generics',
        snippet,
        ...(fixerId && { fixerId }),
      };

    case 'any-assertion':
      return {
        file: filepath,
        line: lineNumber,
        severity: 'warning',
        category: 'type-safety',
        message: 'Type assertion to `any`',
        suggestion: 'Use proper type assertion or fix the underlying type issue',
        snippet,
        ...(fixerId && { fixerId }),
      };

    case 'non-null':
      return {
        file: filepath,
        line: lineNumber,
        severity: 'info',
        category: 'type-safety',
        message: 'Non-null assertion operator (!)',
        suggestion: 'Use optional chaining (?.) or proper null checks',
        snippet,
        ...(fixerId && { fixerId }),
      };

    case 'any-param':
      return {
        file: filepath,
        line: lineNumber,
        severity: 'warning',
        category: 'type-safety',
        message: 'Using `any` in parameter type',
        suggestion: 'Use proper TypeScript parameter type or `unknown`',
        snippet,
        ...(fixerId && { fixerId }),
      };

    case 'any-array':
      return {
        file: filepath,
        line: lineNumber,
        severity: 'warning',
        category: 'type-safety',
        message: 'Using `any[]` array type',
        suggestion: 'Use proper array element type',
        snippet,
        ...(fixerId && { fixerId }),
      };

    case 'double-assertion':
      return {
        file: filepath,
        line: lineNumber,
        severity: 'info',
        category: 'type-safety',
        message: 'Double type assertion (as unknown as)',
        suggestion: 'Consider using proper type guards or fixing the underlying type issue',
        snippet,
        ...(fixerId && { fixerId }),
      };

    default:
      return null;
  }
}

/**
 * Create quality issue from security detection
 */
function createSecurityIssue(
  detection: SecurityDetection,
  filepath: string,
  content: string,
  lineOffsets: number[],
  baseOffset: number,
): QualityIssue | null {
  const adjustedOffset = detection.offset - baseOffset;
  const lineNumber = offsetToLine(adjustedOffset, lineOffsets);
  const snippet = getSnippet(content, adjustedOffset, lineOffsets);
  const fixerId = SECURITY_FIXER_IDS.get(detection.type);

  switch (detection.type) {
    case 'command-injection':
      return {
        file: filepath,
        line: lineNumber,
        severity: 'error',
        category: 'security',
        message: `Command injection risk: ${detection.method ?? 'execSync'}() with template literal`,
        suggestion: 'Validate and sanitize user input, or use execFile with array arguments',
        snippet,
        ...(fixerId && { fixerId }),
      };

    case 'path-traversal':
      return {
        file: filepath,
        line: lineNumber,
        severity: 'warning',
        category: 'security',
        message: `Path traversal risk: ${detection.method ?? 'path.join'}() with unvalidated input`,
        suggestion:
          'Validate path components before joining, or use path.normalize() and check boundaries',
        snippet,
        ...(fixerId && { fixerId }),
      };

    default:
      return null;
  }
}

/**
 * Create quality issue from modernization detection
 */
function createModernizationIssue(
  detection: ModernizationDetection,
  filepath: string,
  content: string,
  lineOffsets: number[],
  baseOffset: number,
): QualityIssue | null {
  const adjustedOffset = detection.offset - baseOffset;
  const lineNumber = offsetToLine(adjustedOffset, lineOffsets);
  const snippet = getSnippet(content, adjustedOffset, lineOffsets);
  const fixerId = MODERNIZATION_FIXER_IDS.get(detection.type);

  switch (detection.type) {
    case 'require':
      return {
        file: filepath,
        line: lineNumber,
        severity: 'warning',
        category: 'modernization',
        message: `Legacy ${detection.method ?? 'require'}() call`,
        suggestion: 'Use ES6 import instead: import x from "module"',
        snippet,
        ...(fixerId && { fixerId }),
      };

    default:
      return null;
  }
}

/**
 * Create hardcoded value from detection
 */
function createHardcodedValue(
  detection: HardcodedDetection,
  content: string,
  lineOffsets: number[],
  baseOffset: number,
): HardcodedValue | null {
  const adjustedOffset = detection.offset - baseOffset;
  const lineNumber = offsetToLine(adjustedOffset, lineOffsets);
  const context = getContext(content, adjustedOffset, lineOffsets);

  return {
    value: detection.value,
    type: detection.type,
    line: lineNumber,
    context,
  };
}

/**
 * Create quality issue from return type detection
 */
function createReturnTypeIssue(
  detection: ReturnTypeDetection,
  filepath: string,
  content: string,
  lineOffsets: number[],
  baseOffset: number,
): QualityIssue | null {
  const adjustedOffset = detection.offset - baseOffset;
  const lineNumber = offsetToLine(adjustedOffset, lineOffsets);
  const snippet = getSnippet(content, adjustedOffset, lineOffsets);
  const asyncHint = detection.isAsync ? ' (should be Promise<T>)' : '';

  switch (detection.type) {
    case 'missing-return-type-function':
      return {
        file: filepath,
        line: lineNumber,
        severity: 'info',
        category: 'type-safety',
        message: `Exported function "${detection.functionName}" is missing explicit return type${asyncHint}`,
        suggestion: 'Add explicit return type for better type safety',
        snippet,
        fixerId: RETURN_TYPE_FIXER_ID,
      };

    case 'missing-return-type-arrow':
      return {
        file: filepath,
        line: lineNumber,
        severity: 'info',
        category: 'type-safety',
        message: `Exported arrow function "${detection.functionName}" is missing explicit return type${asyncHint}`,
        suggestion: 'Add explicit return type for better type safety',
        snippet,
        fixerId: RETURN_TYPE_FIXER_ID,
      };

    case 'missing-return-type-expression':
      return {
        file: filepath,
        line: lineNumber,
        severity: 'info',
        category: 'type-safety',
        message: `Exported function expression "${detection.functionName}" is missing explicit return type${asyncHint}`,
        suggestion: 'Add explicit return type for better type safety',
        snippet,
        fixerId: RETURN_TYPE_FIXER_ID,
      };

    case 'missing-return-type-default':
      return {
        file: filepath,
        line: lineNumber,
        severity: 'info',
        category: 'type-safety',
        message: `Exported default function "${detection.functionName}" is missing explicit return type${asyncHint}`,
        suggestion: 'Add explicit return type for better type safety',
        snippet,
        fixerId: RETURN_TYPE_FIXER_ID,
      };

    default:
      return null;
  }
}

/** Fixer ID for TS directive issues - matches ts-ignore fixer metadata.id */
const TS_IGNORE_FIXER_ID = 'ts-ignore';

/**
 * Check for @ts-expect-error and @ts-nocheck in comments
 */
function checkTsDirectives(content: string, filepath: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();

    // Check for @ts-expect-error
    if (/@ts-ignore/.test(trimmed)) {
      // Skip if it's inside a string literal
      const firstQuote = trimmed.indexOf("'");
      const firstDoubleQuote = trimmed.indexOf('"');
      const firstBacktick = trimmed.indexOf('`');
      const commentPos = trimmed.indexOf('@ts-ignore');

      const inString =
        (firstQuote !== -1 && firstQuote < commentPos) ||
        (firstDoubleQuote !== -1 && firstDoubleQuote < commentPos) ||
        (firstBacktick !== -1 && firstBacktick < commentPos);

      if (!inString) {
        issues.push({
          file: filepath,
          line: i + 1,
          severity: 'error',
          category: 'type-safety',
          message: '@ts-ignore suppresses TypeScript errors',
          suggestion: 'Fix the type error instead of ignoring it',
          snippet: trimmed.slice(0, 80),
          fixerId: TS_IGNORE_FIXER_ID,
        });
      }
    }

    // Check for @ts-nocheck (typically at top of file)
    if (/@ts-nocheck/.test(trimmed)) {
      issues.push({
        file: filepath,
        line: i + 1,
        severity: 'error',
        category: 'type-safety',
        message: '@ts-nocheck disables TypeScript checking for entire file',
        suggestion: 'Remove @ts-nocheck and fix type errors',
        snippet: trimmed.slice(0, 80),
        fixerId: TS_IGNORE_FIXER_ID,
      });
    }

    // Check for @ts-expect-error without explanation
    if (/@ts-expect-error(?!\s+—)/.test(trimmed)) {
      issues.push({
        file: filepath,
        line: i + 1,
        severity: 'info',
        category: 'type-safety',
        message: '@ts-expect-error without explanation',
        suggestion: 'Add a comment explaining why this is expected',
        snippet: trimmed.slice(0, 80),
        fixerId: TS_IGNORE_FIXER_ID,
      });
    }
  }

  return issues;
}
