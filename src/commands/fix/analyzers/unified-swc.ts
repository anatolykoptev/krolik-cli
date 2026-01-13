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
 * @example
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
import { parse } from '@swc/core';
import { calculateLineOffsets, getSnippet, offsetToLine } from '@/lib/@ast/swc';
import {
  COMPLEXITY_FIXER_ID,
  checkTsDirectives,
  createDuplicateQueryIssue,
  createHardcodedValue,
  createLintIssue,
  createModernizationIssue,
  createReturnTypeIssue,
  createSecurityIssue,
  createTypeSafetyIssue,
  type IssueFactoryContext,
  isCliFile,
  LONG_FUNCTION_FIXER_ID,
  shouldSkipForAnalysis,
  shouldSkipForLint,
} from '@/lib/@detectors';
import {
  type DetectorContext,
  detectHardcodedValue,
  detectLintIssue,
  detectModernizationIssue,
  detectQuery,
  detectReturnTypeIssue,
  detectSecurityIssue,
  detectTypeSafetyIssue,
  type FunctionTrackingInfo,
  type HardcodedDetection,
  isComplexityNode,
  isInConstDeclaration,
  type LintDetection,
  type ModernizationDetection,
  type QueryDetection,
  type QueryDetectorContext,
  type ReturnTypeDetection,
  type SecurityDetection,
  type TypeSafetyDetection,
} from '@/lib/@detectors/patterns/ast';
import { shouldSkipFile } from '@/lib/@detectors/quality/hardcoded/index';
import type { FunctionInfo, HardcodedValue, QualityIssue } from '../core';

// ============================================================================
// CONSTANTS
// ============================================================================

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
  /** Duplicate query issues (Prisma/tRPC) */
  queryIssues: QualityIssue[];
  /** Extracted function information with complexity metrics */
  functions: FunctionInfo[];
}

// ============================================================================
// COMPLEXITY TRACKING STATE
// ============================================================================

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

interface ComplexityState {
  functionStack: FunctionScope[];
  functions: FunctionTrackingInfo[];
  exportedNames: Set<string>;
}

// ============================================================================
// SKIP OPTIONS
// ============================================================================

interface SkipOptions {
  skipLint: boolean;
  skipTypeSafety: boolean;
  skipSecurity: boolean;
  skipModernization: boolean;
  skipHardcoded: boolean;
  skipReturnTypes: boolean;
  skipComplexity: boolean;
  skipQueries: boolean;
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
 */
export async function analyzeFileUnified(
  content: string,
  filepath: string,
  options: {
    maxComplexity?: number;
    maxFunctionLines?: number;
  } = {},
): Promise<UnifiedAnalysisResult> {
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
    queryIssues: [],
    functions: [],
  };

  // Determine skip rules
  const skipOptions = buildSkipOptions(filepath);

  // If all analyzers should skip, return empty result
  if (shouldSkipAll(skipOptions)) {
    return result;
  }

  const isCli = isCliFile(filepath);

  try {
    // Parse file with SWC (async)
    const { ast, lineOffsets, baseOffset } = await parseFileWithSwc(content, filepath);

    // Create factory context for issue creation
    const factoryCtx: IssueFactoryContext = {
      filepath,
      content,
      lineOffsets,
      baseOffset,
    };

    // Collect detections from single AST pass
    const detections = collectDetections(
      ast,
      content,
      filepath,
      skipOptions,
      lineOffsets,
      baseOffset,
    );

    // Convert detections to issues using issue factory
    convertDetectionsToIssues(result, detections, factoryCtx, skipOptions, isCli);

    // Convert complexity data to issues and function info
    convertComplexityToIssues(
      result,
      detections.complexityState,
      factoryCtx,
      maxComplexity,
      maxFunctionLines,
    );

    // Check TS directives (regex-based, separate from AST)
    if (!skipOptions.skipTypeSafety) {
      result.typeSafetyIssues.push(...checkTsDirectives(content, filepath));
    }
  } catch {
    // Parse error - return empty results
  }

