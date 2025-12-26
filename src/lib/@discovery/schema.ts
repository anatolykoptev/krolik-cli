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
import { walk } from '../@fs';
import { detectMonorepo } from './project';

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
export function findSchemaDir(projectRoot: string, customPath?: string): string | null {
  // Check custom path first
  if (customPath) {
    const fullPath = path.isAbsolute(customPath) ? customPath : path.join(projectRoot, customPath);

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

  walk(
    dir,
    (fullPath) => {
      const fileName = path.basename(fullPath);
      // Check for Zod schema file patterns
      if (
        fileName.endsWith('.schema.ts') ||
        fileName.endsWith('.schemas.ts') ||
        fileName.endsWith('.validator.ts') ||
        fileName === 'schemas.ts' ||
        fileName === 'validators.ts'
      ) {
        files.push(fullPath);
      }
    },
    { extensions: ['.ts'], exclude: ['node_modules', '.git', 'dist', 'build'] },
  );

  return files;
}

// ============================================================================
// SUB-DOCS DISCOVERY
// ============================================================================

export interface SubDocInfo {
  label: string;
  path: string;
}

/** Type labels for package types */
const TYPE_LABELS: Record<string, string> = {
  ui: 'UI Components',
  api: 'API/Backend',
  db: 'Database',
  shared: 'Shared Utilities',
  mobile: 'Mobile App',
  web: 'Web App',
};

/** Dependencies that indicate package type */
const DEP_INDICATORS: Record<string, string[]> = {
  ui: ['@radix-ui', 'shadcn', '@headlessui', 'react-aria', 'chakra-ui'],
  api: ['@trpc/server', 'express', 'fastify', 'hono', 'koa', 'graphql'],
  db: ['prisma', '@prisma/client', 'drizzle-orm', 'typeorm', 'sequelize', 'mongoose'],
  shared: ['zod', 'yup', 'superstruct'],
  mobile: ['react-native', 'expo', '@expo', 'nativewind'],
  web: ['next', 'nuxt', 'remix', 'gatsby', 'astro'],
};

/** Name patterns for package types */
const NAME_PATTERNS: Record<string, RegExp[]> = {
  ui: [/\/ui$/, /[-_]ui$/, /^ui$/],
  api: [/\/api$/, /[-_]api$/, /^api$/, /\/server$/],
  db: [/\/db$/, /[-_]db$/, /^db$/, /\/database$/],
  shared: [/\/shared$/, /[-_]shared$/, /^shared$/, /\/common$/],
  mobile: [/\/mobile$/, /[-_]mobile$/, /^mobile$/],
  web: [/\/web$/, /[-_]web$/, /^web$/, /\/frontend$/],
};

/**
 * Detect package type from name and dependencies
 * Priority: name patterns for apps/* > dependencies > name patterns
 */
function detectPackageType(name: string, pkgPath: string): string {
  const nameLower = name.toLowerCase();
  const dirName = path.basename(pkgPath).toLowerCase();
  const isAppsDir = pkgPath.includes('/apps/') || pkgPath.startsWith('apps/');

  // For apps/* directories, check name patterns first (web/mobile priority)
  if (isAppsDir) {
    for (const type of ['web', 'mobile'] as const) {
      const patterns = NAME_PATTERNS[type];
      if (!patterns) continue;
      for (const pattern of patterns) {
        if (pattern.test(nameLower) || pattern.test(dirName)) {
          return type;
        }
      }
    }
  }

  // Try to read package.json for dependencies
  const pkgJsonPath = path.join(pkgPath, 'package.json');
  if (fs.existsSync(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
      const depNames = Object.keys(allDeps);

      // For apps, prioritize web/mobile deps
      if (isAppsDir) {
        for (const type of ['web', 'mobile'] as const) {
          const indicators = DEP_INDICATORS[type];
          if (!indicators) continue;
          for (const indicator of indicators) {
            if (depNames.some((dep) => dep.startsWith(indicator) || dep === indicator)) {
              return type;
            }
          }
        }
      }

      // Check all dependencies
      for (const [type, indicators] of Object.entries(DEP_INDICATORS)) {
        for (const indicator of indicators) {
          if (depNames.some((dep) => dep.startsWith(indicator) || dep === indicator)) {
            return type;
          }
        }
      }
    } catch {
      // Ignore
    }
  }

  // Check name patterns
  for (const [type, patterns] of Object.entries(NAME_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(nameLower) || pattern.test(dirName)) {
        return type;
      }
    }
  }

  return 'generic';
}

/**
 * Find sub-documentation files in project (dynamically discovered)
 *
 * @param projectRoot - Project root path
 * @returns Array of found sub-docs with labels and relative paths
 */
export function findSubDocs(projectRoot: string): SubDocInfo[] {
  const found: SubDocInfo[] = [];
  const monorepo = detectMonorepo(projectRoot);

  if (!monorepo) {
    // Single project - check root CLAUDE.md
    return found;
  }

  // Scan all packages in monorepo
  for (const pkgDir of monorepo.packages) {
    const claudeMdPath = path.join(pkgDir, 'CLAUDE.md');
    const schemaMdPath = path.join(pkgDir, 'prisma', 'SCHEMA.md');

    // Check for CLAUDE.md
    if (fs.existsSync(claudeMdPath)) {
      const relPath = path.relative(projectRoot, claudeMdPath);
      const pkgName = path.basename(pkgDir);
      const type = detectPackageType(pkgName, pkgDir);
      const label = TYPE_LABELS[type] || pkgName;

      found.push({ label, path: relPath });
    }
    // Check for SCHEMA.md in prisma folder (special case for db packages)
    else if (fs.existsSync(schemaMdPath)) {
      const relPath = path.relative(projectRoot, schemaMdPath);
      found.push({ label: 'Database', path: relPath });
    }
  }

  return found;
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
