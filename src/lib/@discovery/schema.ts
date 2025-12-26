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

// ============================================================================
// PACKAGE TYPE DETECTION
// ============================================================================

/** Detected package type */
export type PackageType = 'ui' | 'api' | 'db' | 'shared' | 'mobile' | 'web' | 'generic';

/** Package.json structure for type detection */
export interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
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
const DEP_INDICATORS: Record<PackageType, string[]> = {
  ui: ['@radix-ui', 'shadcn', '@headlessui', 'react-aria', 'chakra-ui'],
  api: ['@trpc/server', 'express', 'fastify', 'hono', 'koa', 'graphql'],
  db: ['prisma', '@prisma/client', 'drizzle-orm', 'typeorm', 'sequelize', 'mongoose', 'knex'],
  shared: ['zod', 'yup', 'superstruct'],
  mobile: ['react-native', 'expo', '@expo', 'nativewind'],
  web: ['next', 'nuxt', 'remix', 'gatsby', 'astro'],
  generic: [],
};

/** Name patterns for package types */
const NAME_PATTERNS: Record<PackageType, RegExp[]> = {
  ui: [/\/ui$/, /[-_]ui$/, /^ui$/, /\/components$/],
  api: [/\/api$/, /[-_]api$/, /^api$/, /\/server$/, /\/backend$/],
  db: [/\/db$/, /[-_]db$/, /^db$/, /\/database$/, /\/prisma$/],
  shared: [/\/shared$/, /[-_]shared$/, /^shared$/, /\/common$/, /\/core$/],
  mobile: [/\/mobile$/, /[-_]mobile$/, /^mobile$/, /\/app$/, /\/native$/],
  web: [/\/web$/, /[-_]web$/, /^web$/, /\/frontend$/, /\/client$/],
  generic: [],
};

/**
 * Detect package type from name, path, and dependencies
 * Priority: name patterns for apps/* > dependencies > name patterns
 *
 * @param name - Package name from package.json
 * @param dirPath - Relative or absolute path to package directory
 * @param pkg - Parsed package.json object
 * @returns Detected package type
 */
export function detectPackageType(name: string, dirPath: string, pkg: PackageJson): PackageType {
  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
    ...pkg.peerDependencies,
  };
  const depNames = Object.keys(allDeps);
  const dirName = path.basename(dirPath).toLowerCase();
  const nameLower = name.toLowerCase();
  const isAppsDir =
    dirPath.includes('/apps/') || dirPath.startsWith('apps/') || dirPath.startsWith('apps');

  // For apps/* directories, check name patterns first (web/mobile priority)
  if (isAppsDir) {
    for (const type of ['web', 'mobile'] as const) {
      for (const pattern of NAME_PATTERNS[type]) {
        if (pattern.test(nameLower) || pattern.test(dirName)) {
          return type;
        }
      }
    }
    // Also prioritize web/mobile deps for apps
    for (const type of ['web', 'mobile'] as const) {
      for (const indicator of DEP_INDICATORS[type]) {
        if (depNames.some((dep) => dep.startsWith(indicator) || dep === indicator)) {
          return type;
        }
      }
    }
  }

  // Check dependencies
  for (const [type, indicators] of Object.entries(DEP_INDICATORS) as [PackageType, string[]][]) {
    if (type === 'generic') continue;
    for (const indicator of indicators) {
      if (depNames.some((dep) => dep.startsWith(indicator) || dep === indicator)) {
        return type;
      }
    }
  }

  // Check name patterns
  for (const [type, patterns] of Object.entries(NAME_PATTERNS) as [PackageType, RegExp[]][]) {
    if (type === 'generic') continue;
    for (const pattern of patterns) {
      if (pattern.test(nameLower) || pattern.test(dirName)) {
        return type;
      }
    }
  }

  return 'generic';
}

/**
 * Generate human-readable label for package type
 */
export function getPackageTypeLabel(type: PackageType, name: string): string {
  return TYPE_LABELS[type] || name;
}

/**
 * Internal helper to detect package type from path (reads package.json)
 * Used by findSubDocs for backward compatibility
 */
function detectPackageTypeFromPath(name: string, pkgPath: string): PackageType {
  const pkgJsonPath = path.join(pkgPath, 'package.json');
  let pkg: PackageJson = {};

  if (fs.existsSync(pkgJsonPath)) {
    try {
      pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
    } catch {
      // Use empty pkg
    }
  }

  return detectPackageType(name, pkgPath, pkg);
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
      const type = detectPackageTypeFromPath(pkgName, pkgDir);
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
