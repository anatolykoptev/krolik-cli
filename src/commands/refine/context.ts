/**
 * @module commands/refine/context
 * @description Project context detection for AI understanding
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  ProjectContext,
  ProjectType,
  TechStack,
  EntryPoints,
  AiNavigation,
} from './types';

// ============================================================================
// PROJECT TYPE DETECTION
// ============================================================================

/**
 * Detect project type from file structure and package.json
 */
export function detectProjectType(projectRoot: string): ProjectType {
  const pkg = readPackageJson(projectRoot);

  // Check for CLI indicators
  if (pkg?.bin || hasFile(projectRoot, 'src/bin') || hasFile(projectRoot, 'bin')) {
    return 'cli';
  }

  // Check for monorepo
  if (hasFile(projectRoot, 'pnpm-workspace.yaml') ||
      hasFile(projectRoot, 'lerna.json') ||
      hasFile(projectRoot, 'packages') ||
      hasFile(projectRoot, 'apps')) {
    return 'monorepo';
  }

  // Check for mobile (React Native / Expo)
  if (pkg?.dependencies?.['react-native'] || pkg?.dependencies?.['expo']) {
    return 'mobile';
  }

  // Check for web app
  if (pkg?.dependencies?.next || hasFile(projectRoot, 'next.config')) {
    return 'web-app';
  }

  // Check for API
  if (pkg?.dependencies?.express ||
      pkg?.dependencies?.fastify ||
      pkg?.dependencies?.koa ||
      pkg?.dependencies?.hono) {
    return 'api';
  }

  // Check for library (has main/exports but no app structure)
  if (pkg?.main || pkg?.exports) {
    return 'library';
  }

  return 'unknown';
}

// ============================================================================
// TECH STACK DETECTION
// ============================================================================

/**
 * Detect technology stack from package.json
 */
export function detectTechStack(projectRoot: string): TechStack {
  const pkg = readPackageJson(projectRoot);
  const deps = { ...pkg?.dependencies, ...pkg?.devDependencies };

  return {
    framework: detectFramework(deps),
    runtime: detectRuntime(projectRoot),
    language: hasFile(projectRoot, 'tsconfig.json') ? 'typescript' : 'javascript',
    ui: detectUI(deps),
    stateManagement: detectStateManagement(deps),
    database: detectDatabase(deps),
    testing: detectTesting(deps),
    styling: detectStyling(deps),
  };
}

function detectFramework(deps: Record<string, string>): string | null {
  if (deps.next) return 'next';
  if (deps.express) return 'express';
  if (deps.fastify) return 'fastify';
  if (deps.hono) return 'hono';
  if (deps.koa) return 'koa';
  if (deps.nestjs || deps['@nestjs/core']) return 'nestjs';
  if (deps.remix || deps['@remix-run/node']) return 'remix';
  if (deps.nuxt) return 'nuxt';
  if (deps.svelte || deps['@sveltejs/kit']) return 'sveltekit';
  return null;
}

function detectRuntime(projectRoot: string): string {
  if (hasFile(projectRoot, 'bun.lockb')) return 'bun';
  if (hasFile(projectRoot, 'deno.json') || hasFile(projectRoot, 'deno.jsonc')) return 'deno';
  return 'node';
}

function detectUI(deps: Record<string, string>): string | null {
  if (deps.react) return 'react';
  if (deps.vue) return 'vue';
  if (deps.svelte) return 'svelte';
  if (deps.solid || deps['solid-js']) return 'solid';
  if (deps.preact) return 'preact';
  return null;
}

function detectStateManagement(deps: Record<string, string>): string[] {
  const found: string[] = [];
  if (deps.zustand) found.push('zustand');
  if (deps.redux || deps['@reduxjs/toolkit']) found.push('redux');
  if (deps.jotai) found.push('jotai');
  if (deps.recoil) found.push('recoil');
  if (deps.mobx) found.push('mobx');
  if (deps.valtio) found.push('valtio');
  if (deps['@tanstack/react-query']) found.push('react-query');
  return found;
}

