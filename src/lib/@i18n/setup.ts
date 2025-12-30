/**
 * @module lib/@i18n/setup
 * @description Locale directory setup and initialization
 *
 * Provides automatic creation of locale directory structure and base files.
 * Follows Airbnb/Google i18n workflow: ensure structure exists before operations.
 *
 * @example
 * ```typescript
 * import { ensureLocalesDir, initDefaultLocales } from '@/lib/@i18n/setup';
 *
 * // Ensure directory structure exists
 * const localesDir = await ensureLocalesDir('/path/to/project');
 * // => '/path/to/project/apps/web/public/locales'
 *
 * // Initialize with base files
 * await initDefaultLocales(localesDir, { languages: ['ru', 'en'] });
 * // Creates: ru/common.json, en/common.json
 * ```
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

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
}

/**
 * Result of a single file initialization
 */
interface FileInitResult {
  path: string;
  created: boolean;
  merged: boolean;
  keysAdded: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default configuration */
export const DEFAULT_I18N_CONFIG: I18nSetupConfig = {
  languages: ['ru', 'en'],
  defaultNamespaces: ['common'],
  initialContent: {
    common: {},
  },
};

/** Ordered list of paths to try for locale directory detection */
const LOCALE_PATHS = [
  'apps/web/public/locales',
  'public/locales',
  'locales',
  'src/locales',
] as const;

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Check if a directory exists
 */
async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.promises.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Check if a file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.promises.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

/**
 * Read JSON file safely
 */
async function readJsonSafe(filePath: string): Promise<Record<string, unknown> | null> {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Write JSON file with consistent formatting
 */
async function writeJson(filePath: string, content: Record<string, unknown>): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(filePath, `${JSON.stringify(content, null, 2)}\n`, 'utf-8');
}

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

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Detect the locale directory in a project
 *
 * Tries common paths in order:
 * 1. apps/web/public/locales (monorepo)
 * 2. public/locales (Next.js)
 * 3. locales (generic)
 * 4. src/locales (alternative)
 *
 * @param projectRoot - Root directory of the project
 * @returns Path to locale directory or null if not found
 */
export async function detectLocalesDir(projectRoot: string): Promise<string | null> {
  for (const relativePath of LOCALE_PATHS) {
    const fullPath = path.join(projectRoot, relativePath);
    if (await directoryExists(fullPath)) {
      return fullPath;
    }
  }
  return null;
}

/**
 * Ensure locale directory exists, creating it if necessary
 *
 * Uses smart detection:
 * 1. If directory exists, return it
 * 2. If monorepo structure detected (apps/web), use apps/web/public/locales
 * 3. If public folder exists, use public/locales
 * 4. Otherwise, use locales at project root
 *
 * @param projectRoot - Root directory of the project
 * @returns Result with path and creation status
 */
export async function ensureLocalesDir(projectRoot: string): Promise<LocalesDirResult> {
  // First, try to find existing directory
  const existing = await detectLocalesDir(projectRoot);
  if (existing) {
    return { path: existing, existed: true, filesCreated: 0 };
  }

  // Determine best path based on project structure
  let targetPath: string;

  // Check for monorepo structure
  const webAppPath = path.join(projectRoot, 'apps', 'web');
  if (await directoryExists(webAppPath)) {
    targetPath = path.join(webAppPath, 'public', 'locales');
  }
  // Check for public folder (Next.js)
  else if (await directoryExists(path.join(projectRoot, 'public'))) {
    targetPath = path.join(projectRoot, 'public', 'locales');
  }
  // Fallback to root-level locales
  else {
    targetPath = path.join(projectRoot, 'locales');
  }

  // Create directory
  await fs.promises.mkdir(targetPath, { recursive: true });

  return { path: targetPath, existed: false, filesCreated: 0 };
}

/**
 * Initialize locale files for a specific language
 *
 * For each namespace:
 * - If file doesn't exist: create with initial content
 * - If file exists: merge new keys (existing keys preserved)
 *
 * @param localesDir - Path to locales directory
 * @param language - Language code (e.g., 'ru', 'en')
 * @param config - Setup configuration
 * @returns Array of file initialization results
 */
export async function initLanguageLocales(
  localesDir: string,
  language: string,
  config: I18nSetupConfig = DEFAULT_I18N_CONFIG,
): Promise<FileInitResult[]> {
  const langDir = path.join(localesDir, language);
  await fs.promises.mkdir(langDir, { recursive: true });

  const results: FileInitResult[] = [];

  for (const namespace of config.defaultNamespaces) {
    const filePath = path.join(langDir, `${namespace}.json`);
    const initialContent = config.initialContent?.[namespace] ?? {};

    if (await fileExists(filePath)) {
      // File exists - merge new keys
      const existing = await readJsonSafe(filePath);
      if (existing) {
        const { merged, keysAdded } = deepMergeNew(existing, initialContent);
        if (keysAdded > 0) {
          await writeJson(filePath, merged);
          results.push({ path: filePath, created: false, merged: true, keysAdded });
        } else {
          results.push({ path: filePath, created: false, merged: false, keysAdded: 0 });
        }
      }
    } else {
      // File doesn't exist - create with initial content
      await writeJson(filePath, initialContent);
      results.push({
        path: filePath,
        created: true,
        merged: false,
        keysAdded: Object.keys(initialContent).length,
      });
    }
  }

  return results;
}

/**
 * Initialize all default locales
 *
 * Creates the complete locale structure:
 * - Ensures locales directory exists
 * - For each language, ensures namespace files exist
 * - Merges initial content into existing files
 *
 * @param projectRoot - Root directory of the project
 * @param config - Setup configuration (optional)
 * @returns Combined result of all operations
 */
export async function initDefaultLocales(
  projectRoot: string,
  config: I18nSetupConfig = DEFAULT_I18N_CONFIG,
): Promise<LocalesDirResult> {
  // Ensure directory exists
  const dirResult = await ensureLocalesDir(projectRoot);

  let filesCreated = 0;

  // Initialize each language
  for (const language of config.languages) {
    const langResults = await initLanguageLocales(dirResult.path, language, config);
    filesCreated += langResults.filter((r) => r.created).length;
  }

  return {
    path: dirResult.path,
    existed: dirResult.existed,
    filesCreated,
  };
}

/**
 * Get or create locales directory with full initialization
 *
 * Convenience function that combines detection, creation, and initialization:
 * 1. Detects existing locale directory
 * 2. If not found, creates appropriate directory structure
 * 3. Ensures all language/namespace files exist
 *
 * @param projectRoot - Root directory of the project
 * @param config - Setup configuration (optional)
 * @returns Path to locale directory
 */
export async function getOrCreateLocalesDir(
  projectRoot: string,
  config: I18nSetupConfig = DEFAULT_I18N_CONFIG,
): Promise<string> {
  const result = await initDefaultLocales(projectRoot, config);
  return result.path;
}
