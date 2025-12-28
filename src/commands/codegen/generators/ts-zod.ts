/**
 * @module commands/codegen/generators/ts-zod
 * @description TypeScript interface to Zod schema generator
 *
 * Reads TypeScript interfaces/types and generates equivalent Zod schemas.
 * Uses SWC for parsing TypeScript and supports:
 * - Primitive types (string, number, boolean)
 * - Arrays (T[] and Array<T>)
 * - Optional properties (T | undefined)
 * - Nullable properties (T | null)
 * - Records (Record<K, V>)
 * - Literal types
 * - Union types
 */

import * as path from 'node:path';
import { toCamelCase } from '@/lib/format';
import type { ParsedProperty, ParsedTypeDefinition } from '../services/ts-type-parser';
import { findTypeByName } from '../services/ts-type-parser';
import type { DocHints } from '../services/types';
import type { GeneratedFile, GeneratorMetadata, GeneratorOptions } from '../types';
import { BaseGenerator } from './base';

/**
 * Convert literal value to Zod literal type
 */
function literalToZod(literalValue: string | number | boolean): string {
  if (typeof literalValue === 'string') {
    return `z.literal('${literalValue}')`;
  }
  return `z.literal(${literalValue})`;
}

/**
 * Convert array type to Zod array
 */
function arrayToZod(arrayType: string): string {
  return `z.array(${primitiveToZod(arrayType)})`;
}

/**
 * Convert Record type to Zod record
 */
function recordToZod(recordTypes: { key: string; value: string }): string {
  const keyZod = primitiveToZod(recordTypes.key);
  const valueZod = primitiveToZod(recordTypes.value);
  return `z.record(${keyZod}, ${valueZod})`;
}

/**
 * Convert union types to Zod union
 */
function unionToZod(unionTypes: string[]): string {
  if (unionTypes.length === 1 && unionTypes[0]) {
    return primitiveToZod(unionTypes[0]);
  }
  const unionZodTypes = unionTypes.map((t) => primitiveToZod(t));
  return `z.union([${unionZodTypes.join(', ')}])`;
}

/**
 * Apply nullable and optional modifiers to Zod type
 */
function applyModifiers(zodType: string, nullable: boolean, optional: boolean): string {
  let result = zodType;
  if (nullable) {
    result = `${result}.nullable()`;
  }
  if (optional) {
    result = `${result}.optional()`;
  }
  return result;
}

/**
 * Convert TypeScript type to Zod type
 */
function tsTypeToZod(property: ParsedProperty): string {
  const { type, optional, nullable, arrayType, recordTypes, unionTypes, literalValue } = property;

  let zodType: string;

  if (literalValue !== undefined) {
    zodType = literalToZod(literalValue);
  } else if (arrayType) {
    zodType = arrayToZod(arrayType);
  } else if (recordTypes) {
    zodType = recordToZod(recordTypes);
  } else if (unionTypes && unionTypes.length > 0) {
    zodType = unionToZod(unionTypes);
  } else {
    zodType = primitiveToZod(type);
  }

  return applyModifiers(zodType, nullable, optional);
}

/**
 * Convert a primitive TypeScript type to Zod
 */
