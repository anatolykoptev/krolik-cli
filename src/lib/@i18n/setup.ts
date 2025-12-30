/**
 * @module lib/@i18n/setup
 * @description Dynamic locale directory detection and initialization
 *
 * Uses pattern-based detection similar to @discovery/routes:
 * - Detects i18n libraries from package.json
 * - Maps libraries to expected locale paths
 * - Scans for existing locale directories
 * - Creates missing structure based on detected patterns
 *
 * @example
 * ```typescript
 * import { detectLocalesDir, ensureLocalesStructure } from '@/lib/@i18n/setup';
 *
 * // Detect existing locales directory
 * const localesDir = detectLocalesDir('/path/to/project');
 *
 * // Ensure structure exists (creates if missing)
 * const result = await ensureLocalesStructure('/path/to/project');
 * ```
 */

import * as path from 'node:path';

import {
  ensureDir,
  exists,
  getSubdirectories,
  isDirectory,
  readJson,
  writeJson,
} from '../@core/fs';
import { detectMonorepo } from '../@discovery';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Configuration for locale setup
 */
export interface I18nSetupConfig {
  /** Languages to initialize (default: ['ru', 'en']) */
  languages: readonly string[];

  /** Default namespaces to create (default: ['common']) */
  defaultNamespaces: readonly string[];

  /** Initial content for each namespace (optional) */
  initialContent?: Record<string, Record<string, unknown>>;
}

/**
 * Result of locale directory detection
 */
export interface LocalesDirResult {
  /** Resolved path to locales directory */
  path: string;

  /** Whether the directory existed before */
  existed: boolean;

  /** Whether any files were created */
  filesCreated: number;

  /** Detected i18n library */
  detectedLibrary?: string;
}

/**
 * Detected i18n configuration
 */
interface I18nDetection {
  /** Detected i18n libraries */
  libraries: Set<string>;

  /** Candidate paths based on detected libraries */
  candidatePaths: string[];

  /** Is this a monorepo? */
  isMonorepo: boolean;

  /** Web app path (for monorepos) */
  webAppPath?: string;
}

// ============================================================================
// CONSTANTS - Framework-to-paths mapping (like routes.ts)
// ============================================================================

/**
 * I18n library to locale path mapping
 * Key: npm package name, Value: candidate paths relative to project/package root
 */
const I18N_LIBRARY_CANDIDATES: Record<string, { deps: string[]; paths: string[] }> = {
  'next-i18next': {
    deps: ['next-i18next'],
    paths: ['public/locales', 'locales'],
  },
  'react-i18next': {
    deps: ['react-i18next', 'i18next'],
    paths: ['public/locales', 'src/locales', 'locales', 'src/i18n/locales'],
  },
  i18next: {
    deps: ['i18next'],
    paths: ['locales', 'src/locales', 'public/locales'],
  },
  'next-intl': {
    deps: ['next-intl'],
    paths: ['messages', 'locales', 'src/messages'],
  },
  lingui: {
    deps: ['@lingui/core', '@lingui/react'],
    paths: ['src/locales', 'locales'],
  },
  'vue-i18n': {
    deps: ['vue-i18n'],
    paths: ['src/locales', 'locales', 'src/i18n'],
  },
};

/**
 * Monorepo package paths where locales typically live
 * Checked in order of priority
 */
const MONOREPO_WEB_PACKAGES = [
  'apps/web',
  'apps/frontend',
  'apps/client',
  'packages/web',
  'packages/frontend',
  'packages/app',
] as const;

/**
 * Generic fallback paths when no library is detected
 */
const FALLBACK_PATHS = ['public/locales', 'locales', 'src/locales'] as const;

/** Default configuration */
export const DEFAULT_I18N_CONFIG: I18nSetupConfig = {
  languages: ['ru', 'en'],
  defaultNamespaces: ['common'],
  initialContent: {
    common: {},
  },
};

// ============================================================================
// CACHE
// ============================================================================

/** Cache for detected i18n config per project */
const detectionCache = new Map<string, I18nDetection>();

/**
 * Clear detection cache (for testing or project changes)
 */
export function clearI18nDetectionCache(): void {
  detectionCache.clear();
}

// ============================================================================
// DETECTION - Dynamic path discovery
// ============================================================================

/**
 * Read package.json dependencies
 */
function readDependencies(pkgPath: string): Set<string> {
  const pkg = readJson<{
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  }>(pkgPath);

  if (!pkg) return new Set();

  return new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
  ]);
}

/**
 * Detect i18n libraries and candidate paths
 */
