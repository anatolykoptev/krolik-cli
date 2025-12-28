/**
 * @module commands/context/parsers/types-parser
 * @description TypeScript interface/type parser for AI context
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { scanDirectory } from '@/lib/core/fs';
import type { ExtractedType, ImportItem, ImportRelation, TypeProperty } from './types';

const MAX_TYPES_PER_FILE = 10;
const MAX_PROPERTIES = 15;

/**
 * Extract interface from regex match
 */
function extractInterface(
  match: RegExpExecArray,
  content: string,
  fileName: string,
): ExtractedType | null {
  const name = match[1];
  const extendsStr = match[2];
  const body = match[3];

  if (!name) return null;

  const type: ExtractedType = {
    name,
    kind: 'interface',
    file: fileName,
    properties: parseProperties(body ?? ''),
  };

  if (extendsStr) {
    type.extends = extendsStr.split(',').map((s) => s.trim());
  }

  // Extract JSDoc description
  const jsdocMatch = content
    .slice(0, match.index)
    .match(/\/\*\*\s*\n\s*\*\s*([^\n]+)\n[\s\S]*?\*\/\s*$/);
  if (jsdocMatch?.[1]) {
    type.description = jsdocMatch[1].trim();
  }

  return type;
}

/**
 * Extract type alias from regex match
 */
function extractTypeAlias(match: RegExpExecArray, fileName: string): ExtractedType | null {
  const name = match[1];
  const value = match[2]?.trim();

  if (!name || !value) return null;

  // Parse object-like types
  if (value.startsWith('{')) {
    return {
      name,
      kind: 'type',
      file: fileName,
      properties: parseProperties(value.slice(1, -1)),
    };
  }

  // Union/intersection types
  return {
    name,
    kind: 'type',
    file: fileName,
    ...(value.length < 100 && { description: value }),
  };
}

/**
 * Parse TypeScript file for interfaces and types
 */
function parseTypesFile(filePath: string): ExtractedType[] {
  const types: ExtractedType[] = [];

  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return types;
  }

  const fileName = path.basename(filePath);

  // Extract interfaces
  const interfaceRegex =
    /(?:\/\*\*\s*\n(?:\s*\*[^\n]*\n)*\s*\*\/\s*\n)?export\s+interface\s+(\w+)(?:\s+extends\s+([^{]+))?\s*\{([^}]+)\}/g;
  let match: RegExpExecArray | null;

  while ((match = interfaceRegex.exec(content)) !== null) {
    const extracted = extractInterface(match, content, fileName);
    if (extracted) types.push(extracted);
  }

  // Extract type aliases
  const typeRegex = /(?:\/\*\*[\s\S]*?\*\/\s*)?export\s+type\s+(\w+)\s*=\s*([^;]+);/g;

  while ((match = typeRegex.exec(content)) !== null) {
    const extracted = extractTypeAlias(match, fileName);
    if (extracted) types.push(extracted);
  }

  return types.slice(0, MAX_TYPES_PER_FILE);
}

/**
 * Parse properties from interface/type body
 */
function parseProperties(body: string): TypeProperty[] {
  const properties: TypeProperty[] = [];

  // Match: propertyName?: Type;
  const propRegex = /(?:\/\*\*[\s\S]*?\*\/\s*)?(\w+)(\?)?:\s*([^;]+);/g;
  let match: RegExpExecArray | null;

  while ((match = propRegex.exec(body)) !== null) {
    const name = match[1];
    const optional = match[2] === '?';
    let type = match[3]?.trim();

    if (!name || !type) continue;

    // Simplify long types
    if (type.length > 50) {
      type = `${type.slice(0, 47)}...`;
    }

    properties.push({ name, type, optional });
  }

  return properties.slice(0, MAX_PROPERTIES);
}

/**
 * Parse imports from a TypeScript file
 */
function parseImports(filePath: string): ImportItem[] {
  const imports: ImportItem[] = [];

  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return imports;
  }

  // Match: import { A, B } from "module"
  // Match: import type { A, B } from "module"
  const importRegex = /import\s+(type\s+)?\{\s*([^}]+)\s*\}\s+from\s+["']([^"']+)["']/g;
  let match: RegExpExecArray | null;

  while ((match = importRegex.exec(content)) !== null) {
    const isTypeOnly = Boolean(match[1]);
    const names = match[2]?.split(',').map((s) => s.trim().split(' ')[0]) ?? [];
    const from = match[3];

    if (!from) continue;

    // Skip node modules
    if (!from.startsWith('.') && !from.startsWith('@/')) continue;

    imports.push({
      from,
      names: names.filter(Boolean) as string[],
      isTypeOnly,
    });
  }

  return imports;
}

/**
 * Find and parse types from a directory
 */
export function parseTypesInDir(dir: string, patterns: string[]): ExtractedType[] {
  const results: ExtractedType[] = [];

  scanDirectory(
    dir,
    (fullPath) => {
      results.push(...parseTypesFile(fullPath));
    },
    {
      patterns,
      extensions: ['.ts'],
      includeTests: false,
    },
  );

  return results;
}

/**
 * Build import graph for files in a directory
 */
export function buildImportGraph(dir: string, patterns: string[]): ImportRelation[] {
  const graph: ImportRelation[] = [];

  scanDirectory(
    dir,
    (fullPath) => {
      const imports = parseImports(fullPath);
      if (imports.length > 0) {
        const relativePath = path.relative(dir, fullPath);
        graph.push({ file: relativePath, imports });
      }
    },
    {
      patterns,
      extensions: ['.ts', '.tsx'],
      includeTests: false,
    },
  );

  return graph;
}