function detectDatabase(deps: Record<string, string>): string[] {
  const found: string[] = [];
  if (deps.prisma || deps['@prisma/client']) found.push('prisma');
  if (deps.drizzle || deps['drizzle-orm']) found.push('drizzle');
  if (deps.mongoose) found.push('mongoose');
  if (deps.typeorm) found.push('typeorm');
  if (deps.sequelize) found.push('sequelize');
  if (deps.knex) found.push('knex');
  if (deps['@supabase/supabase-js']) found.push('supabase');
  return found;
}

function detectTesting(deps: Record<string, string>): string[] {
  const found: string[] = [];
  if (deps.vitest) found.push('vitest');
  if (deps.jest) found.push('jest');
  if (deps.playwright || deps['@playwright/test']) found.push('playwright');
  if (deps.cypress) found.push('cypress');
  if (deps['@testing-library/react']) found.push('testing-library');
  return found;
}

function detectStyling(deps: Record<string, string>): string[] {
  const found: string[] = [];
  if (deps.tailwindcss) found.push('tailwind');
  if (deps['styled-components']) found.push('styled-components');
  if (deps['@emotion/react']) found.push('emotion');
  if (deps.sass) found.push('sass');
  if (deps['@vanilla-extract/css']) found.push('vanilla-extract');
  return found;
}

// ============================================================================
// ENTRY POINTS DETECTION
// ============================================================================

/**
 * Detect project entry points
 */
export function detectEntryPoints(projectRoot: string): EntryPoints {
  const pkg = readPackageJson(projectRoot);

  return {
    main: detectMainEntry(projectRoot, pkg),
    apiRoutes: detectApiRoutes(projectRoot),
    pages: detectPages(projectRoot),
    components: detectComponents(projectRoot),
    configs: detectConfigs(projectRoot),
    tests: detectTests(projectRoot),
  };
}

function detectMainEntry(projectRoot: string, pkg: PackageJson | null): string | null {
  // Check package.json main
  if (pkg?.main) return pkg.main;

  // Common entry points
  const candidates = [
    'src/index.ts', 'src/index.tsx',
    'src/main.ts', 'src/main.tsx',
    'src/bin/cli.ts',
    'index.ts', 'index.tsx',
    'app/page.tsx', 'pages/index.tsx',
  ];

  for (const candidate of candidates) {
    if (hasFile(projectRoot, candidate)) {
      return candidate;
    }
  }

  return null;
}

function detectApiRoutes(projectRoot: string): string | null {
  const candidates = [
    'src/app/api',
    'app/api',
    'pages/api',
    'src/routes',
    'src/api',
  ];

  for (const candidate of candidates) {
    if (hasDir(projectRoot, candidate)) {
      return candidate;
    }
  }

  return null;
}

function detectPages(projectRoot: string): string | null {
  const candidates = [
    'src/app',
    'app',
    'src/pages',
    'pages',
  ];

  for (const candidate of candidates) {
    if (hasDir(projectRoot, candidate)) {
      return candidate;
    }
  }

  return null;
}

function detectComponents(projectRoot: string): string | null {
  const candidates = [
    'src/components',
    'components',
    'src/ui',
    'app/components',
  ];

  for (const candidate of candidates) {
    if (hasDir(projectRoot, candidate)) {
      return candidate;
    }
  }

  return null;
}

function detectConfigs(projectRoot: string): string[] {
  const configs: string[] = [];
  const configFiles = [
    'tsconfig.json', 'next.config.js', 'next.config.ts', 'next.config.mjs',
    'tailwind.config.js', 'tailwind.config.ts',
    'vite.config.ts', 'vitest.config.ts',
    'eslint.config.js', '.eslintrc.js', '.eslintrc.json',
    'prettier.config.js', '.prettierrc',
    'biome.json', 'biome.jsonc',
    'package.json',
  ];

  for (const file of configFiles) {
    if (hasFile(projectRoot, file)) {
      configs.push(file);
    }
  }

  return configs;
}

