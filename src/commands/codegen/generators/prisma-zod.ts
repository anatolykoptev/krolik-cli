/**
 * @module commands/codegen/generators/prisma-zod
 * @description Prisma to Zod schema generator with docs enhancement
 *
 * Reads Prisma schema and generates Zod validation schemas.
 *
 * Usage:
 *   krolik codegen prisma-zod --from-model Booking
 *   krolik codegen prisma-zod --from-model User --path packages/shared/src/schemas
 */

import * as path from 'node:path';
import { findSchemaDir } from '@/lib/@discovery/schema';
import { toCamelCase } from '@/lib/@format';
import { fieldToZod } from '@/lib/@prisma';
import { type PrismaEnum, type PrismaModel, parseSchemaDirectory } from '../../schema/parser';
import type { DocHints } from '../services/types';
import { prismaZodEnhanced } from '../templates/enhanced';
import type { GeneratedFile, GeneratorMetadata, GeneratorOptions } from '../types';
import { BaseGenerator } from './base';

/**
 * Generate Zod schema code for a model
 */
function generateModelSchema(model: PrismaModel, enums: Map<string, PrismaEnum>): string {
  const pascalName = model.name;
  const camelName = toCamelCase(model.name);

  const fieldLines: string[] = [];

  for (const field of model.fields) {
    const zodType = fieldToZod(field, enums);
    if (zodType) {
      fieldLines.push(`  ${field.name}: ${zodType},`);
    }
  }

  if (fieldLines.length === 0) {
    return '';
  }

  const fieldsStr = fieldLines.join('\n');

  // Determine omit fields for create schema
  const omitFields = model.fields
    .filter((f) => f.isId || f.name === 'createdAt' || f.name === 'updatedAt')
    .map((f) => f.name);

  const omitStr =
    omitFields.length > 0 ? omitFields.map((f) => `  ${f}: true,`).join('\n') : '  id: true,';

  return `/**
 * @module schemas/${camelName}
 * @description ${pascalName} validation schemas
 * @generated from Prisma model ${pascalName}
 */

import { z } from 'zod';

/**
 * Base ${pascalName} schema
 */
export const ${camelName}Schema = z.object({
${fieldsStr}
});

/**
 * Schema for creating ${pascalName}
 */
export const create${pascalName}Schema = ${camelName}Schema.omit({
${omitStr}
});

/**
 * Schema for updating ${pascalName}
 */
export const update${pascalName}Schema = create${pascalName}Schema.partial();

/**
 * Schema with ID for update operations
 */
export const update${pascalName}WithIdSchema = z.object({
  id: ${camelName}Schema.shape.id,
  data: update${pascalName}Schema,
});

/**
 * Type inference
 */
export type ${pascalName} = z.infer<typeof ${camelName}Schema>;
export type Create${pascalName}Input = z.infer<typeof create${pascalName}Schema>;
export type Update${pascalName}Input = z.infer<typeof update${pascalName}Schema>;
`;
}

// ============================================================================
// GENERATOR OPTIONS EXTENSION
// ============================================================================

/**
 * Extended options for prisma-zod generator
 */
export interface PrismaZodOptions extends GeneratorOptions {
  /** Model name to generate from */
  fromModel?: string;
}

// ============================================================================
// GENERATOR CLASS
// ============================================================================

/**
 * Prisma to Zod schema generator
 */
class PrismaZodGeneratorClass extends BaseGenerator {
  readonly metadata: GeneratorMetadata = {
    id: 'prisma-zod',
    name: 'Prisma to Zod',
    description: 'Generate Zod schemas from Prisma models',
    example: 'krolik codegen prisma-zod --from-model Booking --output packages/shared/src/schemas',
  };

  protected generateWithHints(options: GeneratorOptions, hints: DocHints): GeneratedFile[] {
    const extOptions = options as PrismaZodOptions;
    const { fromModel, path: outputPath, projectRoot } = extOptions;

    if (!fromModel) {
      throw new Error('--from-model is required for prisma-zod generator');
    }

    // Find Prisma schema directory
    const schemaDir = findSchemaDir(projectRoot);
    if (!schemaDir) {
      throw new Error(
        'Prisma schema directory not found. Expected locations: prisma/, packages/db/prisma/, etc.',
      );
    }

    // Parse schema
    const { models, enums } = parseSchemaDirectory(schemaDir);

    // Build enum map for lookups
    const enumMap = new Map<string, PrismaEnum>();
    for (const e of enums) {
      enumMap.set(e.name, e);
    }

    // Find the requested model
    const model = models.find((m) => m.name.toLowerCase() === fromModel.toLowerCase());

    if (!model) {
      const availableModels = models.map((m) => m.name).join(', ');
      throw new Error(
        `Model "${fromModel}" not found in Prisma schema. Available models: ${availableModels}`,
      );
    }

    // Generate schema
    const camelName = toCamelCase(model.name);
    const defaultPath = 'packages/shared/src/schemas';
    const targetDir = outputPath ?? defaultPath;
    const filePath = path.join(targetDir, `${camelName}.ts`);

    // Use enhanced template if hints are available
    let content: string;
    if (hints.enhanced) {
      content = prismaZodEnhanced(model, enumMap, hints);
    } else {
      content = generateModelSchema(model, enumMap);
    }

    if (!content) {
      throw new Error(`Model "${fromModel}" has no scalar fields to generate schema for.`);
    }

    return [
      {
        path: filePath,
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

export const prismaZodGenerator = new PrismaZodGeneratorClass();
