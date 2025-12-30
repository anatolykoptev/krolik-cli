/**
 * @module lib/@detectors/security/security-detector
 * @description SWC AST detector for security issues
 *
 * Detects:
 * - Command injection (execSync/exec/spawn with template literals)
 * - Path traversal (path.join/resolve with untrusted variable in path segments)
 *
 * Path traversal logic:
 * - First argument is typically a trusted base path (projectRoot, basePath)
 * - Only flags if arguments AFTER the first are variables (potential user input)
 * - path.join(projectRoot, 'package.json') → SAFE (literal path segment)
 * - path.join(projectRoot, userInput) → DANGEROUS (variable path segment)
 */

import type { Node, Span } from '@swc/core';
import type { SecurityDetection } from '../patterns/ast/types';

// ============================================================================
// CONSTANTS & LOOKUP TABLES
// ============================================================================

/** Child process methods that can lead to command injection */
const COMMAND_EXEC_METHODS = new Set(['execSync', 'exec', 'spawn', 'spawnSync']);

/** Path methods that can lead to path traversal */
const PATH_METHODS = new Set(['join', 'resolve']);

/** AST node types that indicate untrusted input */
const UNTRUSTED_ARG_TYPES = new Set(['Identifier', 'MemberExpression', 'CallExpression']);

// ============================================================================
// TYPE HELPERS
// ============================================================================

/** Extract type from a node */
function getNodeType(node: Node | undefined): string | undefined {
  return (node as { type?: string } | undefined)?.type;
}

/** Extract span from a node */
function getNodeSpan(node: Node): Span | undefined {
  return (node as { span?: Span }).span;
}

/** Extract identifier value from a node */
function getIdentifierValue(node: Node): string | undefined {
  return (node as { value?: string }).value;
}

/** Extract expression from an argument node */
function getArgumentExpression(arg: Node): Node | undefined {
  return (arg as { expression?: Node }).expression;
}

// ============================================================================
// CALL EXPRESSION PARSER
// ============================================================================

interface ParsedCallExpression {
  callee: Node;
  calleeType: string;
  args: Node[];
  span: Span;
}

/**
 * Parse a CallExpression node into its components
 * Returns null if the node is not a valid call expression
 */
function parseCallExpression(node: Node): ParsedCallExpression | null {
  const nodeType = getNodeType(node);
  const span = getNodeSpan(node);

  if (!span || nodeType !== 'CallExpression') {
    return null;
  }

  const callExpr = node as { callee?: Node; arguments?: Node[] };
  const callee = callExpr.callee;

  if (!callee) {
    return null;
  }

  const calleeType = getNodeType(callee);
  if (!calleeType) {
    return null;
  }

  return {
    callee,
    calleeType,
    args: callExpr.arguments ?? [],
    span,
  };
}

// ============================================================================
// COMMAND INJECTION DETECTION
// ============================================================================

/**
 * Check if an argument is a template literal with expressions (interpolation)
 */
function hasTemplateInterpolation(argExpr: Node): boolean {
  const argType = getNodeType(argExpr);
  if (argType !== 'TemplateLiteral') {
    return false;
  }

  const templateLiteral = argExpr as { expressions?: unknown[] };
  const expressions = templateLiteral.expressions ?? [];
  return expressions.length > 0;
}

/**
 * Detect command injection from a parsed call expression
 *
 * Detects: execSync(`rm -rf ${userInput}`)
 */
function detectCommandInjectionFromCall(parsed: ParsedCallExpression): SecurityDetection | null {
  if (parsed.calleeType !== 'Identifier') {
    return null;
  }

  const methodName = getIdentifierValue(parsed.callee);
  if (!methodName || !COMMAND_EXEC_METHODS.has(methodName)) {
    return null;
  }

  const firstArg = parsed.args[0];
  if (!firstArg) {
    return null;
  }

  const argExpr = getArgumentExpression(firstArg);
  if (!argExpr) {
    return null;
  }

  if (hasTemplateInterpolation(argExpr)) {
    return {
      type: 'command-injection',
      offset: parsed.span.start,
      method: methodName,
    };
  }

  return null;
}

// ============================================================================
// PATH TRAVERSAL DETECTION
// ============================================================================

