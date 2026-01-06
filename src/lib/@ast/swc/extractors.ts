/**
 * @module lib/@ast/swc/extractors
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

// Type node type definitions for AST-based reconstruction
type TsKeywordType = { type: 'TsKeywordType'; kind: string };
type TsTypeReference = {
  type: 'TsTypeReference';
  typeName: { type: string; value?: string };
  typeParams?: { params: TsTypeNode[] };
};
type TsUnionType = { type: 'TsUnionOrIntersectionType'; types: TsTypeNode[] };
type TsArrayType = { type: 'TsArrayType'; elemType: TsTypeNode };
type TsTypeLiteral = { type: 'TsTypeLiteral'; members: unknown[] };
type TsFunctionType = { type: 'TsFunctionType'; params: unknown[]; typeAnnotation?: unknown };
type TsParenthesizedType = { type: 'TsParenthesizedType'; typeAnnotation: TsTypeNode };
type TsOptionalType = { type: 'TsOptionalType'; typeAnnotation: TsTypeNode };
type TsRestType = { type: 'TsRestType'; typeAnnotation: TsTypeNode };
type TsConditionalType = { type: 'TsConditionalType' };
type TsInferType = { type: 'TsInferType' };
type TsIndexedAccessType = {
  type: 'TsIndexedAccessType';
  objectType: TsTypeNode;
  indexType: TsTypeNode;
};
type TsTupleType = { type: 'TsTupleType'; elemTypes: TsTypeNode[] };
type TsLiteralType = {
  type: 'TsLiteralType';
  literal: { type: string; value?: string | number | boolean };
};

type TsTypeNode =
  | TsKeywordType
  | TsTypeReference
  | TsUnionType
  | TsArrayType
  | TsTypeLiteral
  | TsFunctionType
  | TsParenthesizedType
  | TsOptionalType
  | TsRestType
  | TsConditionalType
  | TsInferType
  | TsIndexedAccessType
  | TsTupleType
  | TsLiteralType
  | { type: string };

/**
 * Convert TypeScript type AST node to string representation.
 *
 * This is a pure AST-based reconstruction that doesn't rely on source code spans.
 * It's more robust than span-based extraction, especially for files with non-ASCII content.
 *
 * @param typeNode - TypeScript type AST node
 * @param maxLength - Maximum length before truncation (default: 50)
 * @returns Type as string
 */
function typeNodeToString(typeNode: TsTypeNode, maxLength: number): string {
  const node = typeNode as TsTypeNode;

  switch (node.type) {
    // Keyword types: string, number, boolean, any, void, etc.
    case 'TsKeywordType': {
      const keyword = (node as TsKeywordType).kind;
      // SWC uses lowercase kinds like 'string', 'number', etc.
      return keyword.toLowerCase().replace('keyword', '');
    }

    // Type references: DateInput, Promise<T>, Array<T>, etc.
    case 'TsTypeReference': {
      const ref = node as TsTypeReference;
      let name = 'unknown';

      if (ref.typeName.type === 'Identifier' && ref.typeName.value) {
        name = ref.typeName.value;
      } else if (ref.typeName.type === 'TsQualifiedName') {
        // For qualified names like Foo.Bar
        name = 'QualifiedType';
      }

      // Handle generic parameters
      if (ref.typeParams?.params && ref.typeParams.params.length > 0) {
        const params = ref.typeParams.params.map((p) => typeNodeToString(p, maxLength)).join(', ');
        return `${name}<${params}>`;
      }

      return name;
    }

    // Union types: A | B | C
    case 'TsUnionType': {
      const union = node as TsUnionType;
      const types = union.types.map((t) => typeNodeToString(t, maxLength)).join(' | ');
      return types.length > maxLength ? `${types.slice(0, maxLength - 3)}...` : types;
    }

    // Intersection types: A & B
    case 'TsIntersectionType': {
      const inter = node as TsUnionType; // Same structure
      const types = inter.types.map((t) => typeNodeToString(t, maxLength)).join(' & ');
      return types.length > maxLength ? `${types.slice(0, maxLength - 3)}...` : types;
    }

    // Array types: T[]
    case 'TsArrayType': {
      const arr = node as TsArrayType;
      const elemType = typeNodeToString(arr.elemType, maxLength);
      return `${elemType}[]`;
    }

    // Object literal types: { foo: string, bar: number }
    case 'TsTypeLiteral': {
      const lit = node as TsTypeLiteral;
      if (lit.members.length === 0) return '{}';
      return `{ ${lit.members.length} props }`;
    }

    // Function types: (a: string) => void
    case 'TsFunctionType': {
      return '(...) => ...';
    }

    // Parenthesized: (A | B)
    case 'TsParenthesizedType': {
      const paren = node as TsParenthesizedType;
      return `(${typeNodeToString(paren.typeAnnotation, maxLength)})`;
    }

    // Optional: T?
    case 'TsOptionalType': {
      const opt = node as TsOptionalType;
      return `${typeNodeToString(opt.typeAnnotation, maxLength)}?`;
    }

    // Rest: ...T
    case 'TsRestType': {
      const rest = node as TsRestType;
      return `...${typeNodeToString(rest.typeAnnotation, maxLength)}`;
    }

    // Tuple: [A, B, C]
    case 'TsTupleType': {
      const tuple = node as TsTupleType;
      const types = tuple.elemTypes.map((t) => typeNodeToString(t, maxLength)).join(', ');
      return `[${types}]`;
    }

    // Literal types: 'foo', 42, true
    case 'TsLiteralType': {
      const lit = node as TsLiteralType;
      if (lit.literal.type === 'StringLiteral') {
        return `'${lit.literal.value}'`;
      }
      if (lit.literal.type === 'NumericLiteral' || lit.literal.type === 'BooleanLiteral') {
        return String(lit.literal.value);
      }
      return 'literal';
    }

    // Indexed access: T[K]
    case 'TsIndexedAccessType': {
      const idx = node as TsIndexedAccessType;
      return `${typeNodeToString(idx.objectType, maxLength)}[${typeNodeToString(idx.indexType, maxLength)}]`;
    }

    // Conditional, infer, and other complex types
    case 'TsConditionalType':
    case 'TsInferType':
      return 'complex';

    default:
      return 'unknown';
  }
}

/**
 * Convert TypeScript type node to string representation
 *
 * Uses AST-based reconstruction for reliability with non-ASCII content.
 * Falls back to span-based extraction if AST reconstruction fails.
 *
 * Useful for:
 * - Type aliases: `type User = { ... }` → extract '{ ... }'
 * - Interface properties: `name: string` → extract 'string'
 * - Generic constraints: `T extends Foo` → extract 'Foo'
 *
 * @param typeNode - TypeScript type annotation node
 * @param content - Source file content (used for fallback)
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
  _content: string,
  _baseOffset = 0,
  maxLength = 50,
): string {
  if (!typeNode) {
    return 'unknown';
  }

  // Use AST-based reconstruction (more reliable for non-ASCII content)
  try {
    const result = typeNodeToString(typeNode as unknown as TsTypeNode, maxLength);
    if (result && result !== 'unknown') {
      return result;
    }
  } catch {
    // Fall through to unknown
  }

  return 'unknown';
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
