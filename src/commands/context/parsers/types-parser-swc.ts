/**
 * @module commands/context/parsers/types-parser-swc
 * @description SWC-based TypeScript interface/type parser for AI context
 *
 * This is a more accurate alternative to the regex-based parser.
 * Uses SWC AST for proper parsing of TypeScript declarations.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { getNodeSpan, parseFile, visitNodeWithCallbacks } from '@/lib/@swc';

/**
 * Extracted TypeScript interface/type
 */
export interface ExtractedType {
  name: string;
  kind: 'interface' | 'type';
  file: string;
  properties?: TypeProperty[];
  extends?: string[];
  description?: string;
}

/**
 * Property of an interface/type
 */
export interface TypeProperty {
  name: string;
  type: string;
  optional: boolean;
  description?: string;
}

/**
 * Import relationship
 */
export interface ImportRelation {
  file: string;
  imports: ImportItem[];
}

export interface ImportItem {
  from: string;
  names: string[];
  isTypeOnly: boolean;
}

const MAX_TYPES_PER_FILE = 10;
const MAX_PROPERTIES = 15;

/**
 * Parse TypeScript file for interfaces and types using SWC AST
 */
function parseTypesFileSwc(filePath: string): ExtractedType[] {
  const types: ExtractedType[] = [];

  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return types;
  }

  const fileName = path.basename(filePath);

  try {
    const { ast } = parseFile(filePath, content);

    visitNodeWithCallbacks(ast, {
      onTsInterfaceDeclaration: (node, context) => {
        // Only process exported interfaces
        if (!context.isExported) {
          return;
        }

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
        if (!name || types.length >= MAX_TYPES_PER_FILE) {
          return;
        }

        const type: ExtractedType = {
          name,
          kind: 'interface',
          file: fileName,
          properties: parsePropertiesFromBody(interfaceNode.body.body, content),
        };

        // Parse extends clause
        if (interfaceNode.extends && interfaceNode.extends.length > 0) {
          type.extends = interfaceNode.extends
            .map((ext) => {
              const expr = ext.expression;
              if (expr.type === 'Identifier' && expr.value) {
                return expr.value;
              }
              // Handle qualified names like A.B
              if (expr.type === 'MemberExpression' && expr.left?.value) {
                return expr.left.value;
              }
              return null;
            })
            .filter((name): name is string => name !== null);
        }

        // Extract JSDoc description from preceding comment
        const span = getNodeSpan(node);
        if (span) {
          const description = extractJsDocDescription(content, span.start);
          if (description) {
            type.description = description;
          }
        }

        types.push(type);
      },

      onTsTypeAliasDeclaration: (node, context) => {
        // Only process exported type aliases
        if (!context.isExported) {
          return;
        }

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
        if (!name || types.length >= MAX_TYPES_PER_FILE) {
          return;
        }

        const typeAnnotation = typeAliasNode.typeAnnotation;

        // Check if it's an object-like type (TsTypeLiteral)
        if (typeAnnotation.type === 'TsTypeLiteral' && typeAnnotation.members) {
          types.push({
            name,
            kind: 'type',
            file: fileName,
            properties: parsePropertiesFromBody(typeAnnotation.members, content),
          });
        } else {
          // Union/intersection/other types - store as description
          // Use span-based extraction with offset adjustment
          const typeAnnotationWithSpan = typeAliasNode.typeAnnotation as {
            span?: { start: number; end: number };
          };

          let typeText: string | null = null;
          if (typeAnnotationWithSpan.span) {
            // Adjust span offsets (-1 at start, -1 at end to exclude semicolon)
            const start = typeAnnotationWithSpan.span.start - 1;
            const end = typeAnnotationWithSpan.span.end - 1;
            typeText = content.slice(start, end).trim();
          }

          const truncatedType =
            typeText && typeText.length < 100 ? typeText : `${typeText?.slice(0, 97)}...`;

          types.push({
            name,
            kind: 'type',
            file: fileName,
            ...(truncatedType && { description: truncatedType }),
          });
        }

        // Extract JSDoc description
        const span = getNodeSpan(node);
        const lastType = types[types.length - 1];
        if (span && lastType && !lastType.description) {
          const description = extractJsDocDescription(content, span.start);
          if (description) {
            lastType.description = description;
          }
        }
      },
    });
  } catch (_error) {
    // If parsing fails, return empty array
    // This happens with invalid TypeScript syntax
    return [];
  }

  return types.slice(0, MAX_TYPES_PER_FILE);
}

/**
 * Parse properties from interface/type body
 */
