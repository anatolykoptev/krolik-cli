/**
 * @module commands/codegen/templates
 * @description Template strings for code generation
 */

import { toCamelCase as toCamelCaseLib, toPascalCase as toPascalCaseLib } from '@/lib/@formatters';

// Re-export for backwards compatibility with other codegen files
export const toPascalCase = toPascalCaseLib;
export const toCamelCase = toCamelCaseLib;

/**
 * tRPC route template
 */
export function trpcRouteTemplate(name: string): string {
  const pascalName = toPascalCase(name);
  const camelName = toCamelCase(name);

  return `/**
 * @module server/routers/${camelName}
 * @description ${pascalName} router
 */

import { z } from 'zod';
import { protectedProcedure, publicProcedure, router } from '../trpc';

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
    .mutation(async ({ ctx, input }) => {
      return ctx.db.${camelName}.create({
        data: input,
      });
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

/**
 * Zod schema template
 */
export function zodSchemaTemplate(name: string): string {
  const pascalName = toPascalCase(name);
  const camelName = toCamelCase(name);

  return `/**
 * @module schemas/${camelName}
 * @description ${pascalName} validation schemas
 */

import { z } from 'zod';

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

/**
 * Test file template
 */
export function testTemplate(
  componentName: string,
  componentPath: string,
  isReact: boolean,
): string {
  const pascalName = toPascalCase(componentName);
  const relativePath = componentPath.replace(/\.tsx?$/, '');

  if (isReact) {
    return `/**
 * @module tests/${componentName}
 * @description Tests for ${pascalName} component
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ${pascalName} } from '${relativePath}';

describe('${pascalName}', () => {
  it('renders without crashing', () => {
    render(<${pascalName} />);
    // Add specific assertions based on component
  });

  it('handles user interaction', async () => {
    const user = userEvent.setup();
    render(<${pascalName} />);

    // Example: clicking a button
    // const button = screen.getByRole('button');
    // await user.click(button);
    // expect(...).toBe(...);
  });

  it('displays correct content', () => {
    render(<${pascalName} />);
    // Add content assertions
  });
});
`;
  }

  return `/**
 * @module tests/${componentName}
 * @description Tests for ${pascalName}
 */

import { describe, expect, it, vi } from 'vitest';
import { ${pascalName} } from '${relativePath}';

describe('${pascalName}', () => {
  it('works correctly', () => {
    // Add test implementation
    expect(true).toBe(true);
  });

  it('handles edge cases', () => {
    // Add edge case tests
  });

  it('handles errors gracefully', () => {
    // Add error handling tests
  });
});
`;
}

/**
 * React hook template
 */
export function hookTemplate(name: string): string {
  const hookName = name.startsWith('use') ? name : `use${toPascalCase(name)}`;
  const pascalName = toPascalCase(name.replace(/^use/, ''));

  return `/**
 * @module hooks/${hookName}
 * @description Custom hook for ${pascalName}
 */

import { useCallback, useEffect, useState } from 'react';

interface ${pascalName}State {
  data: unknown;
  isLoading: boolean;
  error: Error | null;
}

interface ${pascalName}Options {
  enabled?: boolean;
}

/**
 * ${hookName} - Custom hook for ${pascalName} functionality
 */
export function ${hookName}(options: ${pascalName}Options = {}) {
  const { enabled = true } = options;

  const [state, setState] = useState<${pascalName}State>({
    data: null,
    isLoading: false,
    error: null,
  });

  const fetch${pascalName} = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // Implement fetch logic
      const data = null; // Replace with actual fetch
      setState({ data, isLoading: false, error: null });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error : new Error('Unknown error'),
      }));
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      fetch${pascalName}();
    }
  }, [enabled, fetch${pascalName}]);

  const refetch = useCallback(() => {
    fetch${pascalName}();
  }, [fetch${pascalName}]);

  return {
    ...state,
    refetch,
  };
}

export default ${hookName};
`;
}

/**
 * Barrel export template
 */
export function barrelTemplate(exports: string[]): string {
  return `${exports.map((exp) => `export * from './${exp}';`).join('\n')}\n`;
}
