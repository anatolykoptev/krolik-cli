/**
 * @module lib/claude/subdocs
 * @description Sub-documentation file generation and management
 *
 * Dynamically discovers packages in the project and creates CLAUDE.md files.
 * Package type is detected from package name, directory, and dependencies.
 *
 * Uses @discovery module for workspace detection and package type detection.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import {
  detectMonorepo,
  detectPackageType,
  getPackageTypeLabel,
  type PackageJson,
  type PackageType,
} from '@/lib/@discovery';

// ============================================================================
// TYPES
// ============================================================================

/** @deprecated Use PackageType from @discovery instead */
export type SubDocType = PackageType;

/** Discovered package info */
export interface DiscoveredPackage {
  /** Package name from package.json */
  name: string;
  /** Relative path to package directory */
  path: string;
  /** Detected type */
  type: PackageType;
  /** Human-readable label */
  label: string;
  /** Whether CLAUDE.md exists */
  hasDoc: boolean;
}

export interface CreateSubDocResult {
  type: PackageType;
  path: string;
  packageName: string;
  action: 'created' | 'skipped' | 'error';
  error?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

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
        label: getPackageTypeLabel(type, name),
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
        label: getPackageTypeLabel(type, name),
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
  options: { force?: boolean | undefined; dryRun?: boolean | undefined } = {},
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
  options: { force?: boolean | undefined; dryRun?: boolean | undefined } = {},
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
