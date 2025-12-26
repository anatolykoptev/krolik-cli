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

/**
 * Information about an exported function for test generation
 */
export interface FunctionTestInfo {
  name: string;
  params: Array<{ name: string; type?: string; isOptional: boolean; hasDefault: boolean }>;
  returnType?: string;
  isAsync: boolean;
}

/**
 * Information about an exported class for test generation
 */
export interface ClassTestInfo {
  name: string;
  methods: Array<{
    name: string;
    params: Array<{ name: string; type?: string; isOptional: boolean; hasDefault: boolean }>;
    returnType?: string;
    isAsync: boolean;
    isStatic: boolean;
  }>;
}

/**
 * Generate test file for analyzed source with function-specific tests
 */
export function functionBasedTestTemplate(
  componentName: string,
  componentPath: string,
  functions: FunctionTestInfo[],
  classes: ClassTestInfo[],
): string {
  const relativePath = componentPath.replace(/\.(tsx?|jsx?)$/, '');

  // Collect all export names for imports
  const exportNames = [...functions.map((f) => f.name), ...classes.map((c) => c.name)].filter(
    (name) => name !== 'default',
  );

  const importStatement =
    exportNames.length > 0
      ? `import { ${exportNames.join(', ')} } from '${relativePath}';`
      : `import ${componentName} from '${relativePath}';`;

  const functionTests = functions.map((func) => generateFunctionTests(func)).join('\n\n');
  const classTests = classes.map((cls) => generateClassTests(cls)).join('\n\n');

  return `/**
 * @module tests/${componentName}
 * @description Tests for ${componentName}
 */

import { describe, expect, it, vi } from 'vitest';
${importStatement}

${functionTests}${functionTests && classTests ? '\n\n' : ''}${classTests}
`;
}

/**
 * Generate describe block for a function
 */
function generateFunctionTests(func: FunctionTestInfo): string {
  const { name, params, isAsync } = func;

  const testPrefix = isAsync ? 'async ' : '';
  const awaitPrefix = isAsync ? 'await ' : '';

  // Generate mock params
  const paramAssignments = params
    .map((p) => `    const ${p.name} = ${generateMockValue(p.name, p.type)};`)
    .join('\n');

  const hasParams = params.length > 0;
  const paramNames = params.map((p) => p.name).join(', ');

  // Basic test
  const basicTest = hasParams
    ? `  it('should ${getFunctionAction(name)} correctly', ${testPrefix}() => {
${paramAssignments}
    const result = ${awaitPrefix}${name}(${paramNames});
    expect(result).toBeDefined();
  });`
    : `  it('should ${getFunctionAction(name)} correctly', ${testPrefix}() => {
    const result = ${awaitPrefix}${name}();
    expect(result).toBeDefined();
  });`;

  // Empty/edge case test
  const edgeCaseTest = hasParams
    ? `  it('should handle empty input', ${testPrefix}() => {
${generateEmptyParamAssignments(params)}
    ${generateEmptyTestBody(name, params, awaitPrefix)}
  });`
    : `  it('should handle edge cases', ${testPrefix}() => {
    // TODO: test edge cases
    const result = ${awaitPrefix}${name}();
    expect(result).toBeDefined();
  });`;

  // Error case test
  const errorTest = `  it('should handle invalid input', ${testPrefix}() => {
    // TODO: test error cases
    ${hasParams ? `expect(() => ${name}(${generateInvalidParams(params)})).toThrow();` : '// Add error handling tests'}
  });`;

  return `describe('${name}', () => {
${basicTest}

${edgeCaseTest}

${errorTest}
});`;
}

/**
 * Generate describe block for a class
 */
function generateClassTests(cls: ClassTestInfo): string {
  const { name, methods } = cls;

  // Instance creation test
  const instanceTest = `  it('should create instance correctly', () => {
    const instance = new ${name}();
    expect(instance).toBeInstanceOf(${name});
  });`;

  // Generate tests for each method
  const methodTests = methods
    .filter((m) => !m.name.startsWith('_') && m.name !== 'constructor')
    .map((method) => {
      const testPrefix = method.isAsync ? 'async ' : '';
      const awaitPrefix = method.isAsync ? 'await ' : '';
      const caller = method.isStatic ? name : 'instance';
      const setup = method.isStatic ? '' : `    const instance = new ${name}();\n`;

      const mockParams = method.params.map((p) => generateMockValue(p.name, p.type)).join(', ');

      return `  it('should ${getFunctionAction(method.name)} correctly', ${testPrefix}() => {
${setup}    const result = ${awaitPrefix}${caller}.${method.name}(${mockParams});
    expect(result).toBeDefined();
  });`;
    })
    .join('\n\n');

  return `describe('${name}', () => {
${instanceTest}
${methodTests ? `\n\n${methodTests}` : ''}
});`;
}

/**
 * Generate mock value based on parameter name and type
 */
