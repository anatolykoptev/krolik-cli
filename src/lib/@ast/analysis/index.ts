/**
 * @module lib/@ast/analysis
 * @description AST analysis utilities - type guards for SWC nodes
 *
 * This module provides type guards for SWC AST node types.
 *
 * For source file analysis (analyzeSourceFile, ExportedMember, etc.),
 * use @/lib/@discovery/source-analyzer instead.
 */

// Re-export type guards
export {
  type FunctionLike,
  isArrayPattern,
  isArrowFunction,
  isAssignmentPattern,
  isClassDeclaration,
  isClassMethod,
  isExportDeclaration,
  isExportDefaultDeclaration,
  isFunctionDeclaration,
  isFunctionExpression,
  isFunctionLike,
  isIdentifier,
  isObjectPattern,
  isRestElement,
  isTsEnum,
  isTsInterface,
  isTsTypeAlias,
  isVariableDeclaration,
} from './guards';
