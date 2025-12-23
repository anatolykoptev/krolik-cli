/**
 * @module commands/refine/analyzer
 * @description Project structure analyzer for namespace detection
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  NamespaceCategory,
  DirectoryInfo,
  MigrationPlan,
  RefineResult,
} from './types';

// ============================================================================
// NAMESPACE RULES
// ============================================================================

/**
 * Keywords that indicate which namespace a directory belongs to
 * Based on Clean Architecture and Domain-Driven Design principles
 */
export const NAMESPACE_KEYWORDS: Record<NamespaceCategory, string[]> = {
  core: [
    'auth', 'session', 'user', 'config', 'routes', 'router', 'trpc',
    'middleware', 'api', 'server', 'client', 'context', 'providers',
    'constants', 'env', 'i18n', 'locale', 'theme', 'settings',
  ],
  domain: [
    'booking', 'event', 'place', 'venue', 'ticket', 'order', 'payment',
    'review', 'rating', 'customer', 'crm', 'calendar', 'schedule',
    'business', 'admin', 'dashboard', 'panel', 'notification', 'dal',
    'stores', 'state', 'data',
  ],
  integrations: [
    'storage', 'upload', 'email', 'sms', 'push', 'analytics', 'tracking',
    'stripe', 'yookassa', 'paypal', 'twilio', 'sendgrid', 'firebase',
    's3', 'cloudinary', 'maps', 'google', 'facebook', 'oauth', 'external',
  ],
  ui: [
    'hooks', 'components', 'layout', 'modal', 'dialog', 'form',
    'button', 'input', 'table', 'card', 'icon', 'animation', 'motion',
  ],
  utils: [
    'utils', 'helpers', 'common', 'shared', 'tools', 'format',
    'date', 'string', 'array', 'object', 'validation', 'sanitize',
  ],
  seo: [
    'seo', 'metadata', 'schema', 'jsonld', 'opengraph', 'sitemap',
    'robots', 'indexnow', 'structured-data',
  ],
  unknown: [],
};

/**
 * Namespace metadata for descriptions
 */
export const NAMESPACE_INFO: Record<NamespaceCategory, {
  description: string;
  layer: string;
  dependsOn: string[];
  usedBy: string[];
}> = {
  core: {
    description: 'Foundation layer: auth, config, utilities',
    layer: 'Pure utilities, configuration, authentication. NO business logic, NO UI dependencies',
    dependsOn: [],
    usedBy: ['@domain', '@ui', '@seo', '@integrations'],
  },
  domain: {
    description: 'Business logic: data access, constants, state',
    layer: 'Data access, business rules, state management. Uses @core, provides data to @ui',
    dependsOn: ['@core'],
    usedBy: ['@ui'],
  },
  integrations: {
    description: 'External services: storage, analytics, APIs',
    layer: 'Third-party API integrations, storage, analytics. Isolated from business logic',
    dependsOn: ['@core'],
    usedBy: ['@domain', 'components'],
  },
  ui: {
    description: 'UI utilities: hooks, providers, client helpers',
    layer: 'React hooks, providers, client-side utilities. Consumes @domain',
    dependsOn: ['@core', '@domain'],
    usedBy: ['components'],
  },
  utils: {
    description: 'Shared utilities and helpers',
    layer: 'Common utility functions used across the codebase',
    dependsOn: [],
    usedBy: ['@core', '@domain', '@ui'],
  },
  seo: {
    description: 'SEO: metadata, JSON-LD schemas, indexnow',
    layer: 'Metadata generation, structured data, indexing. Self-contained module',
    dependsOn: ['@core'],
    usedBy: ['app'],
  },
  unknown: {
    description: 'Uncategorized modules',
    layer: 'Modules that need manual categorization',
    dependsOn: [],
    usedBy: [],
  },
};

/**
 * Directories to skip during analysis
 */
const SKIP_DIRS = [
  'node_modules', '.git', '.next', 'dist', 'build', 'coverage',
  '__tests__', '__mocks__', '.turbo', '.cache',
];

// ============================================================================
// LIB DIRECTORY DETECTION
// ============================================================================

/**
 * Find lib directory in project
 */
