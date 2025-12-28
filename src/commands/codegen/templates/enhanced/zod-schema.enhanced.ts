/**
 * @module commands/codegen/templates/enhanced/zod-schema
 * @description Docs-enhanced Zod schema template
 */

import { toCamelCase, toPascalCase } from '@/lib/format';
import type { DocHints } from '../../services/types';

/**
 * Generate Zod schema with docs enhancement
 */
export function zodSchemaEnhanced(name: string, hints: DocHints): string {
  const pascalName = toPascalCase(name);
  const camelName = toCamelCase(name);

  const sourceComment = hints.enhanced ? `\n * @enhanced Sources: ${hints.sources.join(', ')}` : '';

  // Check for validation patterns
  const zodPattern = hints.patterns.find((p) => p.name === 'zod-validation');
  const hasRefinement = hints.snippets.some((s) => s.code.includes('.refine('));

  const refinementExample =
    hasRefinement || zodPattern
      ? `
/**
 * Example refinement pattern from docs:
 * .refine((val) => condition, { message: "Error message" })${zodPattern ? `\n * Pattern: ${zodPattern.description}` : ''}
 */`
      : '';

  return `/**
 * @module schemas/${camelName}
 * @description ${pascalName} validation schemas${sourceComment}
 */

import { z } from 'zod';
${refinementExample}

/**
 * Base ${name} schema
 */
export const ${camelName}Schema = z.object({
  id: z.string().cuid(),
  name: z.string().min(1, '${pascalName} name is required'),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Schema for creating ${name}
 */
export const create${pascalName}Schema = ${camelName}Schema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

/**
 * Schema for updating ${name}
 */
export const update${pascalName}Schema = create${pascalName}Schema.partial();

/**
 * Schema with ID for update operations
 */
export const update${pascalName}WithIdSchema = z.object({
  id: z.string().cuid(),
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
