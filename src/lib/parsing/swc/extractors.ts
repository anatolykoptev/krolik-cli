/**
 * @module lib/parsing/swc/extractors
 * @description Reusable utility functions for extracting information from SWC AST nodes
 *
 * This module provides pure, side-effect-free functions for common AST extraction patterns.
 * All functions handle edge cases gracefully by returning null instead of throwing errors.
 *
 * Used by:
 * - Type parsers (interfaces, type aliases)
 * - Zod schema parsers
 * - Component analyzers (JSX)
 * - Form field extractors
 *
 * @example
 * import { getCalleeName, collectMethodChain } from '@/lib/@swc/extractors';
 *
 * // Extract function name from CallExpression
 * const name = getCalleeName(callNode); // 'register'
 *
 * // Collect Zod method chain
 * const methods = collectMethodChain(zodCall); // ['string', 'min', 'max', 'optional']
 */

import type {
  CallExpression,
  Identifier,
  JSXAttribute,
  JSXAttrValue,
  JSXElementName,
  JSXMemberExpression,
  JSXOpeningElement,
  MemberExpression,
  Node,
  StringLiteral,
  TsType,
} from '@swc/core';

/**
 * Extract function name from CallExpression
 *
 * Handles various callee patterns:
 * - Direct call: `foo()` → 'foo'
 * - Method call: `obj.method()` → 'method'
 * - Chained call: `z.string()` → 'string'
 * - Deep chain: `z.object().pick()` → 'pick'
 *
 * @param node - CallExpression node
 * @returns Function name or null if cannot be determined
 *
 * @example
 * getCalleeName(parseExpression('register()')) // 'register'
 * getCalleeName(parseExpression('form.register()')) // 'register'
 * getCalleeName(parseExpression('z.string()')) // 'string'
 */
export function getCalleeName(node: CallExpression): string | null {
  const callee = node.callee;

  // Direct identifier: foo()
  if (callee.type === 'Identifier') {
    return (callee as Identifier).value;
  }

  // Member expression: obj.method()
  if (callee.type === 'MemberExpression') {
    const member = callee as MemberExpression;
    if (member.property.type === 'Identifier') {
      return (member.property as Identifier).value;
    }
  }

  return null;
}

/**
 * Extract object name from method call
 *
 * Handles:
 * - Simple: `z.string()` → 'z'
 * - Nested: `console.log()` → 'console'
 * - Chained: `z.object().pick()` → 'z' (root object)
 *
 * @param node - CallExpression node
 * @returns Object name or null if not a method call
 *
 * @example
 * getCalleeObjectName(parseExpression('z.string()')) // 'z'
 * getCalleeObjectName(parseExpression('console.log()')) // 'console'
 * getCalleeObjectName(parseExpression('foo()')) // null (not a method call)
 */
export function getCalleeObjectName(node: CallExpression): string | null {
  const callee = node.callee;

  if (callee.type !== 'MemberExpression') {
    return null;
  }

  const member = callee as MemberExpression;
  let current = member.object;

  // Traverse to root object
  while (current.type === 'MemberExpression') {
    current = (current as MemberExpression).object;
  }

  // Root should be an identifier (skip Super and Import)
  if (current.type === 'Identifier') {
    return (current as Identifier).value;
  }

  return null;
}

/**
 * Extract string literal from function call argument
 *
 * Useful for:
 * - Form field names: `register("email")` → 'email'
 * - Translation keys: `t("common.submit")` → 'common.submit'
 * - Validation messages: `min(5, "Too short")` → 'Too short' (argIndex=1)
 *
 * @param node - CallExpression node
 * @param argIndex - Argument position (default: 0)
 * @returns String value or null if not a string literal
 *
 * @example
 * extractStringArg(parseExpression('register("email")')) // 'email'
 * extractStringArg(parseExpression('min(5, "error msg")'), 1) // 'error msg'
 * extractStringArg(parseExpression('register(variable)')) // null (not a literal)
 */
export function extractStringArg(node: CallExpression, argIndex = 0): string | null {
  const args = node.arguments;

  if (argIndex >= args.length) {
    return null;
  }

  const arg = args[argIndex];

  // Handle both direct expressions and spread arguments
  if (arg && 'expression' in arg) {
    const expr = arg.expression;
    if (expr.type === 'StringLiteral') {
      return (expr as StringLiteral).value;
    }
  }

  return null;
}

