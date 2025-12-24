/**
 * @module lib/discovery/schema
 * @description Schema file discovery (Prisma, Zod, etc.)
 *
 * Provides utilities for:
 * - Finding Prisma schema directory
 * - Finding Zod schema files
 * - Finding validation schemas
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Common Prisma schema directory locations */
const PRISMA_CANDIDATES = [
  'packages/db/prisma',
  'prisma',
  'src/prisma',
  'db/prisma',
  'database/prisma',
  'libs/database/prisma',
];

/** Common Zod schema locations */
const ZOD_CANDIDATES = [
  'packages/shared/src/schemas',
  'packages/api/src/schemas',
  'src/schemas',
  'src/lib/schemas',
  'src/validators',
  'lib/schemas',
  'schemas',
];

// ============================================================================
// PRISMA DISCOVERY
// ============================================================================

/**
 * Find Prisma schema directory
 *
 * Searches common locations for prisma/ directory containing schema files.
 *
 * @param projectRoot - Project root path
 * @param customPath - Optional custom path to check first
 * @returns Path to Prisma directory or null
 */
export function findSchemaDir(
  projectRoot: string,
  customPath?: string,
): string | null {
  // Check custom path first
  if (customPath) {
    const fullPath = path.isAbsolute(customPath)
      ? customPath
      : path.join(projectRoot, customPath);

    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  // Search candidates
  for (const candidate of PRISMA_CANDIDATES) {
    const fullPath = path.join(projectRoot, candidate);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  return null;
}

/**
 * Find Prisma schema file (schema.prisma)
 *
 * @returns Path to schema.prisma or null
 */
export function findPrismaSchema(projectRoot: string): string | null {
  const schemaDir = findSchemaDir(projectRoot);
  if (!schemaDir) return null;

  // Check for schema.prisma
  const schemaPath = path.join(schemaDir, 'schema.prisma');
  if (fs.existsSync(schemaPath)) {
    return schemaPath;
  }

  // Check for multi-file schema (schema/ directory)
  const multiSchemaDir = path.join(schemaDir, 'schema');
  if (fs.existsSync(multiSchemaDir) && fs.statSync(multiSchemaDir).isDirectory()) {
    return multiSchemaDir;
  }

  return null;
}

/**
 * Find all Prisma schema files (supports multi-file schemas)
 */
export function findPrismaSchemaFiles(projectRoot: string): string[] {
  const schemaDir = findSchemaDir(projectRoot);
  if (!schemaDir) return [];

  const files: string[] = [];

  // Single schema.prisma
  const singleSchema = path.join(schemaDir, 'schema.prisma');
  if (fs.existsSync(singleSchema)) {
    files.push(singleSchema);
  }

  // Multi-file schema directory
  const multiSchemaDir = path.join(schemaDir, 'schema');
  if (fs.existsSync(multiSchemaDir) && fs.statSync(multiSchemaDir).isDirectory()) {
    const entries = fs.readdirSync(multiSchemaDir);
    for (const entry of entries) {
      if (entry.endsWith('.prisma')) {
        files.push(path.join(multiSchemaDir, entry));
      }
    }
  }

  return files;
}

// ============================================================================
// ZOD DISCOVERY
// ============================================================================

/**
 * Find Zod schemas directory
 *
 * @param projectRoot - Project root path
 * @returns Path to schemas directory or null
 */
export function findZodSchemasDir(projectRoot: string): string | null {
  for (const candidate of ZOD_CANDIDATES) {
    const fullPath = path.join(projectRoot, candidate);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  return null;
}

/**
 * Find all Zod schema files
 *
 * Searches for files with common Zod patterns:
 * - *.schema.ts
 * - *.schemas.ts
 * - schemas/*.ts
 * - validators/*.ts
 */
export function findZodSchemas(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];

  const files: string[] = [];

  function walk(currentDir: string): void {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        // Skip node_modules and common non-code directories
        if (!['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
          walk(fullPath);
        }
      } else if (entry.isFile()) {
        // Check for Zod schema file patterns
        if (
          entry.name.endsWith('.schema.ts') ||
          entry.name.endsWith('.schemas.ts') ||
          entry.name.endsWith('.validator.ts') ||
          entry.name === 'schemas.ts' ||
          entry.name === 'validators.ts'
        ) {
          files.push(fullPath);
        }
      }
    }
  }

  walk(dir);
  return files;
}

// ============================================================================
// GENERIC SCHEMA DISCOVERY
// ============================================================================

export interface SchemaInfo {
  type: 'prisma' | 'zod' | 'json-schema' | 'unknown';
  path: string;
  files: string[];
}

/**
 * Discover all schema types in project
 */
export function discoverSchemas(projectRoot: string): SchemaInfo[] {
  const schemas: SchemaInfo[] = [];

  // Prisma
  const prismaDir = findSchemaDir(projectRoot);
  if (prismaDir) {
    schemas.push({
      type: 'prisma',
      path: prismaDir,
      files: findPrismaSchemaFiles(projectRoot),
    });
  }

  // Zod
  const zodDir = findZodSchemasDir(projectRoot);
  if (zodDir) {
    schemas.push({
      type: 'zod',
      path: zodDir,
      files: findZodSchemas(zodDir),
    });
  }

  return schemas;
}
