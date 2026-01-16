/**
 * @module commands/codegen/generators/bundle
 * @description Bundle generator - generates multiple related files at once
 *
 * Supported bundle types:
 *   - react-component: Component.tsx + Component.test.tsx + index.ts
 *   - react-hook: useHook.ts + useHook.test.ts + index.ts
 *   - api-route: route.ts + route.test.ts (for Next.js API routes)
 */

import * as path from 'node:path';
import type { DocHints } from '../services/types';
import { hookTemplate, toCamelCase, toPascalCase } from '../templates';
import type { GeneratedFile, GeneratorMetadata, GeneratorOptions } from '../types';
import { BaseGenerator } from './base';

/**
 * Available bundle types
 */
export type BundleType = 'react-component' | 'react-hook' | 'api-route';

/**
 * Bundle type metadata
 */
interface BundleTypeInfo {
  name: string;
  description: string;
  files: string[];
}

/**
 * Available bundle types with descriptions
 */
export const BUNDLE_TYPES: Record<BundleType, BundleTypeInfo> = {
  'react-component': {
    name: 'React Component',
    description: 'Component.tsx + Component.test.tsx + index.ts',
    files: ['Component.tsx', 'Component.test.tsx', 'index.ts'],
  },
  'react-hook': {
    name: 'React Hook',
    description: 'useHook.ts + useHook.test.ts + index.ts',
    files: ['useHook.ts', 'useHook.test.ts', 'index.ts'],
  },
  'api-route': {
    name: 'Next.js API Route',
    description: 'route.ts + route.test.ts',
    files: ['route.ts', 'route.test.ts'],
  },
};

/**
 * Check if a string is a valid bundle type
 */
export function isValidBundleType(type: string): type is BundleType {
  return type in BUNDLE_TYPES;
}

/**
 * Get list of available bundle types
 */
export function getAvailableBundleTypes(): string[] {
  return Object.keys(BUNDLE_TYPES);
}

// ============================================================================
// Templates
// ============================================================================

/**
 * React component template
 */
function reactComponentTemplate(name: string): string {
  const pascalName = toPascalCase(name);

  return `interface ${pascalName}Props {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
}

export function ${pascalName}({ children, onClick, variant = 'primary' }: ${pascalName}Props) {
  return (
    <button className={\`btn btn-\${variant}\`} onClick={onClick}>
      {children}
    </button>
  );
}
`;
}

/**
 * React component test template
 */
function reactComponentTestTemplate(name: string): string {
  const pascalName = toPascalCase(name);

  return `import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ${pascalName} } from './${pascalName}';

describe('${pascalName}', () => {
  it('renders children', () => {
    render(<${pascalName}>Click me</${pascalName}>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('applies variant class', () => {
    render(<${pascalName} variant="secondary">Button</${pascalName}>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('btn-secondary');
  });

  it('handles click events', async () => {
    const handleClick = vi.fn();
    render(<${pascalName} onClick={handleClick}>Click</${pascalName}>);

    await screen.getByRole('button').click();
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
`;
}

/**
 * React hook test template
 */
function reactHookTestTemplate(name: string): string {
  const hookName = name.startsWith('use') ? name : `use${toPascalCase(name)}`;

  return `import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ${hookName} } from './${hookName}';

describe('${hookName}', () => {
  it('returns initial state', () => {
    const { result } = renderHook(() => ${hookName}());

    expect(result.current.data).toBeNull();
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('respects enabled option', () => {
    const { result } = renderHook(() => ${hookName}({ enabled: false }));

    expect(result.current.isLoading).toBe(false);
  });

  it('provides refetch function', async () => {
    const { result } = renderHook(() => ${hookName}());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.refetch();
    });

    expect(result.current.isLoading).toBe(true);
  });
});
`;
}

/**
 * Next.js API route template
 */
function apiRouteTemplate(name: string): string {
  const pascalName = toPascalCase(name);
  const camelName = toCamelCase(name);

  return `import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * Request body schema for ${pascalName}
 */
const ${camelName}Schema = z.object({
  name: z.string().min(1),
  // Add more fields as needed
});

export type ${pascalName}Request = z.infer<typeof ${camelName}Schema>;

/**
 * GET /api/${camelName}
 */
export async function GET(request: NextRequest) {
  try {
    // TODO: Implement GET logic
    const data = { message: 'GET ${camelName}' };
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/${camelName}
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = ${camelName}Schema.parse(body);

    // TODO: Implement POST logic
    const data = { message: 'Created ${camelName}', data: validated };
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
`;
}

/**
 * Next.js API route test template
 */
function apiRouteTestTemplate(name: string): string {
  const camelName = toCamelCase(name);

  return `import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { GET, POST } from './route';

function createRequest(method: string, body?: unknown): NextRequest {
  const url = 'http://localhost:3000/api/${camelName}';
  const init: RequestInit = { method };

  if (body) {
    init.body = JSON.stringify(body);
    init.headers = { 'Content-Type': 'application/json' };
  }

  return new NextRequest(url, init);
}

describe('${camelName} API route', () => {
  describe('GET', () => {
    it('returns success response', async () => {
      const request = createRequest('GET');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('message');
    });
  });

  describe('POST', () => {
    it('creates resource with valid data', async () => {
      const request = createRequest('POST', { name: 'Test' });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toHaveProperty('data');
    });

    it('returns 400 for invalid data', async () => {
      const request = createRequest('POST', { name: '' });
      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });
});
`;
}

