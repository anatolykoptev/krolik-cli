/**
 * @module commands/context/parsers/zod-swc
 * @description SWC-based Zod schema parser (improved over regex-based parser)
 *
 * Key improvements:
 * - Proper handling of nested z.object() calls
 * - Accurate method chain parsing
 * - No false positives from strings/comments
 * - Type-safe AST traversal
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { CallExpression, Identifier, Node } from '@/lib/@swc';
import { getNodeType, parseFile, visitNodeWithCallbacks } from '@/lib/@swc';
import { scanDirectory } from '@/lib/core/fs';
import type { ZodField, ZodSchemaInfo } from './types';

/**
 * ObjectExpression node structure (simplified)
 */
interface ObjectExpressionNode {
  type: 'ObjectExpression';
  properties: Array<{
    type: string;
    key?: Node;
    value?: Node;
  }>;
}

/**
 * Variable declarator structure for schema parsing
 */
interface VariableDeclarator {
  id: { type: string; value?: string };
  init?: Node;
}

/**
 * Process a single variable declarator for Zod schema
 */
function processSchemaDeclarator(
  decl: VariableDeclarator,
  content: string,
  fileName: string,
): ZodSchemaInfo | null {
  // Check if variable name ends with "Schema"
  const varName = decl.id.type === 'Identifier' ? (decl.id as { value: string }).value : null;

  if (!varName || !varName.endsWith('Schema')) {
    return null;
  }

  // Check if init is z.object() call
  if (!decl.init || getNodeType(decl.init) !== 'CallExpression') {
    return null;
  }

  const callExpr = decl.init as unknown as CallExpression;

  // Check if it's z.object()
  if (!isZodObjectCall(callExpr)) {
    return null;
  }

  // Extract fields from the first argument (ObjectExpression)
  const fields = extractZodFields(callExpr, content);

  return {
    name: varName,
    type: getSchemaType(varName),
    fields,
    file: fileName,
  };
}

/**
 * Parse a single schema file using SWC AST
 */
function parseSchemaFileSwc(filePath: string): ZodSchemaInfo[] {
  const schemas: ZodSchemaInfo[] = [];

  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return schemas;
  }

  const fileName = path.basename(filePath);

  // Parse the file with SWC
  const { ast } = parseFile(filePath, content);

  visitNodeWithCallbacks(ast, {
    onVariableDeclaration: (node, context) => {
      // Only process exported declarations
      if (!context?.isExported) return;

      // Get the variable declarator
      const varDecl = node as unknown as {
        declarations: VariableDeclarator[];
      };

      for (const decl of varDecl.declarations) {
        const schema = processSchemaDeclarator(decl, content, fileName);
        if (schema) {
          schemas.push(schema);
        }
      }
    },
  });

  return schemas;
}

/**
 * Check if a CallExpression is a z.object() call
 */
function isZodObjectCall(callExpr: CallExpression): boolean {
  const callee = callExpr.callee;

  if (getNodeType(callee) !== 'MemberExpression') {
    return false;
  }

  const memberExpr = callee as unknown as {
    object: Node;
    property: Node;
  };

  // Check if object is 'z' identifier
  if (getNodeType(memberExpr.object) !== 'Identifier') {
    return false;
  }

  const objectIdent = memberExpr.object as unknown as Identifier;
  if (objectIdent.value !== 'z') {
    return false;
  }

  // Check if property is 'object'
  if (getNodeType(memberExpr.property) !== 'Identifier') {
    return false;
  }

  const propertyIdent = memberExpr.property as unknown as Identifier;
  return propertyIdent.value === 'object';
}

/**
 * Extract Zod fields from z.object() call
 */
function extractZodFields(callExpr: CallExpression, content: string): ZodField[] {
  // Get first argument (should be ObjectExpression)
  if (!callExpr.arguments || callExpr.arguments.length === 0) {
    return [];
  }

  const firstArg = callExpr.arguments[0];
  if (!firstArg) {
    return [];
  }

  // The argument might be wrapped in an expression property
  const argNode = firstArg as unknown as { expression?: Node };
  const argExpr = argNode.expression ?? (firstArg as unknown as Node);

  if (getNodeType(argExpr) !== 'ObjectExpression') {
    return [];
  }

  return parseZodFieldsFromAst(argExpr as unknown as ObjectExpressionNode, content);
}

/**
 * Parse Zod fields from ObjectExpression AST
 */
function parseZodFieldsFromAst(objectExpr: ObjectExpressionNode, _content: string): ZodField[] {
  const fields: ZodField[] = [];

  if (!objectExpr.properties) {
    return fields;
  }

  for (const prop of objectExpr.properties) {
    if (getNodeType(prop) !== 'KeyValueProperty') {
      continue;
    }

    const kvProp = prop as unknown as {
      key: Node;
      value: Node;
    };

    // Get field name from key
    const fieldName = extractIdentifierName(kvProp.key);
    if (!fieldName) {
      continue;
    }

    // Parse the value (should be z.string(), z.number(), etc.)
    const fieldInfo = parseZodFieldValue(kvProp.value);
    if (!fieldInfo) {
      continue;
    }

    const field: ZodField = {
      name: fieldName,
      type: fieldInfo.baseType,
      required: fieldInfo.required,
    };

    if (fieldInfo.validations.length > 0) {
      field.validation = fieldInfo.validations.join(', ');
    }

    fields.push(field);
  }

  return fields;
}

/**
 * Extract identifier name from a node (handles Identifier, StringLiteral, etc.)
 */