  return result;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function buildSkipOptions(filepath: string): SkipOptions {
  // Use shouldSkipForLint for lint issues (includes seed, webhook, logger files)
  const shouldSkipLintAnalysis = shouldSkipForLint(filepath);
  const shouldSkipTypeSafety =
    filepath.endsWith('.d.ts') ||
    filepath.includes('.test.') ||
    filepath.includes('.spec.') ||
    shouldSkipForAnalysis(filepath);

  // Skip query detection for test files, migrations, seeds, service layers (expected to have queries)
  const shouldSkipQueries =
    filepath.includes('.test.') ||
    filepath.includes('.spec.') ||
    filepath.includes('__tests__') ||
    filepath.includes('/migrations/') ||
    filepath.includes('/seed') ||
    filepath.includes('/lib/queries/') || // Don't flag files that ARE extracted queries
    filepath.includes('/services/'); // Service layers are expected to have queries

  return {
    skipLint: shouldSkipLintAnalysis,
    skipTypeSafety: shouldSkipTypeSafety,
    skipSecurity: shouldSkipForAnalysis(filepath),
    skipModernization: shouldSkipForAnalysis(filepath),
    skipHardcoded: shouldSkipFile(filepath),
    skipReturnTypes: shouldSkipTypeSafety,
    skipComplexity: false, // Always run for function extraction
    skipQueries: shouldSkipQueries,
  };
}

function shouldSkipAll(options: SkipOptions): boolean {
  return (
    options.skipLint &&
    options.skipTypeSafety &&
    options.skipSecurity &&
    options.skipModernization &&
    options.skipHardcoded &&
    options.skipReturnTypes &&
    options.skipComplexity &&
    options.skipQueries
  );
}

async function parseFileWithSwc(
  content: string,
  filepath: string,
): Promise<{ ast: Node; lineOffsets: number[]; baseOffset: number }> {
  const isTypeScript = filepath.endsWith('.ts') || filepath.endsWith('.tsx');
  const isJsx = filepath.endsWith('.jsx') || filepath.endsWith('.tsx');

  const ast = await parse(content, {
    syntax: isTypeScript ? 'typescript' : 'ecmascript',
    ...(isTypeScript && isJsx ? { tsx: true } : {}),
    ...(!isTypeScript && isJsx ? { jsx: true } : {}),
    comments: true,
  });

  // Workaround for SWC global state bug
  let baseOffset = 0;
  if (ast.body.length > 0) {
    const firstStmt = ast.body[0] as { span?: Span };
    if (firstStmt.span) {
      baseOffset = firstStmt.span.start - 1;
    }
  }

  const lineOffsets = calculateLineOffsets(content);

  return { ast, lineOffsets, baseOffset };
}

// ============================================================================
// DETECTION COLLECTION
// ============================================================================

interface DetectionResult {
  lintDetections: LintDetection[];
  typeSafetyDetections: TypeSafetyDetection[];
  securityDetections: SecurityDetection[];
  modernizationDetections: ModernizationDetection[];
  hardcodedDetections: HardcodedDetection[];
  returnTypeDetections: ReturnTypeDetection[];
  queryDetections: QueryDetection[];
  complexityState: ComplexityState;
}

function collectDetections(
  ast: Node,
  content: string,
  filepath: string,
  skipOptions: SkipOptions,
  lineOffsets: number[],
  baseOffset: number,
): DetectionResult {
  const result: DetectionResult = {
    lintDetections: [],
    typeSafetyDetections: [],
    securityDetections: [],
    modernizationDetections: [],
    hardcodedDetections: [],
    returnTypeDetections: [],
    queryDetections: [],
    complexityState: {
      functionStack: [],
      functions: [],
      exportedNames: new Set(),
    },
  };

  visitNodeUnified(ast, content, filepath, skipOptions, result, lineOffsets, baseOffset, {
    isTopLevel: true,
    inConstDeclaration: undefined,
    inMemberExpression: undefined,
    parentType: undefined,
  });

  return result;
}

// ============================================================================
// UNIFIED AST VISITOR
// ============================================================================

function visitNodeUnified(
  node: Node,
  content: string,
  filepath: string,
  skipOptions: SkipOptions,
  detections: DetectionResult,
  lineOffsets: number[],
  baseOffset: number,
  context: DetectorContext,
  visited = new WeakSet<object>(),
  isExportContext = false,
): void {
  if (!node || typeof node !== 'object' || visited.has(node)) {
    return;
  }
  visited.add(node);

  const nodeType = (node as { type?: string }).type;
  const span = (node as { span?: Span }).span;
  if (!nodeType) return;

  // Track exports
  let currentExportContext = isExportContext;
  if (nodeType === 'ExportDeclaration') {
    currentExportContext = true;
    trackExportedNames(node, detections.complexityState);
  }

  // Update context
  const newContext = updateContext(node, nodeType, context);

  // Track complexity
  if (!skipOptions.skipComplexity) {
    trackComplexity(
      node,
      nodeType,
      span,
      detections.complexityState,
      lineOffsets,
      baseOffset,
      currentExportContext,
    );
  }

  // Run detectors
  if (span) {
    runDetectors(node, content, filepath, skipOptions, detections, context, newContext);
  }

  // Visit children
  visitChildren(
    node,
    content,
    filepath,
    skipOptions,
    detections,
    lineOffsets,
    baseOffset,
    newContext,
    visited,
    currentExportContext,
  );

  // Handle function exit
  if (!skipOptions.skipComplexity && isFunctionNode(nodeType) && span) {
    handleFunctionExit(span, detections.complexityState, lineOffsets, baseOffset);
  }
}

function trackExportedNames(node: Node, state: ComplexityState): void {
  const declaration = (node as { declaration?: { type?: string; identifier?: { value: string } } })
    .declaration;
  if (declaration?.type === 'FunctionDeclaration' && declaration.identifier?.value) {
    state.exportedNames.add(declaration.identifier.value);
  }
  if (declaration?.type === 'VariableDeclaration') {
    const varDecl = declaration as { declarations?: Array<{ id?: { value?: string } }> };
    for (const decl of varDecl.declarations || []) {
      if (decl.id?.value) {
        state.exportedNames.add(decl.id.value);
      }
    }
  }
}

function updateContext(node: Node, nodeType: string, context: DetectorContext): DetectorContext {
  let inMemberExpression = context.inMemberExpression;
  if (nodeType === 'MemberExpression') {
    const property = (node as { property?: { type?: string } }).property;
    inMemberExpression = property?.type === 'Computed';
  }

  return {
    isTopLevel: context.isTopLevel && nodeType !== 'FunctionDeclaration',
    inConstDeclaration: isInConstDeclaration(node, context),
    inMemberExpression,
    parentType: nodeType,
  };
}

function runDetectors(
  node: Node,
  content: string,
  filepath: string,
  skipOptions: SkipOptions,
  detections: DetectionResult,
  context: DetectorContext,
  newContext: DetectorContext,
): void {
  if (!skipOptions.skipLint) {
    const lint = detectLintIssue(node);
    if (lint) detections.lintDetections.push(lint);
  }

  if (!skipOptions.skipTypeSafety) {
    const typeSafety = detectTypeSafetyIssue(node);
    if (typeSafety) detections.typeSafetyDetections.push(typeSafety);
  }

  if (!skipOptions.skipSecurity) {
    const security = detectSecurityIssue(node);
    if (security) detections.securityDetections.push(security);
  }

  if (!skipOptions.skipModernization) {
    const modernization = detectModernizationIssue(node);
    if (modernization) detections.modernizationDetections.push(modernization);
  }

  if (!skipOptions.skipHardcoded) {
    const hardcoded = detectHardcodedValue(node, content, filepath, newContext, context);
    if (hardcoded) detections.hardcodedDetections.push(hardcoded);
  }

  if (!skipOptions.skipReturnTypes) {
    const returnType = detectReturnTypeIssue(node);
    if (returnType) detections.returnTypeDetections.push(returnType);
  }

  if (!skipOptions.skipQueries) {
    // Create query detector context from current state
    const currentFunc =
      detections.complexityState.functionStack.length > 0
        ? detections.complexityState.functionStack[
            detections.complexityState.functionStack.length - 1
          ]
        : null;
    const queryContext: QueryDetectorContext = currentFunc?.name
      ? { functionName: currentFunc.name }
      : {};
    const query = detectQuery(node, content, queryContext);
    if (query) detections.queryDetections.push(query);
  }
}

function visitChildren(
  node: Node,
  content: string,
  filepath: string,
  skipOptions: SkipOptions,
  detections: DetectionResult,
  lineOffsets: number[],
  baseOffset: number,
  context: DetectorContext,
  visited: WeakSet<object>,
  isExportContext: boolean,
): void {
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
            detections,
            lineOffsets,
            baseOffset,
            context,
            visited,
            isExportContext,
          );
        }
      }
    } else if (value && typeof value === 'object' && key !== 'span') {
      visitNodeUnified(
        value as Node,
        content,
        filepath,
        skipOptions,
        detections,
        lineOffsets,
        baseOffset,
        context,
        visited,
        isExportContext,
      );
    }
  }
}

