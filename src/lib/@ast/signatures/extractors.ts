/**
 * @module lib/parsing/signatures/extractors
 * @description AST-based signature extraction from SWC nodes
 *
 * Provides pure functions to extract signatures from various AST node types.
 * Uses the SWC parser for fast, accurate TypeScript/JavaScript parsing.
 *
 * @example
 * import { extractFunctionSignature, extractClassSignatures } from '@/lib/@ast/signatures';
 *
 * const ctx: ExtractionContext = {
 *   content: sourceCode,
 *   lineOffsets: calculateLineOffsets(sourceCode),
 *   baseOffset: 0,
 *   filePath: 'src/utils.ts',
 *   options: DEFAULT_SIGNATURE_OPTIONS,
 * };
 *
 * const sig = extractFunctionSignature(funcNode, ctx, true);
 */

import type {
  ClassDeclaration,
  ClassMember,
  ClassMethod,
  FunctionDeclaration,
  FunctionExpression,
  Module,
  ModuleItem,
  Node,
  TsInterfaceDeclaration,
  TsTypeAliasDeclaration,
  VariableDeclaration,
  VariableDeclarator,
} from '@swc/core';
import { offsetToLine } from '@/lib/@ast';
import {
  isArrowFunction,
  isClassDeclaration,
  isClassMethod,
  isExportDeclaration,
  isExportDefaultDeclaration,
  isFunctionDeclaration,
  isFunctionExpression,
  isIdentifier,
  isTsInterface,
  isTsTypeAlias,
  isVariableDeclaration,
} from '@/lib/@ast/analysis/guards';

import { INTERNAL_PREFIX, PRIVATE_PREFIX } from './constants';
import {
  formatClassSignatureText,
  formatConstFunctionText,
  formatInterfaceSignatureText,
  formatMethodSignatureText,
  formatWithExport,
} from './format-helpers';
import {
  extractConstTypeSignature,
  extractDeclarationLine,
  extractFirstLine,
  extractSignatureText,
} from './text-extraction';
import type { ExtractionContext, Signature } from './types';

// ============================================================================
// NODE SPAN HELPERS
// ============================================================================

/**
 * Safely extract span from AST node
 *
 * @param node - Any SWC AST node
 * @returns Span with start/end offsets, or null if not available
 */
export function getNodeSpan(node: Node): { start: number; end: number } | null {
  const span = (node as { span?: { start: number; end: number } }).span;
  return span ?? null;
}

// ============================================================================
// MODULE-LEVEL EXTRACTION
// ============================================================================

/**
 * Extract all signatures from a parsed module AST
 *
 * Iterates through all top-level declarations and extracts their signatures.
 *
 * @param ast - Parsed module AST from SWC
 * @param ctx - Extraction context
 * @returns Array of extracted signatures
 *
 * @example
 * const { ast, lineOffsets, baseOffset } = parseFile('app.ts', code);
 * const ctx = { content: code, lineOffsets, baseOffset, filePath: 'app.ts', options };
 * const signatures = extractFromModule(ast, ctx);
 */
export function extractFromModule(ast: Module, ctx: ExtractionContext): Signature[] {
  const signatures: Signature[] = [];

  for (const item of ast.body) {
    const extracted = extractFromModuleItem(item, ctx);
    signatures.push(...extracted);
  }

  return signatures;
}

/**
 * Extract signatures from a single module item
 *
 * Handles exports, declarations, and various statement types.
 *
 * @param item - Module item (statement or declaration)
 * @param ctx - Extraction context
 * @returns Array of extracted signatures
 */
