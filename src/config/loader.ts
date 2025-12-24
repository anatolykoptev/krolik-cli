/**
 * @module config/loader
 * @description Configuration loading and resolution
 */

import * as path from 'node:path';
import { cosmiconfig } from 'cosmiconfig';
import type { KrolikConfig, ResolvedConfig } from '../types';
import { createDefaultConfig } from './defaults';
import { detectAll } from './detect';

/**
 * Config file names to search for
 */
const CONFIG_MODULE_NAME = 'krolik';

/**
 * Cached config instance
 */
let cachedConfig: ResolvedConfig | null = null;
let cachedProjectRoot: string | null = null;

/**
 * Find project root by looking for package.json
 */
export function findProjectRoot(startDir: string = process.cwd()): string {
  let currentDir = startDir;

  while (currentDir !== path.dirname(currentDir)) {
    const pkgPath = path.join(currentDir, 'package.json');
    try {
      const fs = require('node:fs');
      if (fs.existsSync(pkgPath)) {
        return currentDir;
      }
    } catch {
      // Continue searching
    }
    currentDir = path.dirname(currentDir);
  }

  return startDir;
}

/**
 * Load config from file using cosmiconfig
 */
async function loadConfigFile(projectRoot: string): Promise<KrolikConfig | null> {
  const explorer = cosmiconfig(CONFIG_MODULE_NAME, {
    searchPlaces: [
      'krolik.config.ts',
      'krolik.config.js',
      'krolik.config.mjs',
      'krolik.config.json',
      'krolik.config.yaml',
      'krolik.config.yml',
      'krolik.yaml',
      'krolik.yml',
      '.krolikrc',
      '.krolikrc.json',
      '.krolikrc.yaml',
      '.krolikrc.yml',
      '.krolikrc.js',
      '.krolikrc.ts',
    ],
  });

  try {
    const result = await explorer.search(projectRoot);
    return result?.config ?? null;
  } catch {
    return null;
  }
}

/**
 * Merge user config with defaults and auto-detected values
 */
function resolveConfig(
  userConfig: KrolikConfig | null,
  detected: ReturnType<typeof detectAll>,
  projectRoot: string,
): ResolvedConfig {
  const base = createDefaultConfig(projectRoot);

  // Apply detected values first (can be overridden by user config)
  const resolvedPaths = {
    ...base.paths,
    ...detected.paths,
    ...userConfig?.paths,
  };

  const resolvedFeatures = {
    ...base.features,
    ...detected.features,
    ...userConfig?.features,
  };

  const resolvedPrisma = {
    ...base.prisma,
    ...detected.prisma,
    ...userConfig?.prisma,
  };

  const resolvedTrpc = {
    ...base.trpc,
    ...detected.trpc,
    ...userConfig?.trpc,
  };

  return {
    name: userConfig?.name ?? detected.name ?? base.name,
    projectRoot: userConfig?.projectRoot ?? projectRoot,
    paths: resolvedPaths,
    features: resolvedFeatures,
    prisma: resolvedPrisma,
    trpc: resolvedTrpc,
    templates: { ...base.templates, ...userConfig?.templates },
    exclude: userConfig?.exclude ?? base.exclude,
    extensions: userConfig?.extensions ?? base.extensions,
  };
}

/**
 * Load and resolve configuration
 */
export async function loadConfig(
  options: { configPath?: string; projectRoot?: string; noCache?: boolean } = {},
): Promise<ResolvedConfig> {
  const { projectRoot: explicitRoot, noCache = false } = options;

  // Use cached config if available
  const projectRoot = explicitRoot ?? findProjectRoot();
  if (!noCache && cachedConfig && cachedProjectRoot === projectRoot) {
    return cachedConfig;
  }

  // Load user config file
  const userConfig = await loadConfigFile(projectRoot);

  // Auto-detect project features
  const detected = detectAll(projectRoot);

  // Resolve final config
  const resolved = resolveConfig(userConfig, detected, projectRoot);

  // Cache the result
  cachedConfig = resolved;
  cachedProjectRoot = projectRoot;

  return resolved;
}

/**
 * Get config synchronously (must have been loaded first)
 */
export function getConfig(): ResolvedConfig {
  if (!cachedConfig) {
    // Return default config if not loaded
    const projectRoot = findProjectRoot();
    const detected = detectAll(projectRoot);
    return resolveConfig(null, detected, projectRoot);
  }
  return cachedConfig;
}

/**
 * Clear config cache
 */
export function clearConfigCache(): void {
  cachedConfig = null;
  cachedProjectRoot = null;
}

/**
 * Helper to define config with type checking
 */
export function defineConfig(config: KrolikConfig): KrolikConfig {
  return config;
}
