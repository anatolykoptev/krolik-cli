/**
 * @module commands/refactor/generator
 * @description Generate ai-config.ts for AI assistants
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { DirectoryInfo, NamespaceCategory } from './core';
import { NAMESPACE_INFO } from './core/constants';

// ============================================================================
// TYPES
// ============================================================================

export interface RefineResult {
  projectRoot: string;
  libDir: string | null;
  directories: DirectoryInfo[];
  currentScore: number;
  suggestedScore: number;
  plan: {
    moves: Array<{ from: string; to: string; reason: string }>;
    importUpdates: Array<{ oldPath: string; newPath: string }>;
    score: { before: number; after: number };
  };
  timestamp: string;
}

// ============================================================================
// AI CONFIG GENERATION
// ============================================================================

/**
 * Generate AI config TypeScript content
 */
export function generateAiConfigContent(result: RefineResult, projectRoot: string): string {
  if (!result.libDir) {
    return '// ERROR: No lib directory found';
  }

  // Group directories by namespace category
  const byCategory = new Map<NamespaceCategory, DirectoryInfo[]>();

  for (const dir of result.directories) {
    if (!byCategory.has(dir.category)) {
      byCategory.set(dir.category, []);
    }
    byCategory.get(dir.category)?.push(dir);
  }

  // Generate namespace entries
  const namespaceEntries: string[] = [];

  for (const [category, dirs] of byCategory) {
    if (category === 'unknown' || dirs.length === 0) continue;

    const info = NAMESPACE_INFO[category];
    const modules = dirs
      .map((d) => {
        const desc = `${d.fileCount} files`;
        return `      ${d.name.replace(/^@/, '')}: '${desc}',`;
      })
      .join('\n');

    const layerName = `Layer ${info.layer}`;
    namespaceEntries.push(`
  /**
   * @${category} — ${layerName}
   * ${info.description}
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
 * @generator krolik-cli refactor --generate-config
 */

// ============================================================================
// NAMESPACE DEFINITIONS
// ============================================================================

export const AI_NAMESPACES = {${namespaceEntries.join('\n')}
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
`;
}

/**
 * Write ai-config.ts to project
 */
export function writeAiConfig(result: RefineResult, projectRoot: string): string | null {
  if (!result.libDir) {
    return null;
  }

  const content = generateAiConfigContent(result, projectRoot);
  const configPath = path.join(result.libDir, 'ai-config.ts');

  fs.writeFileSync(configPath, content, 'utf-8');

  return configPath;
}