export function extractFromModuleItem(item: ModuleItem, ctx: ExtractionContext): Signature[] {
  // Handle export declarations
  if (isExportDeclaration(item)) {
    const decl = item.declaration as Node;
    return extractFromDeclaration(decl, ctx, true);
  }

  if (isExportDefaultDeclaration(item)) {
    const decl = item.decl as Node;
    return extractFromDeclaration(decl, ctx, true);
  }

  // Handle non-exported top-level declarations
  if (isFunctionDeclaration(item)) {
    return extractFromDeclaration(item, ctx, false);
  }

  if (isClassDeclaration(item)) {
    return extractFromDeclaration(item, ctx, false);
  }

  if (isVariableDeclaration(item)) {
    return extractFromDeclaration(item, ctx, false);
  }

  if (isTsTypeAlias(item)) {
    return extractFromDeclaration(item, ctx, false);
  }

  if (isTsInterface(item)) {
    return extractFromDeclaration(item, ctx, false);
  }

  return [];
}

/**
 * Extract signatures from a declaration node
 *
 * Routes to the appropriate extractor based on node type.
 *
 * @param node - Declaration node
 * @param ctx - Extraction context
 * @param isExported - Whether the declaration is exported
 * @returns Array of extracted signatures
 */
export function extractFromDeclaration(
  node: Node,
  ctx: ExtractionContext,
  isExported: boolean,
): Signature[] {
  if (isFunctionDeclaration(node)) {
    const sig = extractFunctionSignature(node, ctx, isExported);
    return sig ? [sig] : [];
  }

  if (isFunctionExpression(node)) {
    const sig = extractFunctionExprSignature(node, ctx, isExported);
    return sig ? [sig] : [];
  }

  if (isClassDeclaration(node)) {
    return extractClassSignatures(node, ctx, isExported);
  }

  if (isVariableDeclaration(node)) {
    return extractVariableSignatures(node, ctx, isExported);
  }

  if (isTsTypeAlias(node)) {
    const sig = extractTypeAliasSignature(node, ctx, isExported);
    return sig ? [sig] : [];
  }

  if (isTsInterface(node)) {
    const sig = extractInterfaceSignature(node, ctx, isExported);
    return sig ? [sig] : [];
  }

  return [];
}

// ============================================================================
// FUNCTION SIGNATURES
// ============================================================================

/**
 * Extract signature from function declaration
 *
 * @param func - FunctionDeclaration node
 * @param ctx - Extraction context
 * @param isExported - Whether the function is exported
 * @returns Signature or null if filtered out
 *
 * @example
 * const sig = extractFunctionSignature(funcNode, ctx, true);
 * // { type: 'function', name: 'parseDate', text: 'export function parseDate(...)', ... }
 */
export function extractFunctionSignature(
  func: FunctionDeclaration,
  ctx: ExtractionContext,
  isExported: boolean,
): Signature | null {
  const name = func.identifier?.value;
  if (!name) return null;
  if (!ctx.options.includeInternal && name.startsWith(INTERNAL_PREFIX)) return null;

  const span = getNodeSpan(func);
  if (!span) return null;

  const line = offsetToLine(span.start - ctx.baseOffset, ctx.lineOffsets);
  const text = extractSignatureText(
    ctx.content,
    span.start - ctx.baseOffset,
    span.end - ctx.baseOffset,
    ctx.options.maxLength,
  );

  return {
    file: ctx.filePath,
    line,
    text: formatWithExport(text, isExported),
    type: 'function',
    name,
    isExported,
  };
}

/**
 * Extract signature from function expression (for default exports)
 *
 * @param func - FunctionExpression node
 * @param ctx - Extraction context
 * @param isExported - Whether the function is exported
 * @returns Signature or null if filtered out
 */
export function extractFunctionExprSignature(
  func: FunctionExpression,
  ctx: ExtractionContext,
  isExported: boolean,
): Signature | null {
  const name = func.identifier?.value ?? 'default';

  const span = getNodeSpan(func);
  if (!span) return null;

  const line = offsetToLine(span.start - ctx.baseOffset, ctx.lineOffsets);
  const text = extractSignatureText(
    ctx.content,
    span.start - ctx.baseOffset,
    span.end - ctx.baseOffset,
    ctx.options.maxLength,
  );

  return {
    file: ctx.filePath,
    line,
    text: formatWithExport(text, isExported),
    type: 'function',
    name,
    isExported,
  };
}

