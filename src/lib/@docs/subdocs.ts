/**
 * @module lib/@docs/subdocs
 * @description Sub-documentation file generation and management
 *
 * Dynamically discovers packages in the project and creates CLAUDE.md files.
 * Package type is detected from package name, directory, and dependencies.
 *
 * Uses @discovery module for workspace detection.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { detectMonorepo } from '@/lib/@discovery';

// ============================================================================
// TYPES
// ============================================================================

/** Detected package type */
export type SubDocType = 'ui' | 'api' | 'db' | 'shared' | 'mobile' | 'web' | 'generic';

/** Discovered package info */
export interface DiscoveredPackage {
  /** Package name from package.json */
  name: string;
  /** Relative path to package directory */
  path: string;
  /** Detected type */
  type: SubDocType;
  /** Human-readable label */
  label: string;
  /** Whether CLAUDE.md exists */
  hasDoc: boolean;
}

export interface CreateSubDocResult {
  type: SubDocType;
  path: string;
  packageName: string;
  action: 'created' | 'skipped' | 'error';
  error?: string;
}

// ============================================================================
// TYPE DETECTION
// ============================================================================

interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

/** Keywords in package name or dir that indicate type */
const NAME_PATTERNS: Record<SubDocType, RegExp[]> = {
  ui: [/\/ui$/, /[-_]ui$/, /^ui$/, /\/components$/],
  api: [/\/api$/, /[-_]api$/, /^api$/, /\/server$/, /\/backend$/],
  db: [/\/db$/, /[-_]db$/, /^db$/, /\/database$/, /\/prisma$/],
  shared: [/\/shared$/, /[-_]shared$/, /^shared$/, /\/common$/, /\/core$/],
  mobile: [/\/mobile$/, /[-_]mobile$/, /^mobile$/, /\/app$/, /\/native$/],
  web: [/\/web$/, /[-_]web$/, /^web$/, /\/frontend$/, /\/client$/],
  generic: [],
};

/** Dependencies that indicate package type */
const DEP_INDICATORS: Record<SubDocType, string[]> = {
  ui: ['@radix-ui', 'shadcn', '@headlessui', 'react-aria', 'chakra-ui'],
  api: ['@trpc/server', 'express', 'fastify', 'hono', 'koa', 'graphql'],
  db: ['prisma', '@prisma/client', 'drizzle-orm', 'typeorm', 'sequelize', 'mongoose', 'knex'],
  shared: ['zod', 'yup', 'superstruct'],
  mobile: ['react-native', 'expo', '@expo', 'nativewind'],
  web: ['next', 'nuxt', 'remix', 'gatsby', 'astro'],
  generic: [],
};

/**
 * Detect package type from name, path, and dependencies
 * Priority: name patterns for apps/* > dependencies > name patterns
 */