// ============================================================================
// COMPLEXITY TRACKING
// ============================================================================

function isFunctionNode(nodeType: string): boolean {
  return (
    nodeType === 'FunctionDeclaration' ||
    nodeType === 'ArrowFunctionExpression' ||
    nodeType === 'FunctionExpression' ||
    nodeType === 'ClassMethod'
  );
}

function trackComplexity(
  node: Node,
  nodeType: string,
  span: Span | undefined,
  state: ComplexityState,
  lineOffsets: number[],
  baseOffset: number,
  isExportContext: boolean,
): void {
  // Function entry
  if (isFunctionNode(nodeType) && span) {
    const funcEntry = extractFunctionEntry(
      node,
      nodeType,
      span,
      lineOffsets,
      baseOffset,
      state.exportedNames,
      isExportContext,
    );
    if (funcEntry) {
      state.functionStack.push(funcEntry);
    }
  }

  // Complexity counting
  if (state.functionStack.length > 0 && isComplexityNode(node)) {
    const current = state.functionStack[state.functionStack.length - 1];
    if (current) {
      current.complexity++;
    }
  }
}

function extractFunctionEntry(
  node: Node,
  nodeType: string,
  span: Span,
  lineOffsets: number[],
  baseOffset: number,
  exportedNames: Set<string>,
  isExportContext: boolean,
): FunctionScope | null {
  const adjustedStart = span.start - baseOffset;
  const startLine = offsetToLine(adjustedStart, lineOffsets);

  const createScope = (
    name: string,
    params: number,
    isAsync: boolean,
    isExported: boolean,
    bodySpan?: Span,
  ): FunctionScope => ({
    name,
    startOffset: adjustedStart,
    startLine,
    params,
    isAsync,
    isExported,
    complexity: 1,
    ...(bodySpan ? { bodySpan } : {}),
  });

  if (nodeType === 'FunctionDeclaration') {
    const func = node as unknown as {
      identifier?: { value: string };
      params: unknown[];
      body?: { span?: Span };
      async?: boolean;
    };
    const name = func.identifier?.value || 'anonymous';
    return createScope(
      name,
      func.params?.length ?? 0,
      func.async ?? false,
      isExportContext || exportedNames.has(name),
      func.body?.span,
    );
  }

  if (nodeType === 'ArrowFunctionExpression') {
    const func = node as unknown as {
      params: unknown[];
      body: { type?: string; span?: Span };
      async?: boolean;
    };
    const bodySpan = func.body?.type === 'BlockStatement' ? func.body.span : undefined;
    return createScope(
      'arrow',
      func.params?.length ?? 0,
      func.async ?? false,
      isExportContext,
      bodySpan,
    );
  }

  if (nodeType === 'FunctionExpression') {
    const func = node as unknown as {
      identifier?: { value: string };
      params: unknown[];
      body?: { span?: Span };
      async?: boolean;
    };
    return createScope(
      func.identifier?.value || 'anonymous',
      func.params?.length ?? 0,
      func.async ?? false,
      isExportContext,
      func.body?.span,
    );
  }

  if (nodeType === 'ClassMethod') {
    const method = node as unknown as {
      key: { value?: string };
      function: { params: unknown[]; body?: { span?: Span }; async?: boolean };
    };
    return createScope(
      method.key?.value || 'method',
      method.function?.params?.length ?? 0,
      method.function?.async ?? false,
      isExportContext,
      method.function?.body?.span,
    );
  }

  return null;
}