/**
 * Barrel export template for component/hook
 */
function barrelExportTemplate(name: string, type: 'component' | 'hook'): string {
  if (type === 'hook') {
    const hookName = name.startsWith('use') ? name : `use${toPascalCase(name)}`;
    return `export { ${hookName}, default } from './${hookName}';
`;
  }

  const pascalName = toPascalCase(name);
  return `export { ${pascalName} } from './${pascalName}';
export type { ${pascalName}Props } from './${pascalName}';
`;
}

// ============================================================================
// Generator
// ============================================================================

/**
 * Extended options for bundle generator
 */
interface BundleGeneratorOptions extends GeneratorOptions {
  bundleType?: BundleType;
}

/**
 * Bundle generator - generates multiple related files at once
 */
class BundleGeneratorClass extends BaseGenerator {
  readonly metadata: GeneratorMetadata = {
    id: 'bundle',
    name: 'Bundle Generator',
    description: 'Generate multiple related files (component + test + barrel)',
    example: 'krolik codegen bundle --bundle react-component --name Button --path src/components',
  };

  /**
   * Get available bundle types for listing
   */
  static getAvailableBundleTypes(): Array<{ type: BundleType; info: BundleTypeInfo }> {
    return Object.entries(BUNDLE_TYPES).map(([type, info]) => ({
      type: type as BundleType,
      info,
    }));
  }

  protected generateWithHints(options: GeneratorOptions, hints: DocHints): GeneratedFile[] {
    const bundleOptions = options as BundleGeneratorOptions;
    const { name, path: outputPath, bundleType } = bundleOptions;

    if (!name) {
      throw new Error('--name is required for bundle generator');
    }

    if (!bundleType) {
      throw new Error(
        `--bundle <type> is required. Available types: ${getAvailableBundleTypes().join(', ')}`,
      );
    }

    if (!isValidBundleType(bundleType)) {
      throw new Error(
        `Invalid bundle type: ${bundleType}. Available types: ${getAvailableBundleTypes().join(', ')}`,
      );
    }

    const basePath = outputPath ?? 'src';

    switch (bundleType) {
      case 'react-component':
        return this.generateReactComponent(name, basePath, hints);
      case 'react-hook':
        return this.generateReactHook(name, basePath, hints);
      case 'api-route':
        return this.generateApiRoute(name, basePath, hints);
      default:
        throw new Error(`Unknown bundle type: ${bundleType}`);
    }
  }

  /**
   * Generate React component bundle
   */
  private generateReactComponent(name: string, basePath: string, hints: DocHints): GeneratedFile[] {
    const pascalName = toPascalCase(name);
    const componentDir = path.join(basePath, pascalName);

    const files: GeneratedFile[] = [
      {
        path: path.join(componentDir, `${pascalName}.tsx`),
        content: reactComponentTemplate(name),
        action: 'create',
      },
      {
        path: path.join(componentDir, `${pascalName}.test.tsx`),
        content: reactComponentTestTemplate(name),
        action: 'create',
      },
      {
        path: path.join(componentDir, 'index.ts'),
        content: barrelExportTemplate(name, 'component'),
        action: 'create',
      },
    ];

    // Add docs enhancement metadata if available
    if (hints.enhanced) {
      for (const file of files) {
        file.docsEnhanced = {
          library: hints.sources[0] ?? 'react',
          topics: hints.patterns.map((p) => p.name),
          snippetsCount: hints.snippets.length,
        };
      }
    }

    return files;
  }

  /**
   * Generate React hook bundle
   */
  private generateReactHook(name: string, basePath: string, hints: DocHints): GeneratedFile[] {
    const hookName = name.startsWith('use') ? name : `use${toPascalCase(name)}`;
    const hookDir = path.join(basePath, hookName);

    const files: GeneratedFile[] = [
      {
        path: path.join(hookDir, `${hookName}.ts`),
        content: hookTemplate(name),
        action: 'create',
      },
      {
        path: path.join(hookDir, `${hookName}.test.ts`),
        content: reactHookTestTemplate(name),
        action: 'create',
      },
      {
        path: path.join(hookDir, 'index.ts'),
        content: barrelExportTemplate(name, 'hook'),
        action: 'create',
      },
    ];

    if (hints.enhanced) {
      for (const file of files) {
        file.docsEnhanced = {
          library: hints.sources[0] ?? 'react',
          topics: hints.patterns.map((p) => p.name),
          snippetsCount: hints.snippets.length,
        };
      }
    }

    return files;
  }

  /**
   * Generate Next.js API route bundle
   */
  private generateApiRoute(name: string, basePath: string, hints: DocHints): GeneratedFile[] {
    const camelName = toCamelCase(name);
    const routeDir = path.join(basePath, camelName);

    const files: GeneratedFile[] = [
      {
        path: path.join(routeDir, 'route.ts'),
        content: apiRouteTemplate(name),
        action: 'create',
      },
      {
        path: path.join(routeDir, 'route.test.ts'),
        content: apiRouteTestTemplate(name),
        action: 'create',
      },
    ];

    if (hints.enhanced) {
      for (const file of files) {
        file.docsEnhanced = {
          library: hints.sources[0] ?? 'next.js',
          topics: hints.patterns.map((p) => p.name),
          snippetsCount: hints.snippets.length,
        };
      }
    }

    return files;
  }
}

export const bundleGenerator = new BundleGeneratorClass();