function detectTests(projectRoot: string): string[] {
  const tests: string[] = [];
  const testDirs = [
    'tests', '__tests__', 'test',
    'src/__tests__', 'src/tests',
    'e2e', 'cypress', 'playwright',
  ];

  for (const dir of testDirs) {
    if (hasDir(projectRoot, dir)) {
      tests.push(dir);
    }
  }

  return tests;
}

// ============================================================================
// IMPORT ALIAS DETECTION
// ============================================================================

/**
 * Detect import alias from tsconfig
 */
export function detectImportAlias(projectRoot: string): string | null {
  try {
    const tsconfigPath = path.join(projectRoot, 'tsconfig.json');
    if (!fs.existsSync(tsconfigPath)) return null;

    const content = fs.readFileSync(tsconfigPath, 'utf-8');
    // Simple regex to find paths
    const pathsMatch = content.match(/"paths"\s*:\s*\{([^}]+)\}/);
    if (!pathsMatch) return null;

    // Look for @/* or ~/*
    if (pathsMatch[1].includes('"@/*"')) return '@';
    if (pathsMatch[1].includes('"~/*"')) return '~';
    if (pathsMatch[1].includes('"#/*"')) return '#';

    return null;
  } catch {
    return null;
  }
}

// ============================================================================
// AI NAVIGATION GENERATION
// ============================================================================

/**
 * Generate AI navigation hints based on project analysis
 */
export function generateAiNavigation(
  projectRoot: string,
  context: ProjectContext,
  libDir: string | null,
): AiNavigation {
  const alias = context.importAlias ? `${context.importAlias}/` : './';

  return {
    addNewCode: generateAddNewCodeHints(context, libDir, alias),
    filePatterns: generateFilePatterns(context),
    importConventions: {
      absoluteImports: context.importAlias !== null,
      alias: context.importAlias,
      barrelExports: hasFile(projectRoot, 'src/index.ts') || hasFile(projectRoot, libDir + '/index.ts'),
      preferredOrder: [
        'react/next imports',
        'external packages',
        'absolute imports (@/...)',
        'relative imports (./...)',
        'type imports',
      ],
    },
    namingConventions: detectNamingConventions(context),
  };
}

function generateAddNewCodeHints(
  context: ProjectContext,
  libDir: string | null,
  alias: string,
): AiNavigation['addNewCode'] {
  const lib = libDir ? path.basename(libDir) : 'lib';

  if (context.type === 'cli') {
    return {
      serverLogic: `src/commands/<command-name>/`,
      clientHook: 'N/A (CLI project)',
      utility: `src/${lib}/<category>/`,
      constant: `src/${lib}/constants/`,
      integration: `src/${lib}/integrations/`,
      component: 'N/A (CLI project)',
      apiRoute: 'N/A (CLI project)',
      test: 'tests/ or src/__tests__/',
    };
  }

  if (context.type === 'web-app') {
    return {
      serverLogic: `${lib}/@core/ or ${lib}/@domain/`,
      clientHook: `${lib}/@ui/hooks/`,
      utility: `${lib}/@utils/`,
      constant: `${lib}/@domain/constants/`,
      integration: `${lib}/@integrations/`,
      component: `${context.entryPoints.components || 'components'}/`,
      apiRoute: `${context.entryPoints.apiRoutes || 'app/api'}/`,
      test: '__tests__/ next to the file',
    };
  }

  return {
    serverLogic: 'src/',
    clientHook: 'src/hooks/',
    utility: 'src/utils/',
    constant: 'src/constants/',
    integration: 'src/integrations/',
    component: 'src/components/',
    apiRoute: 'src/api/',
    test: 'tests/',
  };
}