// ============================================================================
// CLASS SIGNATURES
// ============================================================================

/**
 * Extract signatures from class declaration
 *
 * Extracts both the class signature and all method signatures.
 *
 * @param cls - ClassDeclaration node
 * @param ctx - Extraction context
 * @param isExported - Whether the class is exported
 * @returns Array of signatures (class + methods)
 *
 * @example
 * const sigs = extractClassSignatures(classNode, ctx, true);
 * // [
 * //   { type: 'class', name: 'UserService', ... },
 * //   { type: 'method', name: 'findById', ... },
 * //   { type: 'method', name: 'create', ... },
 * // ]
 */
export function extractClassSignatures(
  cls: ClassDeclaration,
  ctx: ExtractionContext,
  isExported: boolean,
): Signature[] {
  const signatures: Signature[] = [];

  const className = cls.identifier?.value;
  if (!className) return signatures;
  if (!ctx.options.includeInternal && className.startsWith(INTERNAL_PREFIX)) return signatures;

  // Extract class signature
  const span = getNodeSpan(cls);
  if (span) {
    const line = offsetToLine(span.start - ctx.baseOffset, ctx.lineOffsets);
    const text = extractDeclarationLine(
      ctx.content,
      span.start - ctx.baseOffset,
      ctx.options.maxLength,
    );

    signatures.push({
      file: ctx.filePath,
      line,
      text: formatClassSignatureText(text, isExported, cls),
      type: 'class',
      name: className,
      isExported,
    });
  }

  // Extract method signatures
  const methods = extractMethodSignatures(cls.body ?? [], ctx);
  signatures.push(...methods);

  return signatures;
}

/**
 * Extract signatures from class methods
 *
 * @param body - Array of class members
 * @param ctx - Extraction context
 * @returns Array of method signatures
 */
export function extractMethodSignatures(body: ClassMember[], ctx: ExtractionContext): Signature[] {
  const signatures: Signature[] = [];

  for (const member of body) {
    if (!isClassMethod(member)) continue;

    const method = member as ClassMethod;
    if (!isIdentifier(method.key)) continue;

    const name = method.key.value;
    if (!ctx.options.includePrivate && name.startsWith(PRIVATE_PREFIX)) continue;
    if (!ctx.options.includeInternal && name.startsWith(INTERNAL_PREFIX)) continue;

    const span = getNodeSpan(method);
    if (!span) continue;

    const line = offsetToLine(span.start - ctx.baseOffset, ctx.lineOffsets);
    const text = extractSignatureText(
      ctx.content,
      span.start - ctx.baseOffset,
      span.end - ctx.baseOffset,
      ctx.options.maxLength,
    );

    signatures.push({
      file: ctx.filePath,
      line,
      text: formatMethodSignatureText(text, method),
      type: 'method',
      name,
      isExported: false, // Methods inherit export from class
    });
  }

  return signatures;
}

// ============================================================================
// VARIABLE SIGNATURES
// ============================================================================

/**
 * Extract signatures from variable declaration
 *
 * Extracts signatures for arrow functions and typed constants.
 *
 * @param varDecl - VariableDeclaration node
 * @param ctx - Extraction context
 * @param isExported - Whether the variable is exported
 * @returns Array of signatures
 */
export function extractVariableSignatures(
  varDecl: VariableDeclaration,
  ctx: ExtractionContext,
  isExported: boolean,
): Signature[] {
  const signatures: Signature[] = [];

  for (const declarator of varDecl.declarations as VariableDeclarator[]) {
    const sig = extractDeclaratorSignature(declarator, varDecl.kind, ctx, isExported);
    if (sig) signatures.push(sig);
  }

  return signatures;
}

/**
 * Extract signature from a single variable declarator
 *
 * @param declarator - VariableDeclarator node
 * @param kind - Declaration kind (const/let/var)
 * @param ctx - Extraction context
 * @param isExported - Whether the variable is exported
 * @returns Signature or null if not a function or typed const
 */
