/**
 * @module commands/status/project-info
 * @description Project information detection utilities
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { tryExec } from '../../lib';
import { walkSync } from '../../lib/core/fs';

// ============================================================================
// TYPES
// ============================================================================

export interface PackageInfo {
  name: string;
  version: string;
  private: boolean;
  depsCount: number;
  devDepsCount: number;
  scripts: string[];
}

export interface TechStack {
  framework: string | null;
  language: 'typescript' | 'javascript';
  ui: string[];
  database: string[];
  api: string[];
  testing: string[];
  bundler: string | null;
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun';
}

export interface RecentCommit {
  hash: string;
  message: string;
  author: string;
  date: string;
  relativeDate: string;
}

export interface FileStats {
  totalFiles: number;
  sourceFiles: number;
  testFiles: number;
  configFiles: number;
  linesOfCode: number;
}

export interface Workspace {
  name: string;
  path: string;
  type: 'app' | 'package' | 'config' | 'unknown';
}

export interface AIRulesFile {
  path: string;
  relativePath: string;
  scope: 'root' | 'package' | 'app';
}

export interface BranchContext {
  name: string;
  type: 'feature' | 'fix' | 'chore' | 'release' | 'hotfix' | 'main' | 'develop' | 'unknown';
  issueNumber?: number;
  description?: string;
}

export interface ProjectInfo {
  package: PackageInfo;
  techStack: TechStack;
  recentCommits: RecentCommit[];
  fileStats: FileStats;
  workspaces: Workspace[];
  aiRules: AIRulesFile[];
  branchContext: BranchContext;
}

// ============================================================================
// PACKAGE INFO
// ============================================================================

export function getPackageInfo(cwd: string): PackageInfo | null {
  const pkgPath = path.join(cwd, 'package.json');
  if (!fs.existsSync(pkgPath)) return null;

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const deps = pkg.dependencies || {};
    const devDeps = pkg.devDependencies || {};
    const scripts = Object.keys(pkg.scripts || {});

    return {
      name: pkg.name || 'unknown',
      version: pkg.version || '0.0.0',
      private: !!pkg.private,
      depsCount: Object.keys(deps).length,
      devDepsCount: Object.keys(devDeps).length,
      scripts: scripts.slice(0, 10),
    };
  } catch {
    return null;
  }
}

// ============================================================================
// TECH STACK DETECTION
// ============================================================================

// Lookup tables for dependency detection (ordered by priority)
const FRAMEWORK_DEPS: Array<[string, string]> = [
  ['next', 'Next.js'],
  ['nuxt', 'Nuxt'],
  ['@remix-run/react', 'Remix'],
  ['astro', 'Astro'],
  ['gatsby', 'Gatsby'],
  ['express', 'Express'],
  ['fastify', 'Fastify'],
  ['hono', 'Hono'],
  ['react', 'React'],
  ['vue', 'Vue'],
  ['svelte', 'Svelte'],
];

const BUNDLER_DEPS: Array<[string, string]> = [
  ['vite', 'Vite'],
  ['webpack', 'Webpack'],
  ['esbuild', 'esbuild'],
  ['tsup', 'tsup'],
  ['rollup', 'Rollup'],
  ['turbopack', 'Turbopack'],
  ['turbo', 'Turbopack'],
];

// Multi-match deps: [deps[], label] — matches if ANY dep exists
const UI_DEPS: Array<[string[], string]> = [
  [['tailwindcss'], 'Tailwind'],
  [['@radix-ui/react-dialog', '@radix-ui/themes'], 'Radix'],
  [['@shadcn/ui'], 'shadcn/ui'],
  [['@chakra-ui/react'], 'Chakra'],
  [['@mui/material'], 'MUI'],
  [['antd'], 'Ant Design'],
  [['framer-motion'], 'Framer Motion'],
];

const DATABASE_DEPS: Array<[string[], string]> = [
  [['prisma', '@prisma/client'], 'Prisma'],
  [['drizzle-orm'], 'Drizzle'],
  [['mongoose'], 'MongoDB'],
  [['pg', 'postgres'], 'PostgreSQL'],
  [['mysql2'], 'MySQL'],
  [['redis', 'ioredis'], 'Redis'],
];

const API_DEPS: Array<[string[], string]> = [
  [['@trpc/server', '@trpc/client'], 'tRPC'],
  [['graphql'], 'GraphQL'],
  [['@tanstack/react-query'], 'React Query'],
  [['swr'], 'SWR'],
  [['axios'], 'Axios'],
  [['zod'], 'Zod'],
];

const TESTING_DEPS: Array<[string[], string]> = [
  [['vitest'], 'Vitest'],
  [['jest'], 'Jest'],
  [['@playwright/test'], 'Playwright'],
  [['cypress'], 'Cypress'],
  [['@testing-library/react'], 'Testing Library'],
];

const LOCKFILE_MAP: Array<[string, TechStack['packageManager']]> = [
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['bun.lockb', 'bun'],
];

/**
 * Load dependencies from package.json
 */