function detectPackageType(name: string, dirPath: string, pkg: PackageJson): SubDocType {
  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
    ...pkg.peerDependencies,
  };
  const depNames = Object.keys(allDeps);
  const dirName = basename(dirPath).toLowerCase();
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
  for (const [type, indicators] of Object.entries(DEP_INDICATORS) as [SubDocType, string[]][]) {
    if (type === 'generic') continue;
    for (const indicator of indicators) {
      if (depNames.some((dep) => dep.startsWith(indicator) || dep === indicator)) {
        return type;
      }
    }
  }

  // Check name patterns
  for (const [type, patterns] of Object.entries(NAME_PATTERNS) as [SubDocType, RegExp[]][]) {
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
function getTypeLabel(type: SubDocType, name: string): string {
  const labels: Record<SubDocType, string> = {
    ui: 'UI Components',
    api: 'API/Backend',
    db: 'Database',
    shared: 'Shared Utilities',
    mobile: 'Mobile App',
    web: 'Web App',
    generic: basename(name),
  };
  return labels[type];
}

function parsePackageJson(pkgPath: string): PackageJson | null {
  try {
    return JSON.parse(readFileSync(pkgPath, 'utf-8'));
  } catch {
    return null;
  }
}

// ============================================================================
// PACKAGE DISCOVERY (uses @discovery/detectMonorepo)
// ============================================================================

/**
 * Find all packages in a monorepo or single project
 */
export function discoverPackages(projectRoot: string): DiscoveredPackage[] {
  const packages: DiscoveredPackage[] = [];
  const monorepo = detectMonorepo(projectRoot);

  if (monorepo) {
    // Monorepo: iterate over discovered packages
    for (const pkgDir of monorepo.packages) {
      const pkgJsonPath = join(pkgDir, 'package.json');
      const pkg = parsePackageJson(pkgJsonPath);
      if (!pkg) continue;

      const relPath = relative(projectRoot, pkgDir);
      const name = pkg.name || basename(pkgDir);
      const type = detectPackageType(name, relPath, pkg);

      packages.push({
        name,
        path: relPath,
        type,
        label: getTypeLabel(type, name),
        hasDoc: existsSync(join(pkgDir, 'CLAUDE.md')),
      });
    }
  } else {
    // Single package project
    const rootPkgPath = join(projectRoot, 'package.json');
    const pkg = parsePackageJson(rootPkgPath);
    if (pkg) {
      const name = pkg.name || 'project';
      const type = detectPackageType(name, '.', pkg);
      packages.push({
        name,
        path: '.',
        type,
        label: getTypeLabel(type, name),
        hasDoc: existsSync(join(projectRoot, 'CLAUDE.md')),
      });
    }
  }

  return packages;
}

// ============================================================================
// TEMPLATES
// ============================================================================

const TEMPLATES: Record<SubDocType, (pkg: string) => string> = {
  ui: (pkg) => `# CLAUDE.md — UI Components

> AI instructions for ${pkg} package.

---

## Component Library

This package contains reusable UI components.

## Usage

\`\`\`tsx
import { Button, Card, Dialog } from '${pkg}';
\`\`\`

## Guidelines

1. **Check existing components** before creating new ones
2. **Use CSS variables** for theming
3. **Follow accessibility** best practices

---

## Notes

Add component-specific instructions here.
`,

  api: (pkg) => `# CLAUDE.md — API Package

> AI instructions for ${pkg} package.

---

## API Layer

This package contains API/backend logic.

## Guidelines

1. **Validate inputs** with schemas
2. **Handle errors** properly
3. **Check authorization** in protected routes

---

## Notes

Add API-specific instructions here.
`,

  db: (pkg) => `# CLAUDE.md — Database Package

> AI instructions for ${pkg} package.

---

## Database Layer

This package contains database schema and utilities.

## Guidelines

1. **Use \`select\`** for better query performance
2. **Add indexes** for frequently queried fields
3. **Use transactions** for multi-step operations

---

## Notes

Add database-specific instructions here.
`,

  shared: (pkg) => `# CLAUDE.md — Shared Package

> AI instructions for ${pkg} package.

---

## Shared Utilities

This package contains shared types, utilities, and constants.

## Guidelines

1. **No side effects** — only pure functions and types
2. **Tree-shakeable** — use named exports
3. **Well-typed** — avoid \`any\`

## Usage

\`\`\`typescript
import { formatDate, type User } from '${pkg}';
\`\`\`

---

## Notes

Add shared package instructions here.
`,

  mobile: (pkg) => `# CLAUDE.md — Mobile App

> AI instructions for ${pkg}.

---

## Mobile Application

Built with React Native/Expo.

## Guidelines

1. **Use FlatList** for lists
2. **Test on both platforms** (iOS + Android)
3. **Handle offline states** gracefully

---

## Notes

Add mobile-specific instructions here.
`,

  web: (pkg) => `# CLAUDE.md — Web App

> AI instructions for ${pkg}.

---

## Web Application

Built with modern web framework.

## Guidelines

1. **Server-first** when possible
2. **Optimize** for performance
3. **Follow** routing conventions

---

## Notes

Add web-specific instructions here.
`,

  generic: (pkg) => `# CLAUDE.md — ${pkg}

> AI instructions for this package.

---

## Overview

Add package description here.

## Guidelines

Add development guidelines here.

---

## Notes

Add notes here.
`,
};

// ============================================================================
// CREATE SUB-DOCS
// ============================================================================

/**
 * Create CLAUDE.md for a specific package (only if doesn't exist)
 *
 * Strategy: Create new files with template, never modify existing ones.
 * Existing subdocs are human-curated and should not be touched.
 */
export function createSubDoc(
  projectRoot: string,
  pkg: DiscoveredPackage,
  options: { force?: boolean; dryRun?: boolean } = {},
): CreateSubDocResult {
  const docPath = join(projectRoot, pkg.path, 'CLAUDE.md');
  const relPath = join(pkg.path, 'CLAUDE.md');

  // Skip existing files (they contain custom human-written rules)
  if (pkg.hasDoc && !options.force) {
    return { type: pkg.type, path: relPath, packageName: pkg.name, action: 'skipped' };
  }

  // Create new file with template
  const template = TEMPLATES[pkg.type];
  const content = template(pkg.name);

  if (!options.dryRun) {
    try {
      writeFileSync(docPath, content, 'utf-8');
    } catch (err) {
      return {
        type: pkg.type,
        path: relPath,
        packageName: pkg.name,
        action: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  return { type: pkg.type, path: relPath, packageName: pkg.name, action: 'created' };
}

/**
 * Create CLAUDE.md for all packages that don't have one
 *
 * Existing files are never modified - they contain human-curated rules.
 */
export function createMissingSubDocs(
  projectRoot: string,
  options: { force?: boolean; dryRun?: boolean } = {},
): CreateSubDocResult[] {
  const packages = discoverPackages(projectRoot);
  const results: CreateSubDocResult[] = [];

  for (const pkg of packages) {
    // Skip root package (already has CLAUDE.md from main sync)
    if (pkg.path === '.') continue;

    const result = createSubDoc(projectRoot, pkg, options);
    results.push(result);
  }

  return results;
}

/**
 * Get packages that don't have CLAUDE.md
 */
export function getMissingSubDocs(projectRoot: string): DiscoveredPackage[] {
  return discoverPackages(projectRoot).filter((pkg) => pkg.path !== '.' && !pkg.hasDoc);
}

/**
 * Get all discovered packages
 */
export function getAvailablePackages(projectRoot: string): DiscoveredPackage[] {
  return discoverPackages(projectRoot);
}

// ============================================================================
// LEGACY EXPORTS (for backward compatibility)
// ============================================================================

/** @deprecated Use discoverPackages instead */
export interface SubDocCandidate {
  type: SubDocType;
  label: string;
  paths: string[];
  createPath: string;
}

/** @deprecated Use discoverPackages instead */
export const SUB_DOC_CANDIDATES: SubDocCandidate[] = [];