/**
 * Collect all method names in a call chain
 *
 * Extremely useful for Zod schemas and fluent APIs:
 * - `z.string().min(1).max(100).optional()` → ['string', 'min', 'max', 'optional']
 * - `z.object({ ... }).pick({ ... })` → ['object', 'pick']
 *
 * @param node - CallExpression node (can be any point in the chain)
 * @returns Array of method names in order from left to right
 *
 * @example
 * collectMethodChain(parseExpression('z.string().min(1).max(100)'))
 * // → ['string', 'min', 'max']
 *
 * collectMethodChain(parseExpression('z.object({}).pick({})'))
 * // → ['object', 'pick']
 */
export function collectMethodChain(node: CallExpression): string[] {
  const methods: string[] = [];
  let current: Node | undefined = node.callee;

  // Traverse the chain from right to left, collecting method names
  while (current) {
    if (current.type === 'MemberExpression') {
      const member = current as MemberExpression;

      // Add the property name
      if (member.property.type === 'Identifier') {
        methods.unshift((member.property as Identifier).value);
      }

      // Move to the next object in the chain
      current = member.object;
    } else if (current.type === 'CallExpression') {
      // Nested call expression - recurse
      const call = current as CallExpression;
      const nestedMethods = collectMethodChain(call);
      methods.unshift(...nestedMethods);
      break;
    } else {
      // Reached the end (e.g., Identifier 'z', or Super, or Import)
      break;
    }
  }

  return methods;
}

/**
 * Safely extract name from Identifier node
 *
 * Type-safe wrapper that checks node type before accessing value.
 *
 * @param node - Any AST node
 * @returns Identifier value or null if not an identifier
 *
 * @example
 * getIdentifierName(someNode) // 'myVariable' or null
 */
export function getIdentifierName(node: Node): string | null {
  if (node.type === 'Identifier') {
    return (node as Identifier).value;
  }
  return null;
}

/**
 * Extract component/element name from JSX opening tag
 *
 * Handles:
 * - Simple: `<Input />` → 'Input'
 * - Member: `<Form.Field />` → 'Form.Field'
 * - Namespaced: `<ui:Button />` → 'ui:Button'
 *
 * @param node - JSXOpeningElement node
 * @returns Element name or null if cannot be determined
 *
 * @example
 * getJSXElementName(parseJSX('<Input />').openingElement) // 'Input'
 * getJSXElementName(parseJSX('<Form.Field />').openingElement) // 'Form.Field'
 */
export function getJSXElementName(node: JSXOpeningElement): string | null {
  const name = node.name;

  if (!name) {
    return null;
  }

  return extractJSXName(name);
}

/**
 * Helper to extract name from JSXElementName (handles all variants)
 */
function extractJSXName(name: JSXElementName): string | null {
  if (name.type === 'Identifier') {
    return (name as Identifier).value;
  }

  if (name.type === 'JSXMemberExpression') {
    const member = name as JSXMemberExpression;
    const parts: string[] = [];

    // Traverse member expression chain
    let current: JSXElementName | JSXMemberExpression = member;
    while (current.type === 'JSXMemberExpression') {
      const prop = current.property;
      if (prop.type === 'Identifier') {
        parts.unshift((prop as Identifier).value);
      }
      current = (current as JSXMemberExpression).object;
    }

    // Add the root object
    if (current.type === 'Identifier') {
      parts.unshift((current as Identifier).value);
    }

    return parts.join('.');
  }

  if (name.type === 'JSXNamespacedName') {
    const ns = name.namespace;
    const local = name.name;
    return `${(ns as Identifier).value}:${(local as Identifier).value}`;
  }

  return null;
}

/**
 * Extract string value from JSX attribute
 *
 * Handles:
 * - String literal: `name="email"` → 'email'
 * - JSX expression: `name={'dynamic'}` → null (skip dynamic values)
 * - No value: `disabled` → null
 *
 * @param node - JSXAttribute node
 * @returns Attribute value or null if not a static string
 *
 * @example
 * getJSXAttributeValue(parseAttr('name="email"')) // 'email'
 * getJSXAttributeValue(parseAttr('name={var}')) // null (dynamic)
 * getJSXAttributeValue(parseAttr('disabled')) // null (no value)
 */
export function getJSXAttributeValue(node: JSXAttribute): string | null {
  const value = node.value;

  if (!value) {
    return null;
  }

  return extractJSXAttributeValue(value);
}

/**
 * Helper to extract value from JSXAttrValue
 */
function extractJSXAttributeValue(value: JSXAttrValue): string | null {
  if (value.type === 'StringLiteral') {
    return (value as StringLiteral).value;
  }

  // Skip JSXExpressionContainer (dynamic values)
  // Skip JSXElement (nested elements)
  // Skip JSXFragment

  return null;
}

