/**
 * @module commands/codegen/generators/trpc-route
 * @description tRPC route generator with docs enhancement
 */

import * as path from 'node:path';
import type { DocHints } from '../services/types';
import { toCamelCase, trpcRouteTemplate } from '../templates';
import { trpcRouteEnhanced } from '../templates/enhanced';
import type { GeneratedFile, GeneratorMetadata, GeneratorOptions } from '../types';
import { BaseGenerator } from './base';

/**
 * tRPC route generator
 */
class TrpcRouteGeneratorClass extends BaseGenerator {
  readonly metadata: GeneratorMetadata = {
    id: 'trpc-route',
    name: 'tRPC Route',
    description: 'Generate a tRPC router with CRUD procedures',
    example: 'krolik codegen trpc-route --name booking --path apps/web/src/server/routers',
  };

  protected generateWithHints(options: GeneratorOptions, hints: DocHints): GeneratedFile[] {
    const { name, path: outputPath } = options;

    if (!name) {
      throw new Error('--name is required for trpc-route generator');
    }

    const camelName = toCamelCase(name);
    const defaultPath = 'apps/web/src/server/routers';
    const targetDir = outputPath ?? defaultPath;
    const filePath = path.join(targetDir, `${camelName}.ts`);

    // Use enhanced template if hints available, otherwise fallback
    const content = hints.enhanced ? trpcRouteEnhanced(name, hints) : trpcRouteTemplate(name);

    return [
      {
        path: filePath,
        content,
        action: 'create',
        ...(hints.enhanced
          ? {
              docsEnhanced: {
                library: hints.sources[0] ?? 'trpc',
                topics: hints.patterns.map((p) => p.name),
                snippetsCount: hints.snippets.length,
              },
            }
          : {}),
      },
    ];
  }
}

export const trpcRouteGenerator = new TrpcRouteGeneratorClass();