function parsePropertiesFromBody(
  members: Array<{
    type: string;
    key?: { type: string; value?: string };
    typeAnnotation?: unknown;
    optional?: boolean;
  }>,
  content: string,
): TypeProperty[] {
  const properties: TypeProperty[] = [];

  for (const member of members) {
    if (properties.length >= MAX_PROPERTIES) {
      break;
    }

    // Only handle property signatures
    if (member.type !== 'TsPropertySignature') {
      continue;
    }

    // Extract property name
    const key = member.key;
    if (!key) {
      continue;
    }

    let name: string | null = null;
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
    if (member.typeAnnotation) {
      const typeAnnotationNode = member.typeAnnotation as {
        typeAnnotation?: {
          type?: string;
          kind?: string;
          span?: { start: number; end: number };
        };
      };

      // Get the actual type annotation node
      const actualTypeNode = typeAnnotationNode.typeAnnotation;
      if (actualTypeNode) {
        // For TsKeywordType (string, number, boolean, etc.), use the kind property
        if (actualTypeNode.type === 'TsKeywordType' && actualTypeNode.kind) {
          typeText = actualTypeNode.kind;
        } else if (actualTypeNode.span) {
          // For other types, extract text directly from source
          // NOTE: SWC spans appear to be off by 1 byte at the start and include
          // the trailing semicolon. Adjust accordingly.
          const start = actualTypeNode.span.start - 1;
          const end = actualTypeNode.span.end - 1; // Excludes semicolon
          const extracted = content.slice(start, end);

          if (extracted) {
            // Clean up and truncate
            const cleaned = extracted.trim();
            typeText = cleaned.length > 50 ? `${cleaned.slice(0, 47)}...` : cleaned;
          }
        }
      }
    }

    properties.push({
      name,
      type: typeText,
      optional: member.optional ?? false,
    });
  }

  return properties;
}

/**
 * Extract JSDoc description from comment before a node
 *
 * Looks for /** ... *\/ comments before the node start position.
 */
function extractJsDocDescription(content: string, nodeStart: number): string | null {
  // Look backwards from node start for JSDoc comment
  const beforeNode = content.slice(0, nodeStart);

  // Match last JSDoc comment before the node
  // Pattern: /** ... */ with optional whitespace after
  const jsdocMatch = beforeNode.match(/\/\*\*\s*\n\s*\*\s*([^\n]+)[^]*?\*\/\s*$/);

  if (jsdocMatch?.[1]) {
    return jsdocMatch[1].trim();
  }

  return null;
}

/**
 * Parse imports from a TypeScript file using SWC AST
 */
function parseImportsSwc(filePath: string): ImportItem[] {
  const imports: ImportItem[] = [];

  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return imports;
  }

  try {
    const { ast } = parseFile(filePath, content);

    visitNodeWithCallbacks(ast, {
      onImportDeclaration: (node) => {
        const importNode = node as unknown as {
          source: { value: string };
          specifiers: Array<{
            type: string;
            local: { value: string };
          }>;
          typeOnly?: boolean;
        };

        const from = importNode.source.value;

        // Skip node modules (only track relative and @/ imports)
        if (!from.startsWith('.') && !from.startsWith('@/')) {
          return;
        }

        const names = importNode.specifiers
          .map((spec) => spec.local?.value)
          .filter((name): name is string => Boolean(name));

        if (names.length > 0) {
          imports.push({
            from,
            names,
            isTypeOnly: importNode.typeOnly ?? false,
          });
        }
      },
    });
  } catch {
    // If parsing fails, return empty array
    return [];
  }

  return imports;
}

/**
 * Find and parse types from a directory
 */
export function parseTypesInDir(dir: string, patterns: string[]): ExtractedType[] {
  const results: ExtractedType[] = [];

  if (!fs.existsSync(dir)) return results;

  function scanDir(currentDir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        scanDir(fullPath);
        continue;
      }

      // Only .ts files (not .tsx for components)
      if (!entry.isFile() || !entry.name.endsWith('.ts')) continue;
      if (entry.name.endsWith('.test.ts')) continue;

      // Match patterns if provided
      if (patterns.length > 0) {
        const nameLower = entry.name.toLowerCase();
        if (!patterns.some((p) => nameLower.includes(p.toLowerCase()))) continue;
      }

      results.push(...parseTypesFileSwc(fullPath));
    }
  }

  scanDir(dir);
  return results;
}

/**
 * Build import graph for files in a directory
 */
export function buildImportGraph(dir: string, patterns: string[]): ImportRelation[] {
  const graph: ImportRelation[] = [];

  if (!fs.existsSync(dir)) return graph;

  function scanDir(currentDir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        scanDir(fullPath);
        continue;
      }

      if (!entry.isFile()) continue;
      if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) continue;
      if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx')) continue;

      // Match patterns if provided
      if (patterns.length > 0) {
        const nameLower = entry.name.toLowerCase();
        if (!patterns.some((p) => nameLower.includes(p.toLowerCase()))) continue;
      }

      const imports = parseImportsSwc(fullPath);
      if (imports.length > 0) {
        const relativePath = path.relative(dir, fullPath);
        graph.push({ file: relativePath, imports });
      }
    }
  }

  scanDir(dir);
  return graph;
}