export function findLibDir(projectRoot: string): string | null {
  const candidates = [
    path.join(projectRoot, 'lib'),
    path.join(projectRoot, 'src', 'lib'),
    path.join(projectRoot, 'apps', 'web', 'lib'),
    path.join(projectRoot, 'packages', 'shared', 'src'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

// ============================================================================
// ANALYSIS FUNCTIONS
// ============================================================================

/**
 * Check if directory name uses @namespace pattern
 */
export function isNamespaced(name: string): boolean {
  return name.startsWith('@');
}

/**
 * Detect namespace category from name and subdirectories
 */
export function detectCategory(name: string, subdirs: string[]): NamespaceCategory {
  const lowerName = name.toLowerCase().replace(/^@/, '');
  const allNames = [lowerName, ...subdirs.map(s => s.toLowerCase().replace(/^@/, ''))];

  for (const [category, keywords] of Object.entries(NAMESPACE_KEYWORDS)) {
    if (category === 'unknown') continue;

    for (const keyword of keywords) {
      if (allNames.some(n => n.includes(keyword))) {
        return category as NamespaceCategory;
      }
    }
  }

  return 'unknown';
}

/**
 * Count TypeScript files in directory (recursive)
 */
export function countTsFiles(dir: string): number {
  if (!fs.existsSync(dir)) return 0;

  let count = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      count++;
    } else if (entry.isDirectory() && !SKIP_DIRS.includes(entry.name)) {
      count += countTsFiles(path.join(dir, entry.name));
    }
  }

  return count;
}

/**
 * Get subdirectory names
 */
export function getSubdirs(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(e => e.isDirectory() && !SKIP_DIRS.includes(e.name))
    .map(e => e.name);
}

/**
 * Analyze a single directory
 */
export function analyzeDirectory(dir: string, libDir: string): DirectoryInfo {
  const name = path.basename(dir);
  const subdirs = getSubdirs(dir);
  const fileCount = countTsFiles(dir);
  const namespaced = isNamespaced(name);
  const category = detectCategory(name, subdirs);

  // Build module descriptions from subdirs
  const modules: Record<string, string> = {};
  for (const subdir of subdirs) {
    const subPath = path.join(dir, subdir);
    const subFileCount = countTsFiles(subPath);
    modules[subdir] = `${subFileCount} files`;
  }

  // Suggest namespace if not already namespaced
  let suggestedNamespace: string | undefined;
  if (!namespaced && category !== 'unknown') {
    suggestedNamespace = `@${category}/@${name}`;
  }

  return {
    name,
    path: path.relative(libDir, dir),
    fileCount,
    subdirs,
    category,
    isNamespaced: namespaced,
    suggestedNamespace,
    modules: Object.keys(modules).length > 0 ? modules : undefined,
  };
}

/**
 * Calculate organization score (0-100)
 */
export function calculateScore(directories: DirectoryInfo[]): number {
  if (directories.length === 0) return 100;

  const namespacedCount = directories.filter(d => d.isNamespaced).length;
  return Math.round((namespacedCount / directories.length) * 100);
}

/**
 * Generate migration plan from analysis
 */
export function generateMigrationPlan(directories: DirectoryInfo[], libDir: string): MigrationPlan {
  const moves: MigrationPlan['moves'] = [];
  const importUpdates: MigrationPlan['importUpdates'] = [];

  // Group by category for migration
  const byCategory = new Map<NamespaceCategory, DirectoryInfo[]>();

  for (const dir of directories) {
    if (dir.isNamespaced) continue;
    if (dir.category === 'unknown') continue;

    if (!byCategory.has(dir.category)) {
      byCategory.set(dir.category, []);
    }
    byCategory.get(dir.category)!.push(dir);
  }

  // Generate moves
  for (const [category, dirs] of byCategory) {
    for (const dir of dirs) {
      const targetPath = `@${category}/@${dir.name}`;

      moves.push({
        from: dir.path,
        to: targetPath,
        reason: `Matches ${category} keywords`,
      });

      // Generate import path updates
      importUpdates.push({
        oldPath: `@/lib/${dir.name}`,
        newPath: `@/lib/@${category}/@${dir.name}`,
      });
    }
  }

  // Calculate scores
  const namespacedBefore = directories.filter(d => d.isNamespaced).length;
  const namespacedAfter = namespacedBefore + moves.length;
  const total = directories.length;

  return {
    moves,
    importUpdates,
    score: {
      before: total > 0 ? Math.round((namespacedBefore / total) * 100) : 100,
      after: total > 0 ? Math.round((namespacedAfter / total) * 100) : 100,
    },
  };
}

// ============================================================================
// MAIN ANALYSIS
// ============================================================================

/**
 * Analyze project structure
 */
export function analyzeStructure(projectRoot: string, libPath?: string): RefineResult {
  const libDir = libPath || findLibDir(projectRoot);

  if (!libDir) {
    return {
      projectRoot,
      libDir: null,
      directories: [],
      currentScore: 0,
      suggestedScore: 0,
      plan: { moves: [], importUpdates: [], score: { before: 0, after: 0 } },
      timestamp: new Date().toISOString(),
    };
  }

  // Get all directories in lib
  const entries = fs.readdirSync(libDir, { withFileTypes: true })
    .filter(e => e.isDirectory() && !SKIP_DIRS.includes(e.name));

  // Analyze each directory
  const directories = entries.map(e =>
    analyzeDirectory(path.join(libDir, e.name), libDir)
  );

  // Calculate scores
  const currentScore = calculateScore(directories);
  const plan = generateMigrationPlan(directories, libDir);

  return {
    projectRoot,
    libDir,
    directories,
    currentScore,
    suggestedScore: plan.score.after,
    plan,
    timestamp: new Date().toISOString(),
  };
}
