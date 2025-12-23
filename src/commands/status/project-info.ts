/**
 * @module commands/status/project-info
 * @description Project information detection utilities
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { tryExec } from '../../lib/shell';

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

export function detectTechStack(cwd: string): TechStack {
  const pkgPath = path.join(cwd, 'package.json');
  let deps: Record<string, string> = {};
  let devDeps: Record<string, string> = {};

  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      deps = pkg.dependencies || {};
      devDeps = pkg.devDependencies || {};
    } catch {
      // Ignore
    }
  }

  const allDeps = { ...deps, ...devDeps };
  const hasDep = (name: string) => name in allDeps;

  // Framework detection
  let framework: string | null = null;
  if (hasDep('next')) framework = 'Next.js';
  else if (hasDep('nuxt')) framework = 'Nuxt';
  else if (hasDep('@remix-run/react')) framework = 'Remix';
  else if (hasDep('astro')) framework = 'Astro';
  else if (hasDep('gatsby')) framework = 'Gatsby';
  else if (hasDep('express')) framework = 'Express';
  else if (hasDep('fastify')) framework = 'Fastify';
  else if (hasDep('hono')) framework = 'Hono';
  else if (hasDep('react')) framework = 'React';
  else if (hasDep('vue')) framework = 'Vue';
  else if (hasDep('svelte')) framework = 'Svelte';

  // Language
  const language = hasDep('typescript') || fs.existsSync(path.join(cwd, 'tsconfig.json'))
    ? 'typescript'
    : 'javascript';

  // UI libraries
  const ui: string[] = [];
  if (hasDep('tailwindcss')) ui.push('Tailwind');
  if (hasDep('@radix-ui/react-dialog') || hasDep('@radix-ui/themes')) ui.push('Radix');
  if (hasDep('@shadcn/ui') || fs.existsSync(path.join(cwd, 'components.json'))) ui.push('shadcn/ui');
  if (hasDep('@chakra-ui/react')) ui.push('Chakra');
  if (hasDep('@mui/material')) ui.push('MUI');
  if (hasDep('antd')) ui.push('Ant Design');
  if (hasDep('framer-motion')) ui.push('Framer Motion');

  // Database
  const database: string[] = [];
  if (hasDep('prisma') || hasDep('@prisma/client')) database.push('Prisma');
  if (hasDep('drizzle-orm')) database.push('Drizzle');
  if (hasDep('mongoose')) database.push('MongoDB');
  if (hasDep('pg') || hasDep('postgres')) database.push('PostgreSQL');
  if (hasDep('mysql2')) database.push('MySQL');
  if (hasDep('redis') || hasDep('ioredis')) database.push('Redis');

  // API
  const api: string[] = [];
  if (hasDep('@trpc/server') || hasDep('@trpc/client')) api.push('tRPC');
  if (hasDep('graphql')) api.push('GraphQL');
  if (hasDep('@tanstack/react-query')) api.push('React Query');
  if (hasDep('swr')) api.push('SWR');
  if (hasDep('axios')) api.push('Axios');
  if (hasDep('zod')) api.push('Zod');

  // Testing
  const testing: string[] = [];
  if (hasDep('vitest')) testing.push('Vitest');
  if (hasDep('jest')) testing.push('Jest');
  if (hasDep('@playwright/test')) testing.push('Playwright');
  if (hasDep('cypress')) testing.push('Cypress');
  if (hasDep('@testing-library/react')) testing.push('Testing Library');

  // Bundler
  let bundler: string | null = null;
  if (hasDep('vite')) bundler = 'Vite';
  else if (hasDep('webpack')) bundler = 'Webpack';
  else if (hasDep('esbuild')) bundler = 'esbuild';
  else if (hasDep('tsup')) bundler = 'tsup';
  else if (hasDep('rollup')) bundler = 'Rollup';
  else if (hasDep('turbopack') || hasDep('turbo')) bundler = 'Turbopack';

  // Package manager
  let packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun' = 'npm';
  if (fs.existsSync(path.join(cwd, 'pnpm-lock.yaml'))) packageManager = 'pnpm';
  else if (fs.existsSync(path.join(cwd, 'yarn.lock'))) packageManager = 'yarn';
  else if (fs.existsSync(path.join(cwd, 'bun.lockb'))) packageManager = 'bun';

  return {
    framework,
    language,
    ui,
    database,
    api,
    testing,
    bundler,
    packageManager,
  };
}

// ============================================================================
// RECENT COMMITS
// ============================================================================

export function getRecentCommits(cwd: string, count = 5): RecentCommit[] {
  const result = tryExec(
    `git log -${count} --pretty=format:"%h|%s|%an|%ai|%ar" 2>/dev/null`,
    { cwd, silent: true },
  );

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

  if (fast) {
    // Quick count using find
    const srcResult = tryExec(
      'find . -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \\) ! -path "*/node_modules/*" ! -path "*/.next/*" ! -path "*/dist/*" 2>/dev/null | wc -l',
      { cwd, silent: true },
    );
    const testResult = tryExec(
      'find . -type f \\( -name "*.test.ts" -o -name "*.test.tsx" -o -name "*.spec.ts" -o -name "*.spec.tsx" \\) ! -path "*/node_modules/*" 2>/dev/null | wc -l',
      { cwd, silent: true },
    );
    const configResult = tryExec(
      'find . -maxdepth 2 -type f \\( -name "*.config.*" -o -name ".env*" -o -name "tsconfig*.json" \\) 2>/dev/null | wc -l',
      { cwd, silent: true },
    );

    return {
      totalFiles: 0,
      sourceFiles: Number.parseInt(srcResult.output?.trim() || '0', 10),
      testFiles: Number.parseInt(testResult.output?.trim() || '0', 10),
      configFiles: Number.parseInt(configResult.output?.trim() || '0', 10),
      linesOfCode: 0,
    };
  }

  // Full count with LOC (slower)
  const locResult = tryExec(
    'find . -type f \\( -name "*.ts" -o -name "*.tsx" \\) ! -path "*/node_modules/*" ! -path "*/.next/*" ! -path "*/dist/*" -exec wc -l {} + 2>/dev/null | tail -1',
    { cwd, silent: true },
  );

  const loc = Number.parseInt(locResult.output?.split(/\s+/)[0] || '0', 10);

  return {
    ...defaultStats,
    linesOfCode: loc,
  };
}

// ============================================================================
// MONOREPO WORKSPACES
// ============================================================================

export function getWorkspaces(cwd: string): Workspace[] {
  const workspaces: Workspace[] = [];

  // Try pnpm-workspace.yaml first
  const pnpmWorkspacePath = path.join(cwd, 'pnpm-workspace.yaml');
  if (fs.existsSync(pnpmWorkspacePath)) {
    try {
      const content = fs.readFileSync(pnpmWorkspacePath, 'utf-8');
      const patterns = content.match(/packages:\s*\n((?:\s+-\s+.+\n?)+)/)?.[1];
      if (patterns) {
        const dirs = patterns
          .split('\n')
          .map((line) => line.replace(/^\s*-\s*['"]?/, '').replace(/['"]?\s*$/, ''))
          .filter(Boolean)
          .flatMap((pattern) => {
            // Expand glob patterns like "apps/*"
            const baseDir = pattern.replace(/\/\*$/, '');
            const fullPath = path.join(cwd, baseDir);
            if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
              if (pattern.endsWith('/*')) {
                return fs.readdirSync(fullPath)
                  .filter((name) => {
                    const itemPath = path.join(fullPath, name);
                    return fs.statSync(itemPath).isDirectory() &&
                           fs.existsSync(path.join(itemPath, 'package.json'));
                  })
                  .map((name) => path.join(baseDir, name));
              }
              return [baseDir];
            }
            return [];
          });

        for (const dir of dirs) {
          const pkgPath = path.join(cwd, dir, 'package.json');
          if (fs.existsSync(pkgPath)) {
            try {
              const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
              const type = dir.startsWith('apps/') ? 'app'
                : dir.startsWith('packages/') ? 'package'
                : dir.startsWith('config/') || dir.startsWith('tooling/') ? 'config'
                : 'unknown';
              workspaces.push({
                name: pkg.name || path.basename(dir),
                path: dir,
                type,
              });
            } catch {
              // Skip invalid package.json
            }
          }
        }
      }
    } catch {
      // Ignore errors
    }
  }

  // Try package.json workspaces (npm/yarn)
  if (workspaces.length === 0) {
    const pkgPath = path.join(cwd, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        const workspacePatterns = pkg.workspaces || [];
        for (const pattern of workspacePatterns) {
          const baseDir = pattern.replace(/\/\*$/, '');
          const fullPath = path.join(cwd, baseDir);
          if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
            const dirs = pattern.endsWith('/*')
              ? fs.readdirSync(fullPath).map((name) => path.join(baseDir, name))
              : [baseDir];
            for (const dir of dirs) {
              const wsPkgPath = path.join(cwd, dir, 'package.json');
              if (fs.existsSync(wsPkgPath)) {
                try {
                  const wsPkg = JSON.parse(fs.readFileSync(wsPkgPath, 'utf-8'));
                  workspaces.push({
                    name: wsPkg.name || path.basename(dir),
                    path: dir,
                    type: dir.startsWith('apps/') ? 'app' : 'package',
                  });
                } catch {
                  // Skip
                }
              }
            }
          }
        }
      } catch {
        // Ignore
      }
    }
  }

  return workspaces;
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
  const issueMatch = branchName.match(/[#\-\/](\d{1,5})(?:[-\/]|$)/);
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