function generateFilePatterns(context: ProjectContext): AiNavigation['filePatterns'] {
  const patterns: AiNavigation['filePatterns'] = [
    { pattern: '*.tsx', meaning: 'React component', example: 'Button.tsx' },
    { pattern: '*.ts', meaning: 'TypeScript module', example: 'utils.ts' },
    { pattern: 'index.ts', meaning: 'Barrel export file', example: 'components/index.ts' },
    { pattern: '*.test.ts', meaning: 'Unit test file', example: 'Button.test.tsx' },
    { pattern: '*.spec.ts', meaning: 'Integration test', example: 'api.spec.ts' },
  ];

  if (context.type === 'web-app' && context.techStack.framework === 'next') {
    patterns.push(
      { pattern: 'page.tsx', meaning: 'Next.js page component', example: 'app/about/page.tsx' },
      { pattern: 'layout.tsx', meaning: 'Next.js layout wrapper', example: 'app/layout.tsx' },
      { pattern: 'route.ts', meaning: 'Next.js API route', example: 'app/api/users/route.ts' },
      { pattern: 'loading.tsx', meaning: 'Loading UI', example: 'app/loading.tsx' },
      { pattern: 'error.tsx', meaning: 'Error boundary', example: 'app/error.tsx' },
    );
  }

  if (context.type === 'cli') {
    patterns.push(
      { pattern: 'cli.ts', meaning: 'CLI entry point', example: 'src/bin/cli.ts' },
      { pattern: 'commands/*.ts', meaning: 'CLI command', example: 'commands/status.ts' },
    );
  }

  return patterns;
}

function detectNamingConventions(context: ProjectContext): AiNavigation['namingConventions'] {
  // Default conventions based on project type
  if (context.type === 'web-app') {
    return {
      files: 'kebab-case for utilities, PascalCase for components',
      components: 'PascalCase (Button, UserCard)',
      hooks: 'camelCase with use prefix (useAuth, useForm)',
      utilities: 'camelCase (formatDate, parseQuery)',
      constants: 'SCREAMING_SNAKE_CASE (API_URL, MAX_RETRIES)',
      types: 'PascalCase (User, ApiResponse)',
    };
  }

  return {
    files: 'kebab-case (my-module.ts)',
    components: 'PascalCase',
    hooks: 'camelCase with use prefix',
    utilities: 'camelCase',
    constants: 'SCREAMING_SNAKE_CASE',
    types: 'PascalCase',
  };
}

// ============================================================================
// FULL CONTEXT DETECTION
// ============================================================================

/**
 * Detect full project context
 */
export function detectProjectContext(projectRoot: string): ProjectContext {
  const pkg = readPackageJson(projectRoot);

  return {
    type: detectProjectType(projectRoot),
    name: pkg?.name || path.basename(projectRoot),
    techStack: detectTechStack(projectRoot),
    entryPoints: detectEntryPoints(projectRoot),
    importAlias: detectImportAlias(projectRoot),
    srcDir: detectSrcDir(projectRoot),
  };
}

function detectSrcDir(projectRoot: string): string | null {
  if (hasDir(projectRoot, 'src')) return 'src';
  if (hasDir(projectRoot, 'app')) return 'app';
  if (hasDir(projectRoot, 'lib')) return 'lib';
  return null;
}

// ============================================================================
// HELPERS
// ============================================================================

interface PackageJson {
  name?: string;
  main?: string;
  bin?: unknown;
  exports?: unknown;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function readPackageJson(projectRoot: string): PackageJson | null {
  try {
    const pkgPath = path.join(projectRoot, 'package.json');
    if (!fs.existsSync(pkgPath)) return null;
    return JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  } catch {
    return null;
  }
}

function hasFile(projectRoot: string, filePath: string): boolean {
  // Handle glob-like patterns
  if (filePath.includes('*')) return false;

  const fullPath = path.join(projectRoot, filePath);
  try {
    return fs.existsSync(fullPath) && fs.statSync(fullPath).isFile();
  } catch {
    return false;
  }
}

function hasDir(projectRoot: string, dirPath: string): boolean {
  const fullPath = path.join(projectRoot, dirPath);
  try {
    return fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory();
  } catch {
    return false;
  }
}