function primitiveToZod(type: string): string {
  const trimmed = type.trim();

  // Handle keyword types
  switch (trimmed) {
    case 'string':
      return 'z.string()';
    case 'number':
      return 'z.number()';
    case 'boolean':
      return 'z.boolean()';
    case 'bigint':
      return 'z.bigint()';
    case 'symbol':
      return 'z.symbol()';
    case 'undefined':
      return 'z.undefined()';
    case 'null':
      return 'z.null()';
    case 'void':
      return 'z.void()';
    case 'any':
      return 'z.any()';
    case 'unknown':
      return 'z.unknown()';
    case 'never':
      return 'z.never()';
    case 'object':
      return 'z.object({})';
    case 'Date':
      return 'z.date()';
  }

  // Handle arrays that weren't caught earlier
  if (trimmed.endsWith('[]')) {
    const elementType = trimmed.slice(0, -2);
    return `z.array(${primitiveToZod(elementType)})`;
  }

  const arrayMatch = trimmed.match(/^Array<(.+)>$/);
  if (arrayMatch?.[1]) {
    return `z.array(${primitiveToZod(arrayMatch[1])})`;
  }

  // Handle Record<K, V>
  const recordMatch = trimmed.match(/^Record<\s*(.+?)\s*,\s*(.+)\s*>$/);
  if (recordMatch?.[1] && recordMatch[2]) {
    return `z.record(${primitiveToZod(recordMatch[1].trim())}, ${primitiveToZod(recordMatch[2].trim())})`;
  }

  // Handle string literal types
  if (/^["'].*["']$/.test(trimmed)) {
    return `z.literal(${trimmed})`;
  }

  // Handle number literals
  if (/^\d+$/.test(trimmed)) {
    return `z.literal(${trimmed})`;
  }

  // Handle boolean literals
  if (trimmed === 'true' || trimmed === 'false') {
    return `z.literal(${trimmed})`;
  }

  // For custom types, assume they have a corresponding schema
  const schemaName = `${toCamelCase(trimmed)}Schema`;
  return schemaName;
}

/**
 * Generate Zod schema from parsed TypeScript type definition
 */
function generateZodSchema(typeDef: ParsedTypeDefinition): string {
  const { name, properties, description } = typeDef;
  const schemaName = `${toCamelCase(name)}Schema`;
  const lines: string[] = [];

  // Add JSDoc if description exists
  if (description) {
    lines.push(`/**`);
    lines.push(` * ${description}`);
    lines.push(` */`);
  }

  // Generate schema
  lines.push(`export const ${schemaName} = z.object({`);

  for (const prop of properties) {
    const zodType = tsTypeToZod(prop);
    lines.push(`  ${prop.name}: ${zodType},`);
  }

  lines.push(`});`);
  lines.push('');

  // Generate type inference
  lines.push(`export type ${name} = z.infer<typeof ${schemaName}>;`);

  return lines.join('\n');
}

/**
 * TypeScript to Zod schema generator
 */
class TsZodGeneratorClass extends BaseGenerator {
  readonly metadata: GeneratorMetadata = {
    id: 'ts-zod',
    name: 'TypeScript to Zod Schema',
    description: 'Generate Zod validation schemas from TypeScript interfaces/types',
    example: 'krolik codegen ts-zod --from-type UserInput --file src/types.ts',
  };

  protected generateWithHints(options: GeneratorOptions, hints: DocHints): GeneratedFile[] {
    const { projectRoot } = options;

    // Get required options
    const fromType = (options as { fromType?: string }).fromType;
    const file = options.file;

    if (!fromType) {
      throw new Error('--from-type is required for ts-zod generator');
    }

    if (!file) {
      throw new Error('--file is required for ts-zod generator');
    }

    // Resolve the file path
    const filePath = path.isAbsolute(file) ? file : path.join(projectRoot, file);

    // Parse the type
    const typeDef = findTypeByName(filePath, fromType);

    if (!typeDef) {
      throw new Error(`Type "${fromType}" not found in ${file}`);
    }

    // Generate the schema
    const schemaContent = generateZodSchema(typeDef);

    // Build the output content
    const sourceComment = hints.enhanced
      ? `\n * @enhanced Sources: ${hints.sources.join(', ')}`
      : '';

    const content = `/**
 * @module schemas/${toCamelCase(fromType)}
 * @description Generated Zod schema from ${typeDef.kind} ${fromType}${sourceComment}
 * @generated from ${file}
 */

import { z } from 'zod';

${schemaContent}
`;

    // Determine output path
    const defaultPath = 'packages/shared/src/schemas';
    const targetDir = options.path ?? defaultPath;
    const outputPath = path.join(targetDir, `${toCamelCase(fromType)}.ts`);

    return [
      {
        path: outputPath,
        content,
        action: 'create',
        ...(hints.enhanced
          ? {
              docsEnhanced: {
                library: hints.sources[0] ?? 'zod',
                topics: hints.patterns.map((p) => p.name),
                snippetsCount: hints.snippets.length,
              },
            }
          : {}),
      },
    ];
  }
}

export const tsZodGenerator = new TsZodGeneratorClass();
