/**
 * @module commands/codegen/templates/enhanced/prisma-zod
 * @description Docs-enhanced Prisma to Zod schema template
 */

import { toCamelCase } from '@/lib/@format';
import { fieldToZod } from '@/lib/@prisma';
import type { PrismaEnum, PrismaModel } from '../../../schema/parser';
import type { DocHints } from '../../services/types';

/**
 * Extract validation patterns from hints for specific field types
 */
function getValidationEnhancements(hints: DocHints): string[] {
  const enhancements: string[] = [];

  // Check for validation patterns
  const zodPattern = hints.patterns.find((p) => p.name === 'zod-validation');
  const hasRefinement = hints.snippets.some((s) => s.code.includes('.refine('));
  const hasTransform = hints.snippets.some((s) => s.code.includes('.transform('));

  if (hasRefinement || zodPattern) {
    enhancements.push(' * @tip Refinements: .refine((val) => condition, { message: "Error" })');
  }

  if (hasTransform) {
    enhancements.push(' * @tip Transforms: .transform((val) => transformedVal)');
  }

  // Add pattern-specific tips
  if (zodPattern) {
    enhancements.push(` * @pattern ${zodPattern.name}: ${zodPattern.description}`);
  }

  return enhancements;
}

// ============================================================================
// MAIN TEMPLATE
// ============================================================================

/**
 * Generate Prisma to Zod schema with docs enhancement
 */
export function prismaZodEnhanced(
  model: PrismaModel,
  enums: Map<string, PrismaEnum>,
  hints: DocHints,
): string {
  const pascalName = model.name;
  const camelName = toCamelCase(model.name);

  const sourceComment = hints.enhanced ? `\n * @enhanced Sources: ${hints.sources.join(', ')}` : '';

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

  // Get validation enhancement tips
  const validationTips = getValidationEnhancements(hints);
  const tipsComment =
    validationTips.length > 0
      ? `\n/**\n * Zod Enhancement Tips:\n${validationTips.join('\n')}\n */\n`
      : '';

  return `/**
 * @module schemas/${camelName}
 * @description ${pascalName} validation schemas
 * @generated from Prisma model ${pascalName}${sourceComment}
 */

import { z } from 'zod';
${tipsComment}
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