function extractIdentifierName(node: Node): string | null {
  const nodeType = getNodeType(node);

  if (nodeType === 'Identifier') {
    return (node as unknown as Identifier).value;
  }

  if (nodeType === 'StringLiteral') {
    return (node as unknown as { value: string }).value;
  }

  return null;
}

/**
 * Parse Zod field value (z.string().min(1).optional(), etc.)
 */
function parseZodFieldValue(
  node: Node,
): { baseType: string; required: boolean; validations: string[] } | null {
  // Start with the node and collect method chain
  const methodChain = collectZodMethodChain(node);

  if (methodChain.length === 0) {
    return null;
  }

  // First method should be the base type (string, number, etc.)
  const baseType = methodChain[0]?.type ?? 'unknown';

  // Check for optional/nullable modifiers
  const hasOptional = methodChain.some(
    (m) => m.type === 'optional' || m.type === 'nullable' || m.type === 'nullish',
  );

  // Extract validations
  const validations: string[] = [];

  for (const method of methodChain) {
    // Skip base type and modifiers
    if (
      method.type === baseType ||
      method.type === 'optional' ||
      method.type === 'nullable' ||
      method.type === 'nullish'
    ) {
      continue;
    }

    // Extract validation with arguments
    if (method.args.length > 0) {
      validations.push(`${method.type}: ${method.args.join(', ')}`);
    } else {
      validations.push(method.type);
    }
  }

  return {
    baseType,
    required: !hasOptional,
    validations,
  };
}

/**
 * Collect method chain from Zod field definition
 * Example: z.string().min(1).max(100).optional()
 * Returns: [{type: 'string', args: []}, {type: 'min', args: ['1']}, ...]
 */
function collectZodMethodChain(node: Node): Array<{ type: string; args: string[] }> {
  const chain: Array<{ type: string; args: string[] }> = [];
  let current = node;

  // Traverse the chain backwards (from optional() to z.string())
  while (current) {
    const nodeType = getNodeType(current);

    if (nodeType === 'CallExpression') {
      const callExpr = current as unknown as CallExpression;
      const callee = callExpr.callee;

      // Get method name
      if (getNodeType(callee) === 'MemberExpression') {
        const memberExpr = callee as unknown as {
          object: Node;
          property: Node;
        };

        const methodName = extractMethodName(memberExpr.property);
        if (methodName) {
          // Extract arguments
          const args = extractCallArguments(callExpr);
          chain.unshift({ type: methodName, args });
        }

        // Move to the object (continue chain)
        current = memberExpr.object;
      } else {
        break;
      }
    } else if (nodeType === 'MemberExpression') {
      const memberExpr = current as unknown as {
        object: Node;
        property: Node;
      };

      const methodName = extractMethodName(memberExpr.property);
      if (methodName) {
        chain.unshift({ type: methodName, args: [] });
      }

      current = memberExpr.object;
    } else {
      break;
    }
  }

  return chain;
}

/**
 * Extract method name from property node
 */
function extractMethodName(node: Node): string | null {
  if (getNodeType(node) === 'Identifier') {
    return (node as unknown as Identifier).value;
  }
  return null;
}

/**
 * Extract arguments from CallExpression
 */
function extractCallArguments(callExpr: CallExpression): string[] {
  if (!callExpr.arguments) {
    return [];
  }

  const args: string[] = [];

  for (const arg of callExpr.arguments) {
    // Handle Argument wrapper (SWC wraps args in { expression: ... })
    const argWithExpr = arg as unknown as { expression?: Node };
    const argExpr = (argWithExpr.expression ?? arg) as unknown as Node;
    const nodeType = getNodeType(argExpr);

    if (nodeType === 'NumericLiteral') {
      const numLit = argExpr as unknown as { value: number };
      args.push(String(numLit.value));
    } else if (nodeType === 'StringLiteral') {
      const strLit = argExpr as unknown as { value: string };
      args.push(`"${strLit.value}"`);
    } else if (nodeType === 'BooleanLiteral') {
      const boolLit = argExpr as unknown as { value: boolean };
      args.push(String(boolLit.value));
    } else if (nodeType === 'ArrayExpression') {
      // For enums: z.enum(['a', 'b', 'c'])
      const arrayExpr = argExpr as unknown as { elements: Array<{ expression?: Node } | null> };
      const elements = arrayExpr.elements
        .filter((el): el is { expression?: Node } => el !== null)
        .map((el) => {
          const elem = (el.expression ?? el) as unknown as Node;
          if (getNodeType(elem) === 'StringLiteral') {
            return (elem as unknown as { value: string }).value;
          }
          return '';
        })
        .filter(Boolean);

      if (elements.length > 0) {
        args.push(`[${elements.join(', ')}]`);
      }
    }
  }

  return args;
}

/**
 * Determine schema type from name
 */
function getSchemaType(schemaName: string): 'input' | 'output' | 'filter' {
  const lower = schemaName.toLowerCase();
  if (lower.includes('output') || lower.includes('response')) {
    return 'output';
  }
  if (lower.includes('filter') || lower.includes('query')) {
    return 'filter';
  }
  return 'input';
}

/**
 * Parse Zod schema files to extract input/output schemas
 *
 * @param schemasDir - Directory containing schema files
 * @param patterns - File name patterns to match (empty = match all)
 * @returns Array of parsed schema information
 */
export function parseZodSchemas(schemasDir: string, patterns: string[]): ZodSchemaInfo[] {
  const results: ZodSchemaInfo[] = [];

  scanDirectory(
    schemasDir,
    (fullPath) => {
      results.push(...parseSchemaFileSwc(fullPath));
    },
    {
      patterns,
      extensions: ['.ts'],
      includeTests: false,
    },
  );

  return results;
}