function loadDependencies(cwd: string): Set<string> {
  const pkgPath = path.join(cwd, 'package.json');
  if (!fs.existsSync(pkgPath)) return new Set();

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const deps = pkg.dependencies || {};
    const devDeps = pkg.devDependencies || {};
    return new Set([...Object.keys(deps), ...Object.keys(devDeps)]);
  } catch {
    return new Set();
  }
}

/**
 * Find first matching dependency from lookup table
 */
function findFirstMatch(deps: Set<string>, table: Array<[string, string]>): string | null {
  for (const [dep, label] of table) {
    if (deps.has(dep)) return label;
  }
  return null;
}

/**
 * Find all matching dependencies from multi-match table
 */
function findAllMatches(deps: Set<string>, table: Array<[string[], string]>): string[] {
  return table.filter(([depList]) => depList.some((d) => deps.has(d))).map(([, label]) => label);
}

/**
 * Detect package manager by lockfile
 */
function detectPackageManager(cwd: string): TechStack['packageManager'] {
  for (const [lockfile, manager] of LOCKFILE_MAP) {
    if (fs.existsSync(path.join(cwd, lockfile))) return manager;
  }
  return 'npm';
}

/**
 * Detect tech stack from project dependencies
 */
export function detectTechStack(cwd: string): TechStack {
  const deps = loadDependencies(cwd);

  // Check for shadcn/ui by components.json (special case)
  const hasShadcn = fs.existsSync(path.join(cwd, 'components.json'));
  const hasTypeScript = deps.has('typescript') || fs.existsSync(path.join(cwd, 'tsconfig.json'));

  const ui = findAllMatches(deps, UI_DEPS);
  if (hasShadcn && !ui.includes('shadcn/ui')) ui.push('shadcn/ui');

  return {
    framework: findFirstMatch(deps, FRAMEWORK_DEPS),
    language: hasTypeScript ? 'typescript' : 'javascript',
    ui,
    database: findAllMatches(deps, DATABASE_DEPS),
    api: findAllMatches(deps, API_DEPS),
    testing: findAllMatches(deps, TESTING_DEPS),
    bundler: findFirstMatch(deps, BUNDLER_DEPS),
    packageManager: detectPackageManager(cwd),
  };
}

// ============================================================================
// RECENT COMMITS
// ============================================================================

export function getRecentCommits(cwd: string, count = 5): RecentCommit[] {
  const result = tryExec(`git log -${count} --pretty=format:"%h|%s|%an|%ai|%ar" 2>/dev/null`, {
    cwd,
    silent: true,
  });

  if (!result.success || !result.output) return [];

  return result.output
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [hash, message, author, date, relativeDate] = line.split('|');
      return {
        hash: hash || '',
        message: (message || '').slice(0, 60),
        author: author || '',
        date: date || '',
        relativeDate: relativeDate || '',
      };
    });
}

// ============================================================================
// FILE STATS
// ============================================================================

