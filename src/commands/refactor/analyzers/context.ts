/**
 * @module commands/refactor/analyzers/context
 * @description Project context detection for AI understanding
 *
 * Detects project type, tech stack, entry points, and import conventions.
 */

import * as path from 'node:path';
import { readFile } from '../../../lib';
import type { EntryPoints, ProjectContext, ProjectType, TechStack } from '../core';
import {
  findDir,
  getAllDependencies,
  hasDir,
  hasFile,
  type PackageJson,
  readPackageJson,
} from './helpers';

// ============================================================================
// PROJECT TYPE DETECTION
// ============================================================================

/**
 * Detect project type from package.json and directory structure
 */
export function detectProjectType(projectRoot: string, pkg: PackageJson | null): ProjectType {
  // CLI project
  if (pkg?.bin || hasDir(projectRoot, 'src/bin') || hasDir(projectRoot, 'bin')) {
    return 'cli';
  }

  // Monorepo
  if (
    hasFile(projectRoot, 'pnpm-workspace.yaml') ||
    hasDir(projectRoot, 'packages') ||
    hasDir(projectRoot, 'apps')
  ) {
    return 'monorepo';
  }

  // Mobile app
  if (pkg?.dependencies?.['react-native'] || pkg?.dependencies?.expo) {
    return 'mobile';
  }

  // Web app (Next.js)
  if (pkg?.dependencies?.next) {
    return 'web-app';
  }

  // API server
  if (pkg?.dependencies?.express || pkg?.dependencies?.fastify || pkg?.dependencies?.hono) {
    return 'api';
  }

  // Library
  if (pkg?.main || pkg?.exports) {
    return 'library';
  }

  return 'unknown';
}

// ============================================================================
// TECH STACK DETECTION
// ============================================================================

/**
 * Detect tech stack from dependencies
 */
export function detectTechStack(projectRoot: string, pkg: PackageJson | null): TechStack {
  const deps = getAllDependencies(pkg);

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
  if (deps['@nestjs/core']) return 'nestjs';
  if (deps.nuxt) return 'nuxt';
  if (deps['@remix-run/node']) return 'remix';
  return null;
}

function detectRuntime(projectRoot: string): 'node' | 'bun' | 'deno' {
  if (hasFile(projectRoot, 'bun.lockb')) return 'bun';
  if (hasFile(projectRoot, 'deno.json') || hasFile(projectRoot, 'deno.jsonc')) return 'deno';
  return 'node';
}

function detectUI(deps: Record<string, string>): string | null {
  if (deps.react) return 'react';
  if (deps.vue) return 'vue';
  if (deps.svelte) return 'svelte';
  if (deps.solid) return 'solid';
  if (deps.angular || deps['@angular/core']) return 'angular';
  return null;
}

function detectStateManagement(deps: Record<string, string>): string[] {
  const found: string[] = [];
  if (deps.zustand) found.push('zustand');
  if (deps.redux || deps['@reduxjs/toolkit']) found.push('redux');
  if (deps.jotai) found.push('jotai');
  if (deps.recoil) found.push('recoil');
  if (deps['@tanstack/react-query']) found.push('react-query');
  if (deps.mobx) found.push('mobx');
  return found;
}

function detectDatabase(deps: Record<string, string>): string[] {
  const found: string[] = [];
  if (deps.prisma || deps['@prisma/client']) found.push('prisma');
  if (deps['drizzle-orm']) found.push('drizzle');
  if (deps.mongoose) found.push('mongoose');
  if (deps['@supabase/supabase-js']) found.push('supabase');
  if (deps.pg) found.push('postgres');
  if (deps.mysql2) found.push('mysql');
  if (deps.sqlite3 || deps['better-sqlite3']) found.push('sqlite');
  return found;
}

function detectTesting(deps: Record<string, string>): string[] {
  const found: string[] = [];
  if (deps.vitest) found.push('vitest');
  if (deps.jest) found.push('jest');
  if (deps['@playwright/test']) found.push('playwright');
  if (deps.cypress) found.push('cypress');
  if (deps.mocha) found.push('mocha');
  return found;
}

function detectStyling(deps: Record<string, string>): string[] {
  const found: string[] = [];
  if (deps.tailwindcss) found.push('tailwind');
  if (deps['styled-components']) found.push('styled-components');
  if (deps['@emotion/react']) found.push('emotion');
  if (deps.sass) found.push('sass');
  if (deps['vanilla-extract']) found.push('vanilla-extract');
  return found;
}

// ============================================================================
// ENTRY POINTS DETECTION
// ============================================================================

/**
 * Detect common entry points in the project
 */
export function detectEntryPoints(projectRoot: string): EntryPoints {
  return {
    main: findMainEntry(projectRoot),
    apiRoutes: findDir(projectRoot, ['src/app/api', 'app/api', 'pages/api', 'src/routes']),
    pages: findDir(projectRoot, ['src/app', 'app', 'src/pages', 'pages']),
    components: findDir(projectRoot, ['src/components', 'components', 'src/ui']),
    configs: findConfigs(projectRoot),
    tests: findTestDirs(projectRoot),
  };
}

function findMainEntry(projectRoot: string): string | null {
  const candidates = [
    'src/index.ts',
    'src/main.ts',
    'src/bin/cli.ts',
    'index.ts',
    'src/app.ts',
    'src/server.ts',
  ];
  for (const c of candidates) {
    if (hasFile(projectRoot, c)) return c;
  }
  return null;
}

function findConfigs(projectRoot: string): string[] {
  const configs = [
    'tsconfig.json',
    'package.json',
    'biome.json',
    'eslint.config.js',
    '.eslintrc.js',
    'prettier.config.js',
    'vite.config.ts',
    'next.config.js',
    'next.config.mjs',
  ];
  return configs.filter((c) => hasFile(projectRoot, c));
}

function findTestDirs(projectRoot: string): string[] {
  const testDirs = ['tests', '__tests__', 'test', 'e2e', 'spec'];
  return testDirs.filter((d) => hasDir(projectRoot, d));
}

// ============================================================================
// IMPORT CONVENTIONS
// ============================================================================

/**
 * Detect import alias from tsconfig.json
 */
export function detectImportAlias(projectRoot: string): string | null {
  try {
    const tsconfig = readFile(path.join(projectRoot, 'tsconfig.json'));
    if (!tsconfig) return null;
    if (tsconfig.includes('"@/*"')) return '@';
    if (tsconfig.includes('"~/*"')) return '~';
    if (tsconfig.includes('"#/*"')) return '#';
    return null;
  } catch {
    return null;
  }
}

/**
 * Detect source directory
 */
export function detectSrcDir(projectRoot: string): string | null {
  if (hasDir(projectRoot, 'src')) return 'src';
  if (hasDir(projectRoot, 'app')) return 'app';
  if (hasDir(projectRoot, 'lib')) return 'lib';
  return null;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Detect full project context
 */
export function detectProjectContext(projectRoot: string): ProjectContext {
  const pkg = readPackageJson(projectRoot);

  return {
    type: detectProjectType(projectRoot, pkg),
    name: pkg?.name || path.basename(projectRoot),
    techStack: detectTechStack(projectRoot, pkg),
    entryPoints: detectEntryPoints(projectRoot),
    importAlias: detectImportAlias(projectRoot),
    srcDir: detectSrcDir(projectRoot),
  };
}
