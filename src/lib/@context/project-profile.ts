/**
 * @module lib/@context/project-profile
 * @description Project profile detection for smart agent selection
 *
 * Detects project characteristics:
 * - Tech stack (nextjs, react, prisma, trpc, etc.)
 * - Project type (monorepo vs single)
 * - Language (typescript vs javascript)
 * - Features from krolik_context
 */

import * as path from 'node:path';
import { detectAll, detectMonorepoPackages } from '@/config/detect';
import { exists, readJson } from '@/lib/@core/fs';

/**
 * Project profile for agent selection boosting
 */
export interface ProjectProfile {
  /** Detected tech stack (e.g., ['nextjs', 'react', 'prisma', 'trpc']) */
  techStack: string[];
  /** Project type */
  type: 'monorepo' | 'single';
  /** Detected features/domains (e.g., ['booking', 'auth', 'payments']) */
  features: string[];
  /** Primary language */
  language: 'typescript' | 'javascript';
  /** Project name from package.json */
  name?: string | undefined;
  /** Monorepo packages (if applicable) */
  packages?: string[] | undefined;
}

/**
 * Cache for project profiles (5s TTL)
 */
const profileCache = new Map<string, { profile: ProjectProfile; timestamp: number }>();
const CACHE_TTL_MS = 5000;

/**
 * Detect project profile from project root
 *
 * @param projectRoot - Absolute path to project root
 * @returns Detected project profile
 */
export function detectProjectProfile(projectRoot: string): ProjectProfile {
  // Check cache first
  const cached = profileCache.get(projectRoot);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.profile;
  }

  const detected = detectAll(projectRoot);
  const packages = detectMonorepoPackages(projectRoot);

  const profile: ProjectProfile = {
    techStack: extractTechStack(projectRoot, detected.features),
    type: packages.length > 1 ? 'monorepo' : 'single',
    features: extractFeatures(projectRoot),
    language: detected.features.typescript ? 'typescript' : 'javascript',
    name: detected.name,
    packages: packages.length > 1 ? packages.map((p) => p.name) : undefined,
  };

  // Cache the result
  profileCache.set(projectRoot, { profile, timestamp: Date.now() });

  return profile;
}

/**
 * Extract tech stack from project detection and package.json
 */
function extractTechStack(
  projectRoot: string,
  features: ReturnType<typeof detectAll>['features'],
): string[] {
  const stack: string[] = [];

  // From detection
  stack.push(...getFeaturesFromDetection(features));

  // Additional detection from package.json
  const pkgPath = path.join(projectRoot, 'package.json');
  const pkg = readJson<{
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  }>(pkgPath);

  if (pkg) {
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    stack.push(...getFrameworks(allDeps));
    stack.push(...getDatabases(allDeps));
    stack.push(...getFrontendTools(allDeps));
    stack.push(...getStateManagement(allDeps));
    stack.push(...getTestingTools(allDeps));
    stack.push(...getBuildTools(allDeps));
    stack.push(...getMobileTools(allDeps));
    stack.push(...getAuthTools(allDeps));
    stack.push(...getValidationTools(allDeps));
  }

  return [...new Set(stack)];
}

function getFeaturesFromDetection(features: ReturnType<typeof detectAll>['features']): string[] {
  const stack: string[] = [];
  if (features.nextjs) stack.push('nextjs');
  if (features.react) stack.push('react');
  if (features.prisma) stack.push('prisma');
  if (features.trpc) stack.push('trpc');
  if (features.typescript) stack.push('typescript');
  if (features.monorepo) stack.push('monorepo');
  return stack;
}

function getFrameworks(deps: Record<string, string>): string[] {
  const stack: string[] = [];
  if ('express' in deps) stack.push('express');
  if ('fastify' in deps) stack.push('fastify');
  if ('nestjs' in deps || '@nestjs/core' in deps) stack.push('nestjs');
  if ('hono' in deps) stack.push('hono');
  return stack;
}

function getDatabases(deps: Record<string, string>): string[] {
  const stack: string[] = [];
  if ('drizzle-orm' in deps) stack.push('drizzle');
  if ('typeorm' in deps) stack.push('typeorm');
  if ('mongoose' in deps) stack.push('mongoose');
  if ('pg' in deps || 'postgres' in deps) stack.push('postgres');
  if ('redis' in deps || 'ioredis' in deps) stack.push('redis');
  return stack;
}

