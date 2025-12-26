/**
 * @module commands/codegen/services/ts-type-parser
 * @description TypeScript interface/type parser for Zod schema generation
 *
 * Uses SWC to parse TypeScript files and extract interface/type definitions
 * for conversion to Zod schemas.
 */

import * as fs from 'node:fs';
import { getNodeSpan, parseFile, visitNodeWithCallbacks } from '@/lib/@swc';

/**
 * Parsed property from TypeScript interface/type
 */
export interface ParsedProperty {
  /** Property name */
  name: string;
  /** TypeScript type as string */
  type: string;
  /** Whether the property is optional */
  optional: boolean;
  /** Whether the property is nullable (T | null) */
  nullable: boolean;
  /** Array element type if it's an array */
  arrayType?: string;
  /** Record key and value types */
  recordTypes?: { key: string; value: string };
  /** Union types if it's a union */
  unionTypes?: string[];
  /** Literal value if it's a literal type */
  literalValue?: string | number | boolean;
}

/**
 * Parsed TypeScript type definition
 */
export interface ParsedTypeDefinition {
  /** Type name (e.g., 'UserInput') */
  name: string;
  /** Whether it's an interface or type alias */
  kind: 'interface' | 'type';
  /** Parsed properties */
  properties: ParsedProperty[];
  /** Extended types (for interfaces) */
  extends?: string[];
  /** JSDoc description if available */
  description?: string;
}

/**
 * Result of parsing a TypeScript file for types
 */
export interface ParseResult {
  success: boolean;
  types: ParsedTypeDefinition[];
  error?: string;
}

/**
 * Parse a TypeScript type string and extract structured information
 */
