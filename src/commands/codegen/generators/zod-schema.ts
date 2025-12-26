/**
 * @module commands/codegen/generators/zod-schema
 * @description Zod schema generator with docs enhancement
 */

import * as path from 'node:path';
import type { DocHints } from '../services/types';
import { toCamelCase, zodSchemaTemplate } from '../templates';
import { zodSchemaEnhanced } from '../templates/enhanced';
import type { GeneratedFile, GeneratorMetadata, GeneratorOptions } from '../types';
import { BaseGenerator } from './base';

/**
 * Zod schema generator
 */
class ZodSchemaGeneratorClass extends BaseGenerator {
  readonly metadata: GeneratorMetadata = {
    id: 'zod-schema',
    name: 'Zod Schema',
    description: 'Generate Zod validation schemas with TypeScript types',
    example: 'krolik codegen zod-schema --name Booking --output packages/shared/src/schemas',
  };

  protected generateWithHints(options: GeneratorOptions, hints: DocHints): GeneratedFile[] {
    const { name, path: outputPath } = options;

    if (!name) {
      throw new Error('--name is required for zod-schema generator');
    }

    const camelName = toCamelCase(name);
    const defaultPath = 'packages/shared/src/schemas';
    const targetDir = outputPath ?? defaultPath;
    const filePath = path.join(targetDir, `${camelName}.ts`);

    const content = hints.enhanced ? zodSchemaEnhanced(name, hints) : zodSchemaTemplate(name);

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

export const zodSchemaGenerator = new ZodSchemaGeneratorClass();
