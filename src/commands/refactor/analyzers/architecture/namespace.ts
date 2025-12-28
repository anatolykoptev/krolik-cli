/**
 * @module commands/refactor/analyzers/architecture/namespace
 * @description Namespace structure analyzer for lib/ directory
 *
 * Analyzes project lib/ directory and suggests @namespace organization
 * following Clean Architecture principles:
 * - @core: Foundation layer (auth, config, utilities)
 * - @domain: Business logic (data access, state management)
 * - @integrations: External services (storage, APIs)
 * - @ui: UI utilities (hooks, providers)
 * - @seo: SEO (metadata, structured data)
 * - @utils: Shared utilities
 *
 * Consolidated from commands/refine/analyzer
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { DirectoryInfo, NamespaceCategory } from '../../core';

// ============================================================================
// TYPES (namespace-specific)
// ============================================================================

export interface NamespaceMigrationMove {
  from: string;
  to: string;
  reason: string;
}

export interface NamespaceImportUpdate {
  oldPath: string;
  newPath: string;
}

export interface NamespaceMigrationPlan {
  moves: NamespaceMigrationMove[];
  importUpdates: NamespaceImportUpdate[];
  score: { before: number; after: number };
}

export interface NamespaceAnalysisResult {
  projectRoot: string;
  libDir: string | null;
  directories: DirectoryInfo[];
  currentScore: number;
  suggestedScore: number;
  plan: NamespaceMigrationPlan;
  timestamp: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SKIP_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.turbo',
  'coverage',
  '__tests__',
  '__mocks__',
];

const CATEGORY_PRIORITY: NamespaceCategory[] = [
  'core',
  'domain',
  'integrations',
  'ui',
  'utils',
  'seo',
];

const NAMESPACE_KEYWORDS: Record<NamespaceCategory, string[]> = {
  core: [
    'core',
    'auth',
    'session',
    'user',
    'config',
    'routes',
    'router',
    'trpc',
    'middleware',
    'api',
    'server',
    'client',
    'context',
    'providers',
    'constants',
    'env',
    'i18n',
    'locale',
    'theme',
    'settings',
    'cli',
    'commands',
    'bin',
    'shell',
    'process',
    'logger',
    'log',
    'git',
    'github',
    'vcs',
    'fs',
    'filesystem',
    'io',
  ],
  domain: [
    'domain',
    'booking',
    'event',
    'place',
    'venue',
    'ticket',
    'order',
    'payment',
    'review',
    'rating',
    'customer',
    'crm',
    'calendar',
    'schedule',
    'business',
    'admin',
    'dashboard',
    'panel',
    'notification',
    'dal',
    'stores',
    'state',
    'data',
    'analysis',
    'analyzer',
    'checker',
    'linter',
    'quality',
    'metrics',
  ],
  integrations: [
    'integrations',
    'integration',
    'storage',
    'upload',
    'email',
    'sms',
    'push',
    'analytics',
    'tracking',
    'stripe',
    'yookassa',
    'paypal',
    'twilio',
    'sendgrid',
    'firebase',
    's3',
    'cloudinary',
    'maps',
    'google',
    'facebook',
    'oauth',
    'external',
    'mcp',
    'lsp',
    'ai',
    'llm',
    'openai',
    'anthropic',
  ],
  ui: [
    'ui',
    'hooks',
    'components',
    'layout',
    'modal',
    'dialog',
    'form',
    'button',
    'input',
    'table',
    'card',
    'icon',
    'animation',
    'motion',
    'output',
    'printer',
    'terminal',
    'console',
    'chalk',
    'colors',
  ],
  utils: [
    'utils',
    'util',
    'helpers',
    'common',
    'shared',
    'tools',
    'date',
    'string',
    'array',
    'object',
    'validation',
    'sanitize',
    'ast',
    'parser',
    'lexer',
    'tokenizer',
    'transformer',
    'visitor',
    'formatters',
    'format',
    'formatting',
    'text',
    'markdown',
    'discovery',
    'finder',
    'glob',
    'pattern',
    'search',
    'timing',
    'perf',
    'measure',
    'benchmark',
  ],
  seo: [
    'seo',
    'metadata',
    'schema',
    'jsonld',
    'opengraph',
    'sitemap',
    'robots',
    'indexnow',
    'structured-data',
  ],
  unknown: [],
};

export const NAMESPACE_INFO: Record<
  NamespaceCategory,
  {
    description: string;
    layer: string;
    dependsOn: string[];
    usedBy: string[];
  }
> = {
  core: {
    description: 'Foundation layer: auth, config, utilities',
    layer: 'Pure utilities, configuration, authentication',
    dependsOn: [],
    usedBy: ['@domain', '@ui', '@seo', '@integrations'],
  },
  domain: {
    description: 'Business logic: data access, constants, state',
    layer: 'Data access, business rules, state management',
    dependsOn: ['@core'],
    usedBy: ['@ui'],
  },
  integrations: {
    description: 'External services: storage, analytics, APIs',
    layer: 'Third-party API integrations, storage, analytics',
    dependsOn: ['@core'],
    usedBy: ['@domain', 'components'],
  },
  ui: {
    description: 'UI utilities: hooks, providers, client helpers',
    layer: 'React hooks, providers, client-side utilities',
    dependsOn: ['@core', '@domain'],
    usedBy: ['components'],
  },
  utils: {
    description: 'Shared utilities and helpers',
    layer: 'Common utility functions',
    dependsOn: [],
    usedBy: ['@core', '@domain', '@ui'],
  },
  seo: {
    description: 'SEO: metadata, JSON-LD schemas, indexnow',
    layer: 'Metadata generation, structured data',
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

// ============================================================================
// HELPERS
// ============================================================================

function matchesCategory(name: string, category: NamespaceCategory): boolean {
  const keywords = NAMESPACE_KEYWORDS[category] || [];
  return keywords.some((keyword) => name.includes(keyword));
}

function isNamespaced(name: string): boolean {
  return name.startsWith('@');
}

function countTsFiles(dir: string): number {
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

function getSubdirs(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !SKIP_DIRS.includes(e.name))
    .map((e) => e.name);
}

// ============================================================================
// CORE FUNCTIONS
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

/**
 * Detect category from name and subdirectories
 */
