/**
 * @module lib/@swc
 * @deprecated Use '@/lib/parsing/swc' for parser and '@/lib/@patterns' for detectors.
 * This module will be removed in v7.0.
 *
 * @description Shared SWC AST infrastructure for fast TypeScript/JavaScript parsing
 *
 * Migration:
 * ```ts
 * // Before
 * import { parseFile, detectConsole } from '@/lib/@swc';
 *
 * // After
 * import { parseFile } from '@/lib/parsing/swc';
 * import { detectConsole } from '@/lib/@patterns/lint';
 * ```
 */

// ============================================================================
// PARSER CORE - Re-export from parsing/swc
// ============================================================================

// Re-export SWC types that are commonly needed
export type {
  ArrowFunctionExpression,
  CallExpression,
  Expression,
  FunctionDeclaration,
  FunctionExpression,
  Identifier,
  JSXAttribute,
  JSXOpeningElement,
  MemberExpression,
  Module,
  Node,
  NumericLiteral,
  Span,
  Statement,
  StringLiteral,
  TsType,
} from '@swc/core';

// Export parser core from new location
export {
  // Types
  type CacheEntry,
  // Visitor
  calculateLineOffsets,
  // Parser
  clearCache,
  // Extractors
  collectMethodChain,
  countNodeTypes,
  extractAllStringArgs,
  extractStringArg,
  extractTypeString,
  type FunctionInfo,
  findNodesByType,
  getCacheStats,
  getCalleeName,
  getCalleeObjectName,
  getContext,
  getIdentifierName,
  getJSXAttributeValue,
  getJSXElementName,
  // String context
  getLineContent,
  getLineNumber,
  getNodeSpan,
  getNodeText,
  getNodeType,
  getRootObjectName,
  getSnippet,
  isCallingFunction,
  isCallingMethod,
  isInsideComment,
  isInsideLineComment,
  isInsideString,
  isInsideStringLine,
  isInsideStringOrComment,
  offsetToLine,
  offsetToPosition,
  type ParseOptions,
  type Position,
  type PositionRange,
  parseFile,
  parseFileUncached,
  type Range,
  type VisitorCallback,
  type VisitorCallbacks,
  type VisitorContext,
  type VisitorResult,
  validateSyntax,
  visitNode,
  visitNodeWithCallbacks,
} from '../parsing/swc';

// ============================================================================
// DETECTORS
// ============================================================================

// Export detector types
// Export complexity types
export type {
  ComplexityDetection,
  DetectorContext,
  FunctionTrackingInfo,
  HardcodedDetection,
  HardcodedType,
  LintDetection,
  LintIssueType,
  ModernizationDetection,
  ModernizationIssueType,
  SecurityDetection,
  SecurityIssueType,
  TypeSafetyDetection,
  TypeSafetyIssueType,
} from './detectors';
// Export all detectors
export {
  // Complexity detectors
  ComplexityTracker,
  // Lint detectors
  detectAlert,
  // Type-safety detectors
  detectAnyAnnotation,
  detectAnyAssertion,
  // Security detectors
  detectCommandInjection,
  detectConsole,
  detectDebugger,
  detectDoubleAssertion,
  detectEmptyCatch,
  detectEval,
  // Hardcoded value detectors
  detectHardcodedUrl,
  detectHardcodedValue,
  detectHexColor,
  detectLintIssue,
  detectMagicNumber,
  // Modernization detectors
  detectModernizationIssue,
  detectNonNullAssertion,
  detectPathTraversal,
  detectRequire,
  detectSecurityIssue,
  detectTypeSafetyIssue,
  getComplexityWeight,
  isAnyType,
  isArrayIndex,
  isComplexityNode,
  isInConstDeclaration,
  isUnknownType,
} from './detectors';

// Note: String context utilities are included in the parsing/swc re-export above
