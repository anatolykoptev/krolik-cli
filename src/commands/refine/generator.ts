/**
 * @module commands/refine/generator
 * @description Generate ai-config.ts for AI assistants
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Logger } from '../../types';
import type { RefineResult, DirectoryInfo, NamespaceCategory } from './types';
import { NAMESPACE_INFO } from './analyzer';

// ============================================================================
// AI CONFIG GENERATION
// ============================================================================

/**
 * Generate AI config TypeScript content
 */
export function generateAiConfigContent(
  result: RefineResult,
  projectRoot: string,
): string {
  if (!result.libDir) {
    return '// ERROR: No lib directory found';
  }

  // Group directories by namespace category
  const byCategory = new Map<NamespaceCategory, DirectoryInfo[]>();

  for (const dir of result.directories) {
    if (!byCategory.has(dir.category)) {
      byCategory.set(dir.category, []);
    }
    byCategory.get(dir.category)!.push(dir);
  }

  // Generate namespace entries
  const namespaceEntries: string[] = [];

  for (const [category, dirs] of byCategory) {
    if (category === 'unknown' || dirs.length === 0) continue;

    const info = NAMESPACE_INFO[category];
    const modules = dirs.map(d => {
      const desc = d.modules
        ? Object.entries(d.modules).map(([k, v]) => `${k}: ${v}`).join(', ')
        : `${d.fileCount} files`;
      return `      ${d.name.replace(/^@/, '')}: '${desc}',`;
    }).join('\n');

    namespaceEntries.push(`
  /**
   * @${category} — ${info.layer.split('.')[0]}
   * ${info.layer}
   */
  '@${category}': {
    path: 'lib/@${category}',
    description: '${info.description}',
    modules: {
${modules}
    },
    dependsOn: ${JSON.stringify(info.dependsOn)},
    usedBy: ${JSON.stringify(info.usedBy)},
  },`);
  }

  const libPath = path.relative(projectRoot, result.libDir);
  const timestamp = new Date().toISOString();

  return `/**
 * AI Configuration & Namespace Map
 *
 * This file defines the semantic structure of the codebase for AI assistants.
 * It provides context about what each namespace contains and how to navigate the code.
 *
 * @ai-context This is the PRIMARY reference for understanding project structure
 * @generated ${timestamp}
 * @generator krolik-cli refine --generate-config
 */

// ============================================================================
// NAMESPACE DEFINITIONS
// ============================================================================

export const AI_NAMESPACES = {${namespaceEntries.join('\n')}
} as const;

// ============================================================================
// COMPONENT STRUCTURE MAP (customize for your project)
// ============================================================================

export const AI_COMPONENT_STRUCTURE = {
  /**
   * components/features/ — Feature components organized by domain
   */
  'features': {
    path: 'components/features',
    description: 'Domain-specific feature components',
    domains: {},
  },

  /**
   * components/shared/ — Cross-feature shared components
   */
  'shared': {
    path: 'components/shared',
    description: 'Shared components used across features',
    components: [],
  },

  /**
   * components/layouts/ — Page layouts
   */
  'layouts': {
    path: 'components/layouts',
    description: 'Page layout components',
    components: [],
  },
} as const;

// ============================================================================
// AI NAVIGATION HELPERS
// ============================================================================

/**
 * Quick reference for common tasks
 * @ai-hint Use this to find the right location for new code
 */
export const AI_QUICK_REFERENCE = {
  // Where to add new code
  newServerLogic: '@domain or packages/api/routers',
  newClientHook: '@ui/hooks',
  newUtility: '@core/utils',
  newConstant: '@domain/data',
  newIntegration: '@integrations',
  newComponent: 'components/features/<domain>',

  // Import patterns
  imports: {
    auth: "import { auth } from '@/${libPath}/@core/auth'",
    hooks: "import { useHook } from '@/${libPath}/@ui/hooks'",
    utils: "import { util } from '@/${libPath}/@core/utils'",
    data: "import { DATA } from '@/${libPath}/@domain/data'",
    seo: "import { generateMetadata } from '@/${libPath}/@seo'",
  },

  // File naming conventions
  naming: {
    components: 'PascalCase.tsx (e.g., PlaceCard.tsx)',
    hooks: 'camelCase with use prefix (e.g., useFavorites.ts)',
    utils: 'camelCase.ts (e.g., formatDate.ts)',
    constants: 'camelCase.ts or UPPER_SNAKE_CASE exports',
    types: 'types.ts within module directory',
  },
} as const;

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type NamespaceKey = keyof typeof AI_NAMESPACES;
export type ComponentStructureKey = keyof typeof AI_COMPONENT_STRUCTURE;
`;
}

/**
 * Write ai-config.ts to project
 */
export function writeAiConfig(
  result: RefineResult,
  projectRoot: string,
  logger?: Logger,
): string | null {
  if (!result.libDir) {
    logger?.error('No lib directory found');
    return null;
  }

  const content = generateAiConfigContent(result, projectRoot);
  const configPath = path.join(result.libDir, 'ai-config.ts');

  fs.writeFileSync(configPath, content, 'utf-8');

  const relativePath = path.relative(projectRoot, configPath);
  logger?.success(`Generated: ${relativePath}`);
  logger?.info('This file provides AI assistants with namespace context.');

  return configPath;
}

/**
 * Generate package/workspace aware ai-config for monorepos
 */
export function generateMonorepoAiConfig(
  projectRoot: string,
  packages: string[],
  logger?: Logger,
): string {
  const timestamp = new Date().toISOString();

  // Discover packages structure
  const packageEntries: string[] = [];

  for (const pkg of packages) {
    const pkgPath = path.join(projectRoot, pkg);
    const pkgJsonPath = path.join(pkgPath, 'package.json');

    if (fs.existsSync(pkgJsonPath)) {
      try {
        const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
        const name = pkgJson.name || pkg;
        const description = pkgJson.description || 'Package';

        packageEntries.push(`
  '${name}': {
    path: '${pkg}',
    description: '${description}',
    exports: 'See package.json',
  },`);
      } catch {
        logger?.warn(`Could not read ${pkgJsonPath}`);
      }
    }
  }

  return `/**
 * AI Configuration for Monorepo
 *
 * @ai-context Package structure and relationships
 * @generated ${timestamp}
 * @generator krolik-cli refine --generate-config
 */

export const AI_PACKAGES = {${packageEntries.join('\n')}
} as const;

export type PackageKey = keyof typeof AI_PACKAGES;
`;
}