function handleFunctionExit(
  span: Span,
  state: ComplexityState,
  lineOffsets: number[],
  baseOffset: number,
): void {
  const funcScope = state.functionStack.pop();
  if (!funcScope) return;

  const adjustedEnd = span.end - baseOffset;
  const endLine = offsetToLine(adjustedEnd, lineOffsets);

  state.functions.push({
    name: funcScope.name,
    startOffset: funcScope.startOffset,
    endOffset: adjustedEnd,
    startLine: funcScope.startLine,
    endLine,
    lines: endLine - funcScope.startLine + 1,
    params: funcScope.params,
    isExported: funcScope.isExported || state.exportedNames.has(funcScope.name),
    isAsync: funcScope.isAsync,
    complexity: funcScope.complexity,
  });
}

// ============================================================================
// ISSUE CONVERSION
// ============================================================================

function convertDetectionsToIssues(
  result: UnifiedAnalysisResult,
  detections: DetectionResult,
  ctx: IssueFactoryContext,
  skipOptions: SkipOptions,
  isCli: boolean,
): void {
  // Lint issues
  if (!skipOptions.skipLint) {
    for (const detection of detections.lintDetections) {
      if (detection.type === 'console' && isCli) continue;
      const issue = createLintIssue(detection, ctx);
      if (issue) result.lintIssues.push(issue);
    }
  }

  // Type-safety issues
  if (!skipOptions.skipTypeSafety) {
    for (const detection of detections.typeSafetyDetections) {
      const issue = createTypeSafetyIssue(detection, ctx);
      if (issue) result.typeSafetyIssues.push(issue);
    }
  }

  // Security issues
  if (!skipOptions.skipSecurity) {
    for (const detection of detections.securityDetections) {
      const issue = createSecurityIssue(detection, ctx);
      if (issue) result.securityIssues.push(issue);
    }
  }

  // Modernization issues
  if (!skipOptions.skipModernization) {
    for (const detection of detections.modernizationDetections) {
      const issue = createModernizationIssue(detection, ctx);
      if (issue) result.modernizationIssues.push(issue);
    }
  }

  // Hardcoded values
  if (!skipOptions.skipHardcoded) {
    for (const detection of detections.hardcodedDetections) {
      const value = createHardcodedValue(detection, ctx);
      if (value) result.hardcodedValues.push(value);
    }
  }

  // Return type issues
  if (!skipOptions.skipReturnTypes) {
    for (const detection of detections.returnTypeDetections) {
      const issue = createReturnTypeIssue(detection, ctx);
      if (issue) result.returnTypeIssues.push(issue);
    }
  }

  // Query issues (Prisma/tRPC duplicates)
  if (!skipOptions.skipQueries && detections.queryDetections.length > 0) {
    // Group detections by fingerprint to count duplicates within this file
    const fingerprints = new Map<string, { count: number; first: QueryDetection }>();
    for (const detection of detections.queryDetections) {
      const existing = fingerprints.get(detection.fingerprint);
      if (existing) {
        existing.count++;
      } else {
        fingerprints.set(detection.fingerprint, { count: 1, first: detection });
      }
    }

    // Create issues for queries that appear multiple times in this file
    for (const { count, first } of fingerprints.values()) {
      if (count >= 2) {
        const issue = createDuplicateQueryIssue(first, ctx, count);
        if (issue) result.queryIssues.push(issue);
      }
    }
  }
}