function generateMockValue(name: string, type?: string): string {
  // Infer from type annotation
  if (type) {
    const lowerType = type.toLowerCase();
    if (lowerType === 'string' || lowerType.includes('string')) return "''";
    if (lowerType === 'number' || lowerType.includes('number')) return '0';
    if (lowerType === 'boolean' || lowerType.includes('boolean')) return 'false';
    if (lowerType.endsWith('[]') || lowerType.includes('array')) return '[]';
    if (lowerType === 'object' || lowerType.startsWith('{')) return '{}';
    if (lowerType === 'null') return 'null';
    if (lowerType === 'undefined') return 'undefined';
  }

  // Infer from parameter name
  const lowerName = name.toLowerCase();
  if (lowerName.includes('name') || lowerName.includes('text') || lowerName.includes('str'))
    return "''";
  if (lowerName.includes('id') || lowerName.includes('count') || lowerName.includes('num'))
    return '0';
  if (lowerName.includes('is') || lowerName.includes('has') || lowerName.includes('should'))
    return 'false';
  if (lowerName.includes('items') || lowerName.includes('list') || lowerName.includes('arr'))
    return '[]';
  if (lowerName.includes('options') || lowerName.includes('config') || lowerName.includes('data'))
    return '{}';
  if (lowerName === 'body' || lowerName === 'content') return "''";

  // Default
  return "'' // TODO: add test input";
}

/**
 * Get action verb from function name
 */
function getFunctionAction(name: string): string {
  // Common prefixes and their actions
  if (name.startsWith('get')) return `get ${name.slice(3).toLowerCase()}`;
  if (name.startsWith('fetch')) return `fetch ${name.slice(5).toLowerCase()}`;
  if (name.startsWith('parse')) return `parse ${name.slice(5).toLowerCase()}`;
  if (name.startsWith('create')) return `create ${name.slice(6).toLowerCase()}`;
  if (name.startsWith('update')) return `update ${name.slice(6).toLowerCase()}`;
  if (name.startsWith('delete')) return `delete ${name.slice(6).toLowerCase()}`;
  if (name.startsWith('remove')) return `remove ${name.slice(6).toLowerCase()}`;
  if (name.startsWith('validate')) return `validate ${name.slice(8).toLowerCase()}`;
  if (name.startsWith('check')) return `check ${name.slice(5).toLowerCase()}`;
  if (name.startsWith('is')) return `check if ${name.slice(2).toLowerCase()}`;
  if (name.startsWith('has')) return `check if has ${name.slice(3).toLowerCase()}`;
  if (name.startsWith('transform')) return `transform ${name.slice(9).toLowerCase()}`;
  if (name.startsWith('convert')) return `convert ${name.slice(7).toLowerCase()}`;
  if (name.startsWith('format')) return `format ${name.slice(6).toLowerCase()}`;
  if (name.startsWith('calculate')) return `calculate ${name.slice(9).toLowerCase()}`;
  if (name.startsWith('find')) return `find ${name.slice(4).toLowerCase()}`;
  if (name.startsWith('search')) return `search ${name.slice(6).toLowerCase()}`;
  if (name.startsWith('load')) return `load ${name.slice(4).toLowerCase()}`;
  if (name.startsWith('save')) return `save ${name.slice(4).toLowerCase()}`;
  if (name.startsWith('handle')) return `handle ${name.slice(6).toLowerCase()}`;
  if (name.startsWith('process')) return `process ${name.slice(7).toLowerCase()}`;

  return `work`;
}

/**
 * Generate empty parameter assignments for edge case tests
 */
function generateEmptyParamAssignments(
  params: Array<{ name: string; type?: string; isOptional: boolean; hasDefault: boolean }>,
): string {
  return params
    .map((p) => {
      const emptyValue = generateEmptyValue(p.type);
      return `    const ${p.name} = ${emptyValue};`;
    })
    .join('\n');
}

/**
 * Generate empty value based on type
 */
function generateEmptyValue(type?: string): string {
  if (!type) return "''";
  const lowerType = type.toLowerCase();
  if (lowerType === 'string' || lowerType.includes('string')) return "''";
  if (lowerType === 'number' || lowerType.includes('number')) return '0';
  if (lowerType === 'boolean' || lowerType.includes('boolean')) return 'false';
  if (lowerType.endsWith('[]') || lowerType.includes('array')) return '[]';
  if (lowerType === 'object' || lowerType.startsWith('{')) return '{}';
  return "''";
}

/**
 * Generate empty test body
 */
function generateEmptyTestBody(
  name: string,
  params: Array<{ name: string; type?: string; isOptional: boolean; hasDefault: boolean }>,
  awaitPrefix: string,
): string {
  const paramNames = params.map((p) => p.name).join(', ');
  // Check if first param is likely a string (common case)
  const firstParam = params[0];
  if (firstParam && (firstParam.type?.toLowerCase().includes('string') || !firstParam.type)) {
    return `expect(${awaitPrefix}${name}(${paramNames})).toEqual([]);`;
  }
  return `const result = ${awaitPrefix}${name}(${paramNames});\n    expect(result).toBeDefined();`;
}

/**
 * Generate invalid parameters for error tests
 */
function generateInvalidParams(
  params: Array<{ name: string; type?: string; isOptional: boolean; hasDefault: boolean }>,
): string {
  return params
    .map((p) => {
      const lowerType = (p.type ?? '').toLowerCase();
      // Return null for most types to trigger errors
      if (lowerType.includes('string')) return 'null as unknown as string';
      if (lowerType.includes('number')) return 'NaN';
      return 'null';
    })
    .join(', ');
}