function getFrontendTools(deps: Record<string, string>): string[] {
  const stack: string[] = [];
  if ('vue' in deps) stack.push('vue');
  if ('svelte' in deps || '@sveltejs/kit' in deps) stack.push('svelte');
  if ('tailwindcss' in deps) stack.push('tailwind');
  return stack;
}

function getStateManagement(deps: Record<string, string>): string[] {
  const stack: string[] = [];
  if ('zustand' in deps) stack.push('zustand');
  if ('jotai' in deps) stack.push('jotai');
  if ('@tanstack/react-query' in deps) stack.push('react-query');
  return stack;
}

function getTestingTools(deps: Record<string, string>): string[] {
  const stack: string[] = [];
  if ('jest' in deps) stack.push('jest');
  if ('vitest' in deps) stack.push('vitest');
  if ('playwright' in deps || '@playwright/test' in deps) stack.push('playwright');
  return stack;
}

function getBuildTools(deps: Record<string, string>): string[] {
  const stack: string[] = [];
  if ('turbo' in deps || 'turborepo' in deps) stack.push('turborepo');
  if ('vite' in deps) stack.push('vite');
  return stack;
}

function getMobileTools(deps: Record<string, string>): string[] {
  const stack: string[] = [];
  if ('expo' in deps) stack.push('expo');
  if ('react-native' in deps) stack.push('react-native');
  return stack;
}

function getAuthTools(deps: Record<string, string>): string[] {
  const stack: string[] = [];
  if ('next-auth' in deps || '@auth/core' in deps) stack.push('next-auth');
  if ('@clerk/nextjs' in deps) stack.push('clerk');
  return stack;
}

function getValidationTools(deps: Record<string, string>): string[] {
  const stack: string[] = [];
  if ('zod' in deps) stack.push('zod');
  if ('yup' in deps) stack.push('yup');
  return stack;
}

/**
 * Extract features from krolik_context.yaml or similar config files
 */
function extractFeatures(projectRoot: string): string[] {
  const features: string[] = [];

  // Try krolik_context.yaml
  const krolikContextPath = path.join(projectRoot, 'krolik_context.yaml');
  if (exists(krolikContextPath)) {
    // Simple YAML feature extraction (avoiding full YAML parser dependency)
    const content = require('node:fs').readFileSync(krolikContextPath, 'utf-8');
    const featuresMatch = content.match(/features?:\s*\n((?:\s*-\s*.+\n)+)/i);
    if (featuresMatch) {
      const featureLines = featuresMatch[1].split('\n');
      for (const line of featureLines) {
        const match = line.match(/^\s*-\s*(.+)$/);
        if (match) {
          features.push(match[1].trim().toLowerCase());
        }
      }
    }
  }

  // Try to infer features from directory structure
  const srcDirs = [
    path.join(projectRoot, 'apps/web/app'),
    path.join(projectRoot, 'apps/web/src'),
    path.join(projectRoot, 'src/app'),
    path.join(projectRoot, 'app'),
    path.join(projectRoot, 'src'),
  ];

  const featurePatterns = [
    'auth',
    'booking',
    'payment',
    'user',
    'admin',
    'dashboard',
    'profile',
    'settings',
    'notification',
    'chat',
    'message',
    'search',
    'cart',
    'checkout',
    'order',
    'product',
    'catalog',
    'blog',
    'post',
    'comment',
    'review',
    'analytics',
    'report',
    'api',
    'event',
    'calendar',
    'schedule',
    'location',
    'map',
  ];

  for (const srcDir of srcDirs) {
    if (exists(srcDir)) {
      try {
        const entries = require('node:fs').readdirSync(srcDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const dirName = entry.name.toLowerCase();
            for (const pattern of featurePatterns) {
              if (dirName.includes(pattern) && !features.includes(pattern)) {
                features.push(pattern);
              }
            }
          }
        }
      } catch {
        // Ignore read errors
      }
    }
  }

  return features;
}

/**
 * Clear project profile cache
 */
export function clearProfileCache(): void {
  profileCache.clear();
}

/**
 * Get cached profile without detection (for testing)
 */
export function getCachedProfile(projectRoot: string): ProjectProfile | null {
  const cached = profileCache.get(projectRoot);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.profile;
  }
  return null;
}