export function getFileStats(cwd: string, fast = true): FileStats {
  const defaultStats: FileStats = {
    totalFiles: 0,
    sourceFiles: 0,
    testFiles: 0,
    configFiles: 0,
    linesOfCode: 0,
  };

  // Use walkSync from @fs/scanner for file counting
  const sourceExtensions = ['.ts', '.tsx', '.js', '.jsx'];
  const testPattern = /\.(test|spec)\.(ts|tsx|js|jsx)$/;
  const configPattern = /\.(config\.[^.]+|env.*|tsconfig.*\.json)$/i;

  if (fast) {
    // Quick count using walkSync
    const sourceFiles = walkSync(cwd, {
      extensions: sourceExtensions,
      exclude: ['node_modules', '.next', 'dist', '.git', '.turbo', 'coverage', 'build'],
    });

    const testFiles = sourceFiles.filter((f) => testPattern.test(path.basename(f)));
    const nonTestSourceFiles = sourceFiles.filter((f) => !testPattern.test(path.basename(f)));

    // Config files (maxDepth: 2)
    const configFiles = walkSync(cwd, {
      maxDepth: 2,
      exclude: ['node_modules', '.next', 'dist', '.git'],
    }).filter((f) => {
      const basename = path.basename(f);
      return (
        configPattern.test(basename) ||
        basename.startsWith('.env') ||
        basename.startsWith('tsconfig')
      );
    });

    return {
      totalFiles: sourceFiles.length,
      sourceFiles: nonTestSourceFiles.length,
      testFiles: testFiles.length,
      configFiles: configFiles.length,
      linesOfCode: 0,
    };
  }

  // Full count with LOC (slower)
  const tsFiles = walkSync(cwd, {
    extensions: ['.ts', '.tsx'],
    exclude: ['node_modules', '.next', 'dist', '.git', '.turbo', 'coverage', 'build'],
  });

  let totalLoc = 0;
  for (const file of tsFiles) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      totalLoc += content.split('\n').length;
    } catch {
      // Skip unreadable files
    }
  }

  return {
    ...defaultStats,
    linesOfCode: totalLoc,
  };
}

// ============================================================================
// MONOREPO WORKSPACES
// ============================================================================

/**
 * Infer workspace type from directory path
 */
function inferWorkspaceType(dir: string): Workspace['type'] {
  if (dir.startsWith('apps/')) return 'app';
  if (dir.startsWith('packages/')) return 'package';
  if (dir.startsWith('config/') || dir.startsWith('tooling/')) return 'config';
  return 'unknown';
}

/**
 * Check if directory contains a valid package
 */
function isValidPackageDir(dirPath: string): boolean {
  if (!fs.existsSync(dirPath)) return false;
  if (!fs.statSync(dirPath).isDirectory()) return false;
  return fs.existsSync(path.join(dirPath, 'package.json'));
}

/**
 * Expand glob pattern (e.g., "apps/*") to actual directories
 */
function expandGlobPattern(cwd: string, pattern: string): string[] {
  const baseDir = pattern.replace(/\/\*$/, '');
  const fullPath = path.join(cwd, baseDir);

  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isDirectory()) {
    return [];
  }

  if (!pattern.endsWith('/*')) {
    return [baseDir];
  }

  return fs
    .readdirSync(fullPath)
    .map((name) => path.join(baseDir, name))
    .filter((dir) => isValidPackageDir(path.join(cwd, dir)));
}

/**
 * Parse workspace directory into Workspace object
 */
function parseWorkspaceDir(cwd: string, dir: string): Workspace | null {
  const pkgPath = path.join(cwd, dir, 'package.json');
  if (!fs.existsSync(pkgPath)) return null;

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return {
      name: pkg.name || path.basename(dir),
      path: dir,
      type: inferWorkspaceType(dir),
    };
  } catch {
    return null;
  }
}

/**
 * Parse pnpm-workspace.yaml for workspace patterns
 */
