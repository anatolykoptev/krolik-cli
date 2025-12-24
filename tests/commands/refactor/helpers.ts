/**
 * @module tests/commands/refactor/helpers
 * @description Test utilities for refactor command tests
 */

import type {
  TypeSignature,
  TypeDuplicateInfo,
  FindTypeDuplicatesOptions,
} from '../../../src/commands/refactor/analyzers/type-duplicates';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

// ============================================================================
// CONSTANTS
// ============================================================================

export const TYPE_KIND = {
  INTERFACE: 'interface' as const,
  TYPE: 'type' as const,
  MIXED: 'mixed' as const,
};

export const RECOMMENDATION = {
  MERGE: 'merge' as const,
  RENAME: 'rename' as const,
  KEEP_BOTH: 'keep-both' as const,
};

// ============================================================================
// TYPE SIGNATURE FACTORY
// ============================================================================

/**
 * Create a mock TypeSignature for testing
 */
export function createTestTypeSignature(
  options: Partial<TypeSignature> & { name: string },
): TypeSignature {
  return {
    name: options.name,
    file: options.file ?? 'test.ts',
    line: options.line ?? 1,
    exported: options.exported ?? true,
    kind: options.kind ?? 'interface',
    normalizedStructure: options.normalizedStructure ?? `${options.name}:{}`,
    structureHash: options.structureHash ?? `hash_${options.name}`,
    fields: options.fields,
    definition: options.definition ?? `interface ${options.name} {}`,
  };
}

/**
 * Create a mock TypeDuplicateInfo for testing
 */
export function createTestTypeDuplicate(
  options: Partial<TypeDuplicateInfo> & { name: string },
): TypeDuplicateInfo {
  const result: TypeDuplicateInfo = {
    name: options.name,
    kind: options.kind ?? 'interface',
    locations: options.locations ?? [
      { file: 'file1.ts', line: 1, exported: true, name: options.name },
      { file: 'file2.ts', line: 1, exported: true, name: options.name },
    ],
    similarity: options.similarity ?? 1,
    recommendation: options.recommendation ?? 'merge',
  };

  if (options.commonFields) result.commonFields = options.commonFields;
  if (options.difference) result.difference = options.difference;

  return result;
}

// ============================================================================
// CODE GENERATION
// ============================================================================

/**
 * Generate TypeScript interface code
 */
export function generateInterface(
  name: string,
  fields: Record<string, string>,
  options: { exported?: boolean } = {},
): string {
  const exportPrefix = options.exported !== false ? 'export ' : '';
  const fieldLines = Object.entries(fields)
    .map(([key, type]) => `  ${key}: ${type};`)
    .join('\n');
  return `${exportPrefix}interface ${name} {\n${fieldLines}\n}`;
}

/**
 * Generate TypeScript type alias code
 */
export function generateTypeAlias(
  name: string,
  definition: string,
  options: { exported?: boolean } = {},
): string {
  const exportPrefix = options.exported !== false ? 'export ' : '';
  return `${exportPrefix}type ${name} = ${definition};`;
}

// ============================================================================
// TEMP FILE UTILITIES
// ============================================================================

/**
 * Create a temporary directory for testing
 */
export function createTempDir(prefix = 'krolik-test-'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/**
 * Clean up temporary directory
 */
export function cleanupTempDir(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Minimal tsconfig.json for ts-morph
 */
const MINIMAL_TSCONFIG = JSON.stringify(
  {
    compilerOptions: {
      target: 'ES2020',
      module: 'ESNext',
      moduleResolution: 'bundler',
      strict: true,
      skipLibCheck: true,
    },
    include: ['**/*.ts', '**/*.tsx'],
  },
  null,
  2,
);

/**
 * Create a test project structure
 */
export function createTestProject(
  structure: Record<string, string>,
): { rootPath: string; cleanup: () => void } {
  const rootPath = createTempDir();

  // Always add tsconfig.json for ts-morph
  const fullStructure = {
    'tsconfig.json': MINIMAL_TSCONFIG,
    ...structure,
  };

  for (const [filePath, content] of Object.entries(fullStructure)) {
    const fullPath = path.join(rootPath, filePath);
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, content, 'utf-8');
  }

  return {
    rootPath,
    cleanup: () => cleanupTempDir(rootPath),
  };
}

/**
 * Test with temporary project
 * Automatically cleans up after test
 */
export async function withTempProject<T>(
  structure: Record<string, string>,
  fn: (rootPath: string) => Promise<T> | T,
): Promise<T> {
  const { rootPath, cleanup } = createTestProject(structure);
  try {
    return await fn(rootPath);
  } finally {
    cleanup();
  }
}

// ============================================================================
// ASSERTIONS
// ============================================================================

/**
 * Assert that a TypeDuplicateInfo matches expected values
 */
export function assertTypeDuplicate(
  actual: TypeDuplicateInfo,
  expected: Partial<TypeDuplicateInfo>,
): void {
  if (expected.name !== undefined) {
    expect(actual.name).toBe(expected.name);
  }
  if (expected.kind !== undefined) {
    expect(actual.kind).toBe(expected.kind);
  }
  if (expected.similarity !== undefined) {
    expect(actual.similarity).toBeCloseTo(expected.similarity, 2);
  }
  if (expected.recommendation !== undefined) {
    expect(actual.recommendation).toBe(expected.recommendation);
  }
  if (expected.locations !== undefined) {
    expect(actual.locations).toHaveLength(expected.locations.length);
  }
}

// ============================================================================
// SAMPLE DATA
// ============================================================================

/**
 * Sample interface definitions for testing
 */
export const SAMPLE_INTERFACES = {
  user: generateInterface('User', {
    id: 'string',
    name: 'string',
    email: 'string',
    phone: 'string',
    address: 'string',
  }),
  userDuplicate: generateInterface('User', {
    id: 'string',
    name: 'string',
    email: 'string',
    phone: 'string',
    address: 'string',
  }),
  userSimilar: generateInterface('User', {
    id: 'string',
    name: 'string',
    email: 'string',
    phone: 'string',
    address: 'string',
    age: 'number', // extra field → 5/6 = 0.833 similarity
  }),
  userDifferent: generateInterface('User', {
    userId: 'number',
    username: 'string',
  }),
  profile: generateInterface('Profile', {
    bio: 'string',
    avatar: 'string',
  }),
};

/**
 * Sample type alias definitions for testing
 */
export const SAMPLE_TYPES = {
  id: generateTypeAlias('ID', 'string'),
  idDuplicate: generateTypeAlias('ID', 'string'),
  userId: generateTypeAlias('UserID', 'string | number'),
  status: generateTypeAlias('Status', "'active' | 'inactive'"),
};