function detectI18nConfig(projectRoot: string): I18nDetection {
  const cached = detectionCache.get(projectRoot);
  if (cached) return cached;

  const detection: I18nDetection = {
    libraries: new Set(),
    candidatePaths: [],
    isMonorepo: false,
  };

  // Check for monorepo
  const monorepo = detectMonorepo(projectRoot);
  detection.isMonorepo = monorepo !== null;

  // Find web app package in monorepo
  if (detection.isMonorepo) {
    for (const pkgPath of MONOREPO_WEB_PACKAGES) {
      const fullPath = path.join(projectRoot, pkgPath);
      if (isDirectory(fullPath)) {
        detection.webAppPath = pkgPath;
        break;
      }
    }
  }

  // Read root package.json
  const rootDeps = readDependencies(path.join(projectRoot, 'package.json'));

  // Read web app package.json (for monorepos)
  let webDeps = new Set<string>();
  if (detection.webAppPath) {
    const webPkgPath = path.join(projectRoot, detection.webAppPath, 'package.json');
    webDeps = readDependencies(webPkgPath);
  }

  const allDeps = new Set([...rootDeps, ...webDeps]);

  // Detect i18n libraries
  for (const [library, config] of Object.entries(I18N_LIBRARY_CANDIDATES)) {
    if (config.deps.some((dep) => allDeps.has(dep))) {
      detection.libraries.add(library);

      // Add paths for this library
      for (const libPath of config.paths) {
        // For monorepos, prefix with web app path
        if (detection.webAppPath) {
          detection.candidatePaths.push(path.join(detection.webAppPath, libPath));
        }
        // Also check at project root
        detection.candidatePaths.push(libPath);
      }
    }
  }

  // Add fallback paths if no library detected
  if (detection.libraries.size === 0) {
    for (const fallbackPath of FALLBACK_PATHS) {
      if (detection.webAppPath) {
        detection.candidatePaths.push(path.join(detection.webAppPath, fallbackPath));
      }
      detection.candidatePaths.push(fallbackPath);
    }
  }

  // Remove duplicates while preserving order
  detection.candidatePaths = [...new Set(detection.candidatePaths)];

  detectionCache.set(projectRoot, detection);
  return detection;
}

// ============================================================================
// DIRECTORY DETECTION
// ============================================================================

/**
 * Check if directory looks like a locales directory
 * (contains language subdirectories with JSON files)
 */
function isLocalesDirectory(dirPath: string): boolean {
  if (!isDirectory(dirPath)) return false;

  const subdirs = getSubdirectories(dirPath);
  if (subdirs.length === 0) return false;

  // Check if any subdir looks like a language code (2-5 chars)
  // and contains JSON files
  for (const subdir of subdirs) {
    if (subdir.length >= 2 && subdir.length <= 5) {
      const langDir = path.join(dirPath, subdir);

      // Check for JSON files in the language directory
      try {
        const entries = require('node:fs').readdirSync(langDir);
        if (entries.some((f: string) => f.endsWith('.json'))) {
          return true;
        }
      } catch {
        // Ignore errors
      }
    }
  }

  return false;
}

/**
 * Detect existing locales directory
 *
 * Uses dynamic detection based on:
 * 1. Detected i18n libraries from package.json
 * 2. Project structure (monorepo vs single package)
 * 3. Common path patterns
 *
 * @param projectRoot - Project root directory
 * @returns Path to locales directory or null if not found
 */
export function detectLocalesDir(projectRoot: string): string | null {
  const detection = detectI18nConfig(projectRoot);

  // Check each candidate path
  for (const candidatePath of detection.candidatePaths) {
    const fullPath = path.join(projectRoot, candidatePath);

    if (isLocalesDirectory(fullPath)) {
      return fullPath;
    }

    // Also check if directory exists but is empty (still valid)
    if (isDirectory(fullPath)) {
      return fullPath;
    }
  }

  return null;
}

/**
 * Get the best path for creating locales directory
 *
 * Based on detected i18n library and project structure
 */