function convertComplexityToIssues(
  result: UnifiedAnalysisResult,
  state: ComplexityState,
  ctx: IssueFactoryContext,
  maxComplexity: number,
  maxFunctionLines: number,
): void {
  for (const func of state.functions) {
    // Convert to FunctionInfo
    result.functions.push({
      name: func.name,
      startLine: func.startLine,
      endLine: func.endLine,
      lines: func.lines,
      params: func.params,
      isExported: func.isExported,
      isAsync: func.isAsync,
      hasJSDoc: false,
      complexity: func.complexity,
    });

    // High complexity issue
    if (func.complexity > maxComplexity) {
      result.complexityIssues.push({
        file: ctx.filepath,
        line: func.startLine,
        severity: 'warning',
        category: 'complexity',
        message: `Function "${func.name}" has high cyclomatic complexity (${func.complexity})`,
        suggestion: `Consider refactoring to reduce complexity below ${maxComplexity}`,
        snippet: getSnippet(ctx.content, func.startOffset, ctx.lineOffsets),
        fixerId: COMPLEXITY_FIXER_ID,
      });
    }

    // Long function issue
    if (func.lines > maxFunctionLines) {
      result.complexityIssues.push({
        file: ctx.filepath,
        line: func.startLine,
        severity: 'warning',
        category: 'complexity',
        message: `Function "${func.name}" is too long (${func.lines} lines)`,
        suggestion: `Consider splitting into smaller functions (max ${maxFunctionLines} lines)`,
        snippet: getSnippet(ctx.content, func.startOffset, ctx.lineOffsets),
        fixerId: LONG_FUNCTION_FIXER_ID,
      });
    }
  }
}