/**
 * Check if an argument represents untrusted input
 *
 * Untrusted types: Identifier, MemberExpression, CallExpression, TemplateLiteral with expressions
 * Safe types: StringLiteral, NumericLiteral
 */
function isUntrustedArgument(arg: Node): boolean {
  const argExpr = getArgumentExpression(arg);
  if (!argExpr) {
    return false;
  }

  const argType = getNodeType(argExpr);
  if (!argType) {
    return false;
  }

  // Direct untrusted types
  if (UNTRUSTED_ARG_TYPES.has(argType)) {
    return true;
  }

  // Template literal with expressions = potential untrusted input
  if (argType === 'TemplateLiteral') {
    return hasTemplateInterpolation(argExpr);
  }

  return false;
}

/**
 * Extract path method name from a MemberExpression callee
 * Returns method name if callee is path.join or path.resolve, null otherwise
 */
function extractPathMethod(callee: Node): string | null {
  const memberExpr = callee as { object?: Node; property?: Node };
  const { object, property } = memberExpr;

  if (!object || !property) {
    return null;
  }

  // Check if object is "path" identifier
  if (getNodeType(object) !== 'Identifier') {
    return null;
  }

  if (getIdentifierValue(object) !== 'path') {
    return null;
  }

  // Check if property is join or resolve identifier
  if (getNodeType(property) !== 'Identifier') {
    return null;
  }

  const methodName = getIdentifierValue(property);
  if (!methodName || !PATH_METHODS.has(methodName)) {
    return null;
  }

  return methodName;
}

/**
 * Detect path traversal from a parsed call expression
 *
 * Only flags when path segments (arguments after the first) contain untrusted input.
 * First argument is assumed to be a trusted base path.
 */
function detectPathTraversalFromCall(parsed: ParsedCallExpression): SecurityDetection | null {
  if (parsed.calleeType !== 'MemberExpression') {
    return null;
  }

  const methodName = extractPathMethod(parsed.callee);
  if (!methodName) {
    return null;
  }

  // Skip first argument (trusted base path), check remaining path segments
  const pathSegmentArgs = parsed.args.slice(1);
  const hasUntrustedSegment = pathSegmentArgs.some(isUntrustedArgument);

  if (hasUntrustedSegment) {
    return {
      type: 'path-traversal',
      offset: parsed.span.start,
      method: `path.${methodName}`,
    };
  }

  return null;
}

// ============================================================================
// MAIN DETECTOR
// ============================================================================

/** Strategy function type for security detection */
type SecurityDetector = (parsed: ParsedCallExpression) => SecurityDetection | null;

/** Ordered list of security detection strategies */
const SECURITY_DETECTORS: SecurityDetector[] = [
  detectCommandInjectionFromCall,
  detectPathTraversalFromCall,
];

/**
 * Detect security issue from AST node
 *
 * @param node - SWC AST node
 * @returns Detection result or null if no issue found
 */
export function detectSecurityIssue(node: Node): SecurityDetection | null {
  const parsed = parseCallExpression(node);
  if (!parsed) {
    return null;
  }

  for (const detector of SECURITY_DETECTORS) {
    const result = detector(parsed);
    if (result) {
      return result;
    }
  }

  return null;
}

// ============================================================================
// SPECIALIZED DETECTORS
// ============================================================================

/**
 * Detect command injection specifically
 *
 * Detects dangerous patterns like:
 * - execSync(\`rm -rf \${userInput}\`)
 * - spawn(\`echo \${data}\`)
 */
export function detectCommandInjection(node: Node): SecurityDetection | null {
  const result = detectSecurityIssue(node);
  return result?.type === 'command-injection' ? result : null;
}

/**
 * Detect path traversal specifically
 *
 * Only flags when path segments (arguments after the first) contain untrusted input.
 * First argument is assumed to be a trusted base path.
 *
 * SAFE patterns (not flagged):
 * - path.join(projectRoot, 'package.json')
 * - path.join(basePath, 'src', 'lib')
 * - path.resolve(cwd, 'config.ts')
 *
 * DANGEROUS patterns (flagged):
 * - path.join(baseDir, userInput)
 * - path.join(root, fileName)
 * - path.resolve(dir, `${prefix}/file`)
 */
export function detectPathTraversal(node: Node): SecurityDetection | null {
  const result = detectSecurityIssue(node);
  return result?.type === 'path-traversal' ? result : null;
}