function parsePnpmWorkspacePatterns(cwd: string): string[] {
  const pnpmWorkspacePath = path.join(cwd, 'pnpm-workspace.yaml');
  if (!fs.existsSync(pnpmWorkspacePath)) return [];

  try {
    const content = fs.readFileSync(pnpmWorkspacePath, 'utf-8');
    const patternsMatch = content.match(/packages:\s*\n((?:\s+-\s+.+\n?)+)/)?.[1];
    if (!patternsMatch) return [];

    return patternsMatch
      .split('\n')
      .map((line) => line.replace(/^\s*-\s*['"]?/, '').replace(/['"]?\s*$/, ''))
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Parse package.json for workspace patterns (npm/yarn)
 */
function parseNpmWorkspacePatterns(cwd: string): string[] {
  const pkgPath = path.join(cwd, 'package.json');
  if (!fs.existsSync(pkgPath)) return [];

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return pkg.workspaces || [];
  } catch {
    return [];
  }
}

/**
 * Detect workspaces in monorepo
 */
export function getWorkspaces(cwd: string): Workspace[] {
  // Try pnpm first, then npm/yarn
  const patterns = parsePnpmWorkspacePatterns(cwd);
  const effectivePatterns = patterns.length > 0 ? patterns : parseNpmWorkspacePatterns(cwd);

  const dirs = effectivePatterns.flatMap((pattern) => expandGlobPattern(cwd, pattern));

  return dirs
    .map((dir) => parseWorkspaceDir(cwd, dir))
    .filter((ws): ws is Workspace => ws !== null);
}

// ============================================================================
// AI RULES FILES (CLAUDE.md, AGENTS.md, etc.)
// ============================================================================

const AI_RULES_FILES = ['CLAUDE.md', 'AGENTS.md', 'AI.md', '.cursorrules', 'CONVENTIONS.md'];

export function getAIRulesFiles(cwd: string): AIRulesFile[] {
  const rules: AIRulesFile[] = [];

  // Check root level
  for (const filename of AI_RULES_FILES) {
    const filePath = path.join(cwd, filename);
    if (fs.existsSync(filePath)) {
      rules.push({
        path: filePath,
        relativePath: filename,
        scope: 'root',
      });
    }
  }

  // Check .claude folder
  const claudeDir = path.join(cwd, '.claude');
  if (fs.existsSync(claudeDir) && fs.statSync(claudeDir).isDirectory()) {
    const files = fs.readdirSync(claudeDir).filter((f) => f.endsWith('.md'));
    for (const file of files) {
      rules.push({
        path: path.join(claudeDir, file),
        relativePath: `.claude/${file}`,
        scope: 'root',
      });
    }
  }

  // Check in apps/ and packages/ subdirectories
  const subDirs = ['apps', 'packages'];
  for (const subDir of subDirs) {
    const dirPath = path.join(cwd, subDir);
    if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
      const items = fs.readdirSync(dirPath);
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        if (fs.statSync(itemPath).isDirectory()) {
          for (const filename of AI_RULES_FILES) {
            const rulesPath = path.join(itemPath, filename);
            if (fs.existsSync(rulesPath)) {
              rules.push({
                path: rulesPath,
                relativePath: `${subDir}/${item}/${filename}`,
                scope: subDir === 'apps' ? 'app' : 'package',
              });
            }
          }
        }
      }
    }
  }

  return rules;
}

// ============================================================================
// BRANCH CONTEXT
// ============================================================================

export function getBranchContext(cwd: string): BranchContext {
  const result = tryExec('git branch --show-current 2>/dev/null', { cwd, silent: true });
  const branchName = result.success ? result.output?.trim() || 'unknown' : 'unknown';

  // Detect branch type
  let type: BranchContext['type'] = 'unknown';
  let issueNumber: number | undefined;
  let description: string | undefined;

  // Common patterns:
  // feature/123-add-booking, feat/new-feature, feature/add-user-auth
  // fix/456-bug-in-login, bugfix/issue-123
  // chore/update-deps, refactor/cleanup
  // release/1.0.0, hotfix/1.0.1

  const patterns: Array<[RegExp, BranchContext['type']]> = [
    [/^(main|master)$/, 'main'],
    [/^(develop|dev|development)$/, 'develop'],
    [/^(feat|feature)\//, 'feature'],
    [/^(fix|bugfix|bug)\//, 'fix'],
    [/^(chore|refactor|ci|docs|style|test)\//, 'chore'],
    [/^release\//, 'release'],
    [/^hotfix\//, 'hotfix'],
  ];

  for (const [pattern, branchType] of patterns) {
    if (pattern.test(branchName)) {
      type = branchType;
      break;
    }
  }

  // Extract issue number (common patterns: #123, -123-, /123-)
  const issueMatch = branchName.match(/[#\-/](\d{1,5})(?:[-/]|$)/);
  if (issueMatch?.[1]) {
    issueNumber = Number.parseInt(issueMatch[1], 10);
  }

  // Extract description (text after prefix and optional issue number)
  const descMatch = branchName.match(/^(?:feat|feature|fix|bugfix|chore|refactor)\/(?:\d+-)?(.+)$/);
  if (descMatch?.[1]) {
    description = descMatch[1].replace(/-/g, ' ').trim();
  }

  return {
    name: branchName,
    type,
    ...(issueNumber ? { issueNumber } : {}),
    ...(description ? { description } : {}),
  };
}

// ============================================================================
// COMBINED PROJECT INFO
// ============================================================================

export function getProjectInfo(cwd: string, fast = true): ProjectInfo | null {
  const pkg = getPackageInfo(cwd);
  if (!pkg) return null;

  return {
    package: pkg,
    techStack: detectTechStack(cwd),
    recentCommits: getRecentCommits(cwd, 3),
    fileStats: getFileStats(cwd, fast),
    workspaces: getWorkspaces(cwd),
    aiRules: getAIRulesFiles(cwd),
    branchContext: getBranchContext(cwd),
  };
}