function parseTypeString(typeText: string): Partial<ParsedProperty> {
  const trimmed = typeText.trim();

  // Check for array types: T[] or Array<T>
  if (trimmed.endsWith('[]')) {
    const elementType = trimmed.slice(0, -2);
    return { arrayType: elementType };
  }

  const arrayMatch = trimmed.match(/^Array<(.+)>$/);
  if (arrayMatch?.[1]) {
    return { arrayType: arrayMatch[1] };
  }

  // Check for Record<K, V>
  const recordMatch = trimmed.match(/^Record<\s*(.+?)\s*,\s*(.+)\s*>$/);
  if (recordMatch?.[1] && recordMatch[2]) {
    return {
      recordTypes: {
        key: recordMatch[1].trim(),
        value: recordMatch[2].trim(),
      },
    };
  }

  // Check for union types including null/undefined
  if (trimmed.includes('|')) {
    const parts = trimmed.split('|').map((p) => p.trim());
    const hasNull = parts.includes('null');
    const hasUndefined = parts.includes('undefined');
    const nonNullParts = parts.filter((p) => p !== 'null' && p !== 'undefined');

    // If only one non-null type, mark as nullable/optional
    if (nonNullParts.length === 1 && nonNullParts[0]) {
      return {
        type: nonNullParts[0],
        nullable: hasNull,
        optional: hasUndefined,
      };
    }

    // Multiple union types
    return {
      unionTypes: nonNullParts,
      nullable: hasNull,
      optional: hasUndefined,
    };
  }

  // Check for literal types
  if (/^["'].*["']$/.test(trimmed)) {
    return { literalValue: trimmed.slice(1, -1) };
  }
  if (/^\d+$/.test(trimmed)) {
    return { literalValue: Number.parseInt(trimmed, 10) };
  }
  if (trimmed === 'true' || trimmed === 'false') {
    return { literalValue: trimmed === 'true' };
  }

  return { type: trimmed };
}

/**
 * Parse properties from interface/type body
 */
function parsePropertiesFromMembers(
  members: Array<{
    type: string;
    key?: { type: string; value?: string };
    typeAnnotation?: unknown;
    optional?: boolean;
  }>,
  content: string,
): ParsedProperty[] {
  const properties: ParsedProperty[] = [];

  for (const member of members) {
    // Only handle property signatures
    if (member.type !== 'TsPropertySignature') {
      continue;
    }

    // Extract property name
    const key = member.key;
    if (!key) {
      continue;
    }

    let name: string | undefined;
    if (key.type === 'Identifier' && key.value) {
      name = key.value;
    } else if (key.type === 'StringLiteral' && key.value) {
      name = key.value;
    }

    if (!name) {
      continue;
    }

    // Extract type annotation
    let typeText = 'unknown';
    const optional = member.optional ?? false;
    const nullable = false;

    if (member.typeAnnotation) {
      const typeAnnotationNode = member.typeAnnotation as {
        typeAnnotation?: {
          type?: string;
          kind?: string;
          span?: { start: number; end: number };
        };
      };

      const actualTypeNode = typeAnnotationNode.typeAnnotation;
      if (actualTypeNode) {
        // For TsKeywordType (string, number, boolean, etc.), use the kind property
        if (actualTypeNode.type === 'TsKeywordType' && actualTypeNode.kind) {
          typeText = actualTypeNode.kind;
        } else if (actualTypeNode.span) {
          // For other types, extract text directly from source
          // NOTE: SWC spans appear to be off by 1 byte at the start
          const start = actualTypeNode.span.start - 1;
          const end = actualTypeNode.span.end - 1;
          const extracted = content.slice(start, end);

          if (extracted) {
            typeText = extracted.trim();
          }
        }
      }
    }

    // Parse the type string for additional info
    const parsedType = parseTypeString(typeText);

    const property: ParsedProperty = {
      name,
      type: parsedType.type ?? typeText,
      optional: optional || parsedType.optional === true,
      nullable: parsedType.nullable ?? nullable,
      ...parsedType,
    };

    properties.push(property);
  }

  return properties;
}

/**
 * Extract JSDoc description from comment before a node
 */
function extractJsDocDescription(content: string, nodeStart: number): string | undefined {
  const beforeNode = content.slice(0, nodeStart);
  const jsdocMatch = beforeNode.match(/\/\*\*\s*\n\s*\*\s*([^\n]+)[\s\S]*?\*\/\s*$/);

  if (jsdocMatch?.[1]) {
    return jsdocMatch[1].trim();
  }

  return undefined;
}

/**
 * Parse a TypeScript file and extract all interface/type definitions
 */
export function parseTypesFromFile(filePath: string): ParseResult {
  const types: ParsedTypeDefinition[] = [];

  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    return {
      success: false,
      types: [],
      error: `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  try {
    const { ast } = parseFile(filePath, content);

    visitNodeWithCallbacks(ast, {
      onTsInterfaceDeclaration: (node, _context) => {
        const interfaceNode = node as unknown as {
          id: { value: string };
          extends?: Array<{
            expression: { type: string; value?: string; left?: { value: string } };
          }>;
          body: {
            body: Array<{
              type: string;
              key?: { type: string; value?: string };
              typeAnnotation?: unknown;
              optional?: boolean;
            }>;
          };
        };

        const name = interfaceNode.id.value;
        if (!name) {
          return;
        }

        const typeDef: ParsedTypeDefinition = {
          name,
          kind: 'interface',
          properties: parsePropertiesFromMembers(interfaceNode.body.body, content),
        };

        // Parse extends clause
        if (interfaceNode.extends && interfaceNode.extends.length > 0) {
          typeDef.extends = interfaceNode.extends
            .map((ext) => {
              const expr = ext.expression;
              if (expr.type === 'Identifier' && expr.value) {
                return expr.value;
              }
              if (expr.type === 'MemberExpression' && expr.left?.value) {
                return expr.left.value;
              }
              return null;
            })
            .filter((n): n is string => n !== null);
        }

        // Extract JSDoc description
        const span = getNodeSpan(node);
        if (span) {
          const description = extractJsDocDescription(content, span.start);
          if (description) {
            typeDef.description = description;
          }
        }

        types.push(typeDef);
      },

      onTsTypeAliasDeclaration: (node) => {
        const typeAliasNode = node as unknown as {
          id: { value: string };
          typeAnnotation: {
            type: string;
            members?: Array<{
              type: string;
              key?: { type: string; value?: string };
              typeAnnotation?: unknown;
              optional?: boolean;
            }>;
          };
        };

        const name = typeAliasNode.id.value;
        if (!name) {
          return;
        }

        const typeAnnotation = typeAliasNode.typeAnnotation;

        // Check if it's an object-like type (TsTypeLiteral)
        if (typeAnnotation.type === 'TsTypeLiteral' && typeAnnotation.members) {
          const typeDef: ParsedTypeDefinition = {
            name,
            kind: 'type',
            properties: parsePropertiesFromMembers(typeAnnotation.members, content),
          };

          // Extract JSDoc description
          const span = getNodeSpan(node);
          if (span) {
            const description = extractJsDocDescription(content, span.start);
            if (description) {
              typeDef.description = description;
            }
          }

          types.push(typeDef);
        }
        // For non-object types (unions, intersections, etc.), we skip them
        // as they can't be directly converted to z.object()
      },
    });
  } catch (error) {
    return {
      success: false,
      types: [],
      error: `Failed to parse file: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  return { success: true, types };
}

/**
 * Parse a TypeScript file and find a specific type by name
 */
export function findTypeByName(filePath: string, typeName: string): ParsedTypeDefinition | null {
  const result = parseTypesFromFile(filePath);

  if (!result.success) {
    return null;
  }

  return result.types.find((t) => t.name === typeName) ?? null;
}

/**
 * Parse TypeScript content string directly (for testing)
 */
export function parseTypesFromContent(content: string, fileName = 'temp.ts'): ParseResult {
  const tempPath = `/tmp/${fileName}`;

  // Write to temp file for parsing
  try {
    fs.writeFileSync(tempPath, content);
    const result = parseTypesFromFile(tempPath);
    fs.unlinkSync(tempPath);
    return result;
  } catch (error) {
    return {
      success: false,
      types: [],
      error: `Failed to parse content: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