export function extractDeclaratorSignature(
  declarator: VariableDeclarator,
  kind: 'const' | 'let' | 'var',
  ctx: ExtractionContext,
  isExported: boolean,
): Signature | null {
  if (!isIdentifier(declarator.id)) return null;

  const name = declarator.id.value;
  if (!ctx.options.includeInternal && name.startsWith(INTERNAL_PREFIX)) return null;

  const init = declarator.init;
  const hasTypeAnnotation = !!(declarator.id as unknown as { typeAnnotation?: unknown })
    .typeAnnotation;

  // Arrow function or function expression
  if (init && (isArrowFunction(init) || isFunctionExpression(init))) {
    const span = getNodeSpan(declarator);
    if (!span) return null;

    const line = offsetToLine(span.start - ctx.baseOffset, ctx.lineOffsets);
    const text = extractSignatureText(
      ctx.content,
      span.start - ctx.baseOffset,
      span.end - ctx.baseOffset,
      ctx.options.maxLength,
    );

    return {
      file: ctx.filePath,
      line,
      text: formatConstFunctionText(text, kind, isExported),
      type: 'function',
      name,
      isExported,
    };
  }

  // Const with type annotation (e.g., export const config: Config = {...})
  if (hasTypeAnnotation) {
    const span = getNodeSpan(declarator);
    if (!span) return null;

    const line = offsetToLine(span.start - ctx.baseOffset, ctx.lineOffsets);
    const text = extractConstTypeSignature(
      ctx.content,
      span.start - ctx.baseOffset,
      span.end - ctx.baseOffset,
      ctx.options.maxLength,
    );

    return {
      file: ctx.filePath,
      line,
      text: formatConstFunctionText(text, kind, isExported),
      type: 'const',
      name,
      isExported,
    };
  }

  return null;
}

// ============================================================================
// TYPE ALIAS SIGNATURES
// ============================================================================

/**
 * Extract signature from type alias declaration
 *
 * @param node - Type alias node
 * @param ctx - Extraction context
 * @param isExported - Whether the type is exported
 * @returns Signature or null if filtered out
 */
export function extractTypeAliasSignature(
  node: Node,
  ctx: ExtractionContext,
  isExported: boolean,
): Signature | null {
  const typeAlias = node as TsTypeAliasDeclaration;
  const name = typeAlias.id?.value;
  if (!name) return null;
  if (!ctx.options.includeInternal && name.startsWith(INTERNAL_PREFIX)) return null;

  const span = getNodeSpan(node);
  if (!span) return null;

  const line = offsetToLine(span.start - ctx.baseOffset, ctx.lineOffsets);
  const text = extractFirstLine(ctx.content, span.start - ctx.baseOffset, ctx.options.maxLength);

  return {
    file: ctx.filePath,
    line,
    text: formatWithExport(text, isExported),
    type: 'type',
    name,
    isExported,
  };
}

// ============================================================================
// INTERFACE SIGNATURES
// ============================================================================

/**
 * Extract signature from interface declaration
 *
 * @param node - Interface node
 * @param ctx - Extraction context
 * @param isExported - Whether the interface is exported
 * @returns Signature or null if filtered out
 */
export function extractInterfaceSignature(
  node: Node,
  ctx: ExtractionContext,
  isExported: boolean,
): Signature | null {
  const iface = node as TsInterfaceDeclaration;
  const name = iface.id?.value;
  if (!name) return null;
  if (!ctx.options.includeInternal && name.startsWith(INTERNAL_PREFIX)) return null;

  const span = getNodeSpan(node);
  if (!span) return null;

  const line = offsetToLine(span.start - ctx.baseOffset, ctx.lineOffsets);
  const text = extractDeclarationLine(
    ctx.content,
    span.start - ctx.baseOffset,
    ctx.options.maxLength,
  );

  return {
    file: ctx.filePath,
    line,
    text: formatInterfaceSignatureText(text, isExported, iface),
    type: 'interface',
    name,
    isExported,
  };
}
