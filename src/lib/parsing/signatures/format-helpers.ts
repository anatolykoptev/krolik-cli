/**
 * @module lib/parsing/signatures/format-helpers
 * @description Pure formatting helpers for signature text
 *
 * These functions format extracted text into proper signature strings.
 * They are pure (no side effects) and work with raw text only.
 */

import type { ClassDeclaration, ClassMethod, Identifier, TsInterfaceDeclaration } from '@swc/core';

import { isIdentifier } from '@/lib/parsing/analysis/guards';

// ============================================================================
// EXPORT FORMATTING
// ============================================================================

/**
 * Add export prefix to signature if needed
 *
 * @param text - Raw signature text
 * @param isExported - Whether the symbol is exported
 * @returns Formatted signature with export prefix if needed
 *
 * @example
 * formatWithExport('function foo(): void', true)
 * // Returns: 'export function foo(): void'
 *
 * @example
 * formatWithExport('export function foo(): void', true)
 * // Returns: 'export function foo(): void' (no duplicate)
 */
export function formatWithExport(text: string, isExported: boolean): string {
  let signature = text.trim();
  if (isExported && !signature.startsWith('export')) {
    signature = `export ${signature}`;
  }
  return signature;
}

// ============================================================================
// CLASS FORMATTING
// ============================================================================

/**
 * Format class signature text, building from AST if text extraction failed
 *
 * @param text - Extracted signature text
 * @param isExported - Whether the class is exported
 * @param cls - Class declaration node for fallback building
 * @returns Formatted class signature
 *
 * @example
 * formatClassSignatureText('class Foo extends Bar', true, classNode)
 * // Returns: 'export class Foo extends Bar'
 */
export function formatClassSignatureText(
  text: string,
  isExported: boolean,
  cls: ClassDeclaration,
): string {
  let signature = text.trim();

  // Build signature if text extraction failed
  if (!signature.includes('class')) {
    const name = cls.identifier?.value ?? 'Anonymous';
    const superClass = cls.superClass ? extractIdentifierValue(cls.superClass) : null;
    const impl = cls.implements?.map((i) => extractExpressionName(i)).filter(Boolean);

    signature = `class ${name}`;
    if (superClass) signature += ` extends ${superClass}`;
    if (impl && impl.length > 0) signature += ` implements ${impl.join(', ')}`;
  }

  return formatWithExport(signature, isExported);
}

// ============================================================================
// METHOD FORMATTING
// ============================================================================

/**
 * Format method signature text, building minimal signature if needed
 *
 * @param text - Extracted signature text
 * @param method - Class method node for fallback building
 * @returns Formatted method signature
 *
 * @example
 * formatMethodSignatureText('async findById(id: string): Promise<User>', methodNode)
 * // Returns: 'async findById(id: string): Promise<User>'
 */
export function formatMethodSignatureText(text: string, method: ClassMethod): string {
  let signature = text.trim();

  if (!signature) {
    const name = isIdentifier(method.key) ? method.key.value : 'method';
    const isAsync = method.function?.async ? 'async ' : '';
    const isStatic = method.isStatic ? 'static ' : '';
    signature = `${isStatic}${isAsync}${name}()`;
  }

  return signature;
}

// ============================================================================
// CONST/VARIABLE FORMATTING
// ============================================================================

/**
 * Format const/arrow function signature text
 *
 * @param text - Extracted signature text
 * @param kind - Declaration kind (const/let/var)
 * @param isExported - Whether the variable is exported
 * @returns Formatted const signature
 *
 * @example
 * formatConstFunctionText('handler = async () => void', 'const', true)
 * // Returns: 'export const handler = async () => void'
 */
export function formatConstFunctionText(text: string, kind: string, isExported: boolean): string {
  let signature = text.trim();

  if (
    !signature.startsWith('const') &&
    !signature.startsWith('let') &&
    !signature.startsWith('var')
  ) {
    signature = `${kind} ${signature}`;
  }

  return formatWithExport(signature, isExported);
}

// ============================================================================
// INTERFACE FORMATTING
// ============================================================================

/**
 * Format interface signature text, building from AST if text extraction failed
 *
 * @param text - Extracted signature text
 * @param isExported - Whether the interface is exported
 * @param iface - Interface declaration node for fallback building
 * @returns Formatted interface signature
 *
 * @example
 * formatInterfaceSignatureText('interface User extends Base', true, ifaceNode)
 * // Returns: 'export interface User extends Base'
 */
export function formatInterfaceSignatureText(
  text: string,
  isExported: boolean,
  iface: TsInterfaceDeclaration,
): string {
  let signature = text.trim();

  if (!signature.includes('interface')) {
    const name = iface.id?.value ?? 'Anonymous';
    const ext = iface.extends?.map((e) => extractExpressionName(e)).filter(Boolean);

    signature = `interface ${name}`;
    if (ext && ext.length > 0) signature += ` extends ${ext.join(', ')}`;
  }

  return formatWithExport(signature, isExported);
}

// ============================================================================
// AST HELPER UTILITIES
// ============================================================================

/**
 * Extract identifier value from a node that may be an Identifier
 *
 * @param node - Any AST node
 * @returns Identifier value or null
 */
function extractIdentifierValue(node: unknown): string | null {
  if (node && typeof node === 'object' && 'type' in node && node.type === 'Identifier') {
    return (node as Identifier).value;
  }
  return null;
}

/**
 * Extract name from an expression that has an expression property
 *
 * @param node - Expression node with potential expression property
 * @returns Expression name or null
 */
function extractExpressionName(node: unknown): string | null {
  const expr = (node as { expression?: unknown }).expression;
  if (expr && typeof expr === 'object' && 'type' in expr && expr.type === 'Identifier') {
    return (expr as Identifier).value;
  }
  return null;
}
