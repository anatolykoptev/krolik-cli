/**
 * @module commands/codegen/templates/enhanced/trpc-route
 * @description Docs-enhanced tRPC route template
 */

import { toCamelCase, toPascalCase } from '@/lib/@format';
import type { DocHints } from '../../services/types';

/**
 * Generate tRPC route with docs enhancement
 */
export function trpcRouteEnhanced(name: string, hints: DocHints): string {
  const pascalName = toPascalCase(name);
  const camelName = toCamelCase(name);

  // Build source comment if enhanced
  const sourceComment = hints.enhanced ? `\n * @enhanced Sources: ${hints.sources.join(', ')}` : '';

  // Extract relevant pattern examples
  const trpcPattern = hints.patterns.find((p) => p.name === 'trpc-procedure');
  const patternComment = trpcPattern ? `\n * Pattern: ${trpcPattern.description}` : '';

  // Find error handling pattern
  const errorPattern = hints.patterns.find((p) => p.name === 'error-handling');
  const errorHandling = errorPattern
    ? `
    // Error handling pattern from docs
    try {
      // ... operation
    } catch (error) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Operation failed' });
    }`
    : '';

  return `/**
 * @module server/routers/${camelName}
 * @description ${pascalName} router${sourceComment}${patternComment}
 */

import { z } from 'zod';
import { protectedProcedure, publicProcedure, router } from '../trpc';
${hints.enhanced ? "import { TRPCError } from '@trpc/server';" : ''}

/**
 * Input schema for creating ${name}
 */
const create${pascalName}Input = z.object({
  name: z.string().min(1),
  // Add more fields as needed
});

/**
 * Input schema for updating ${name}
 */
const update${pascalName}Input = z.object({
  id: z.string(),
  name: z.string().min(1).optional(),
  // Add more fields as needed
});

/**
 * ${pascalName} router
 */
export const ${camelName}Router = router({
  /**
   * Get all ${name}s
   */
  getAll: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.${camelName}.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }),

  /**
   * Get ${name} by ID
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.${camelName}.findUnique({
        where: { id: input.id },
      });
    }),

  /**
   * Create new ${name}
   */
  create: protectedProcedure
    .input(create${pascalName}Input)
    .mutation(async ({ ctx, input }) => {${
      errorHandling
        ? errorHandling
        : `
      return ctx.db.${camelName}.create({
        data: input,
      });`
    }
    }),

  /**
   * Update existing ${name}
   */
  update: protectedProcedure
    .input(update${pascalName}Input)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.${camelName}.update({
        where: { id },
        data,
      });
    }),

  /**
   * Delete ${name}
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.${camelName}.delete({
        where: { id: input.id },
      });
    }),
});
`;
}