export function detectNamespaceCategory(name: string, subdirs: string[]): NamespaceCategory {
  const lowerName = name.toLowerCase().replace(/^@/, '');
  const lowerSubdirs = subdirs.map((s) => s.toLowerCase().replace(/^@/, ''));

  // Priority 1: Exact match
  for (const category of CATEGORY_PRIORITY) {
    if (lowerName === category) {
      return category;
    }
  }

  // Priority 2: Keyword match in name
  for (const category of CATEGORY_PRIORITY) {
    if (matchesCategory(lowerName, category)) {
      return category;
    }
  }

  // Priority 3: Keyword match in subdirs
  for (const category of CATEGORY_PRIORITY) {
    if (lowerSubdirs.some((subdir) => matchesCategory(subdir, category))) {
      return category;
    }
  }

  return 'unknown';
}

/**
 * Analyze a single directory
 */
export function analyzeNamespaceDirectory(dir: string, libDir: string): DirectoryInfo {
  const name = path.basename(dir);
  const subdirs = getSubdirs(dir);
  const fileCount = countTsFiles(dir);
  const namespaced = isNamespaced(name);
  const category = detectNamespaceCategory(name, subdirs);

  const result: DirectoryInfo = {
    name,
    path: path.relative(libDir, dir),
    fileCount,
    subdirs,
    category,
    isNamespaced: namespaced,
  };

  // Only add suggestedNamespace when it has a value (exactOptionalPropertyTypes)
  if (!namespaced && category !== 'unknown') {
    result.suggestedNamespace = `@${category}/@${name}`;
  }

  return result;
}

/**
 * Calculate namespace organization score
 */
export function calculateNamespaceScore(directories: DirectoryInfo[]): number {
  if (directories.length === 0) return 100;
  const namespacedCount = directories.filter((d) => d.isNamespaced).length;
  return Math.round((namespacedCount / directories.length) * 100);
}

/**
 * Generate migration plan for namespace organization
 */
export function generateNamespaceMigrationPlan(
  directories: DirectoryInfo[],
): NamespaceMigrationPlan {
  const moves: NamespaceMigrationMove[] = [];
  const importUpdates: NamespaceImportUpdate[] = [];

  const byCategory = new Map<NamespaceCategory, DirectoryInfo[]>();

  for (const dir of directories) {
    if (dir.isNamespaced) continue;
    if (dir.category === 'unknown') continue;

    if (!byCategory.has(dir.category)) {
      byCategory.set(dir.category, []);
    }
    byCategory.get(dir.category)?.push(dir);
  }

  for (const [category, dirs] of byCategory) {
    for (const dir of dirs) {
      const targetPath = `@${category}/@${dir.name}`;

      moves.push({
        from: dir.path,
        to: targetPath,
        reason: `Matches ${category} keywords`,
      });

      importUpdates.push({
        oldPath: `@/lib/${dir.name}`,
        newPath: `@/lib/@${category}/@${dir.name}`,
      });
    }
  }

  const namespacedBefore = directories.filter((d) => d.isNamespaced).length;
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

/**
 * Analyze lib/ structure for namespace organization
 */
export function analyzeNamespaceStructure(
  projectRoot: string,
  libPath?: string,
): NamespaceAnalysisResult {
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

  const entries = fs
    .readdirSync(libDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !SKIP_DIRS.includes(e.name));

  const directories = entries.map((e) =>
    analyzeNamespaceDirectory(path.join(libDir, e.name), libDir),
  );

  const currentScore = calculateNamespaceScore(directories);
  const plan = generateNamespaceMigrationPlan(directories);

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