/**
 * Convert TypeScript type node to string representation
 *
 * Uses the source code span to extract the exact type text.
 * Truncates long types for readability.
 *
 * IMPORTANT: SWC accumulates span offsets globally across parseSync calls.
 * You MUST pass the baseOffset from parseFile() to get correct results.
 *
 * Useful for:
 * - Type aliases: `type User = { ... }` → extract '{ ... }'
 * - Interface properties: `name: string` → extract 'string'
 * - Generic constraints: `T extends Foo` → extract 'Foo'
 *
 * @param typeNode - TypeScript type annotation node
 * @param content - Source file content
 * @param baseOffset - Base offset from parseFile() for span normalization (default: 0)
 * @param maxLength - Maximum length before truncation (default: 50)
 * @returns Type as string or 'unknown' if cannot be extracted
 *
 * @example
 * const { ast, baseOffset } = parseFile('example.ts', sourceCode);
 * extractTypeString(typeNode, sourceCode, baseOffset) // 'string | number'
 */
export function extractTypeString(
  typeNode: TsType,
  content: string,
  baseOffset = 0,
  maxLength = 50,
): string {
  if (!typeNode.span) {
    return 'unknown';
  }

  // SWC uses 1-based byte offsets, normalize with baseOffset and convert to 0-based
  const { start, end } = typeNode.span;
  const normalizedStart = start - baseOffset - 1;
  const normalizedEnd = end - baseOffset - 1;

  // Validate bounds
  if (normalizedStart < 0 || normalizedEnd > content.length || normalizedStart >= normalizedEnd) {
    return 'unknown';
  }

  let typeText = content.slice(normalizedStart, normalizedEnd).trim();

  if (typeText.length > maxLength) {
    typeText = `${typeText.slice(0, maxLength - 3)}...`;
  }

  return typeText || 'unknown';
}

/**
 * Check if a CallExpression is calling a specific function
 *
 * Convenience helper for filtering call expressions.
 *
 * @param node - CallExpression node
 * @param functionName - Expected function name
 * @returns true if matches
 *
 * @example
 * if (isCallingFunction(callNode, 'register')) {
 *   // Handle register() calls
 * }
 */
export function isCallingFunction(node: CallExpression, functionName: string): boolean {
  return getCalleeName(node) === functionName;
}

/**
 * Check if a CallExpression is calling a method on a specific object
 *
 * Convenience helper for filtering method calls.
 *
 * @param node - CallExpression node
 * @param objectName - Expected object name
 * @param methodName - Expected method name (optional)
 * @returns true if matches
 *
 * @example
 * if (isCallingMethod(callNode, 'z', 'string')) {
 *   // Handle z.string() calls
 * }
 *
 * if (isCallingMethod(callNode, 'console')) {
 *   // Handle any console.* calls
 * }
 */
export function isCallingMethod(
  node: CallExpression,
  objectName: string,
  methodName?: string,
): boolean {
  const objName = getCalleeObjectName(node);
  if (objName !== objectName) {
    return false;
  }

  if (methodName !== undefined) {
    const method = getCalleeName(node);
    return method === methodName;
  }

  return true;
}

/**
 * Extract all string arguments from a call expression
 *
 * Useful for extracting multiple string literals from function calls.
 *
 * @param node - CallExpression node
 * @returns Array of string values (skips non-string arguments)
 *
 * @example
 * extractAllStringArgs(parseExpression('foo("a", 123, "b")'))
 * // → ['a', 'b']
 */
export function extractAllStringArgs(node: CallExpression): string[] {
  const strings: string[] = [];

  for (let i = 0; i < node.arguments.length; i++) {
    const value = extractStringArg(node, i);
    if (value !== null) {
      strings.push(value);
    }
  }

  return strings;
}

/**
 * Get the root object name from a member expression chain
 *
 * Useful for identifying the base object in complex chains.
 *
 * @param node - MemberExpression node
 * @returns Root object name or null
 *
 * @example
 * getRootObjectName(parseExpression('a.b.c.d').expression)
 * // → 'a'
 */
export function getRootObjectName(node: MemberExpression): string | null {
  let current = node.object;

  // Traverse to root
  while (current.type === 'MemberExpression') {
    current = (current as MemberExpression).object;
  }

  // Only return value for Identifier (not Super or Import)
  if (current.type === 'Identifier') {
    return (current as Identifier).value;
  }

  return null;
}