export function getBestLocalesPath(projectRoot: string): string {
  const detection = detectI18nConfig(projectRoot);

  // Return first candidate path (highest priority)
  if (detection.candidatePaths.length > 0) {
    return path.join(projectRoot, detection.candidatePaths[0]!);
  }

  // Ultimate fallback
  if (detection.webAppPath) {
    return path.join(projectRoot, detection.webAppPath, 'public', 'locales');
  }

  return path.join(projectRoot, 'public', 'locales');
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Deep merge two objects (source into target)
 * Only adds keys that don't exist in target
 */
function deepMergeNew(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): { merged: Record<string, unknown>; keysAdded: number } {
  const result = { ...target };
  let keysAdded = 0;

  for (const [key, value] of Object.entries(source)) {
    if (!(key in result)) {
      result[key] = value;
      keysAdded++;
    } else if (
      typeof result[key] === 'object' &&
      result[key] !== null &&
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(result[key]) &&
      !Array.isArray(value)
    ) {
      const nested = deepMergeNew(
        result[key] as Record<string, unknown>,
        value as Record<string, unknown>,
      );
      result[key] = nested.merged;
      keysAdded += nested.keysAdded;
    }
  }

  return { merged: result, keysAdded };
}

/**
 * Initialize locale files for a specific language
 *
 * @param localesDir - Path to locales directory
 * @param language - Language code (e.g., 'ru', 'en')
 * @param config - Setup configuration
 * @returns Number of files created
 */
export function initLanguageLocales(
  localesDir: string,
  language: string,
  config: I18nSetupConfig = DEFAULT_I18N_CONFIG,
): number {
  const langDir = path.join(localesDir, language);
  ensureDir(langDir);

  let filesCreated = 0;

  for (const namespace of config.defaultNamespaces) {
    const filePath = path.join(langDir, `${namespace}.json`);
    const initialContent = config.initialContent?.[namespace] ?? {};

    if (exists(filePath)) {
      // File exists - merge new keys
      const existing = readJson<Record<string, unknown>>(filePath);
      if (existing) {
        const { merged, keysAdded } = deepMergeNew(existing, initialContent);
        if (keysAdded > 0) {
          writeJson(filePath, merged);
        }
      }
    } else {
      // File doesn't exist - create
      writeJson(filePath, initialContent);
      filesCreated++;
    }
  }

  return filesCreated;
}

/**
 * Ensure locales directory structure exists
 *
 * Creates the complete locale structure:
 * - Detects or creates locales directory
 * - For each language, ensures namespace files exist
 *
 * @param projectRoot - Root directory of the project
 * @param config - Setup configuration (optional)
 * @returns Result with path and creation status
 */
export async function ensureLocalesStructure(
  projectRoot: string,
  config: I18nSetupConfig = DEFAULT_I18N_CONFIG,
): Promise<LocalesDirResult> {
  // Try to find existing directory
  let localesDir = detectLocalesDir(projectRoot);
  const existed = localesDir !== null;

  // Create if not found
  if (!localesDir) {
    localesDir = getBestLocalesPath(projectRoot);
    ensureDir(localesDir);
  }

  // Get detected library for reporting
  const detection = detectI18nConfig(projectRoot);
  const detectedLibrary = detection.libraries.size > 0 ? [...detection.libraries][0] : undefined;

  let filesCreated = 0;

  // Initialize each language
  for (const language of config.languages) {
    filesCreated += initLanguageLocales(localesDir, language, config);
  }

  return {
    path: localesDir,
    existed,
    filesCreated,
    ...(detectedLibrary && { detectedLibrary }),
  };
}

/**
 * Get or create locales directory with full initialization
 *
 * Convenience function that combines detection, creation, and initialization
 *
 * @param projectRoot - Root directory of the project
 * @param config - Setup configuration (optional)
 * @returns Path to locale directory
 */
export async function getOrCreateLocalesDir(
  projectRoot: string,
  config: I18nSetupConfig = DEFAULT_I18N_CONFIG,
): Promise<string> {
  const result = await ensureLocalesStructure(projectRoot, config);
  return result.path;
}

// ============================================================================
// ASYNC WRAPPERS (for compatibility with existing code)
// ============================================================================

/**
 * Ensure locale directory exists (async wrapper)
 * @deprecated Use ensureLocalesStructure instead
 */
export async function ensureLocalesDir(projectRoot: string): Promise<LocalesDirResult> {
  const existing = detectLocalesDir(projectRoot);
  if (existing) {
    return { path: existing, existed: true, filesCreated: 0 };
  }

  const targetPath = getBestLocalesPath(projectRoot);
  ensureDir(targetPath);

  return { path: targetPath, existed: false, filesCreated: 0 };
}

/**
 * Initialize default locales (async wrapper)
 * @deprecated Use ensureLocalesStructure instead
 */
export async function initDefaultLocales(
  projectRoot: string,
  config: I18nSetupConfig = DEFAULT_I18N_CONFIG,
): Promise<LocalesDirResult> {
  return ensureLocalesStructure(projectRoot, config);
}
