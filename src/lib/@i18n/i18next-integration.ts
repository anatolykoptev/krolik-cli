/**
 * @module lib/@i18n/i18next-integration
 * @description Integration with i18next-cli for detection and extraction
 *
 * This module wraps i18next-cli programmatic API for use in krolik-cli.
 * It provides:
 * - Hardcoded string detection (via i18next-cli linter)
 * - Key extraction (via i18next-cli extractor)
 * - Type generation (via i18next-cli types)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  defineConfig,
  type ExtractedKey,
  findKeys,
  type I18nextToolkitConfig,
  runExtractor,
  runLinter,
  runSyncer,
  runTypesGenerator,
} from 'i18next-cli';
import { transliterateRussian } from './languages/russian';
import { detectNamespace } from './namespace-resolver';

// Local wrapper to maintain API compatibility
const transliterate = transliterateRussian;

// ============================================================================
// TYPES
// ============================================================================

export interface HardcodedStringIssue {
  file: string;
  line: number;
  text: string;
  suggestedKey?: string;
}

export interface I18nDetectionResult {
  success: boolean;
  issues: HardcodedStringIssue[];
  totalFiles: number;
  filesWithIssues: number;
}

export interface I18nExtractionResult {
  success: boolean;
  keysExtracted: number;
  filesUpdated: string[];
}

// ============================================================================
// CONFIG LOADING
// ============================================================================

/**
 * Load i18next config from project root
 */
export async function loadI18nextConfig(projectRoot: string): Promise<I18nextToolkitConfig | null> {
  const configPaths = [
    path.join(projectRoot, 'i18next.config.ts'),
    path.join(projectRoot, 'i18next.config.js'),
    path.join(projectRoot, 'i18next.config.mjs'),
  ];

  for (const configPath of configPaths) {
    if (fs.existsSync(configPath)) {
      try {
        const module = await import(configPath);
        return module.default || module;
      } catch {
        try {
          return require(configPath);
        } catch {}
      }
    }
  }

  return null;
}

/**
 * Create default config for projects without i18next.config.ts
 */
export function createDefaultConfig(projectRoot: string): I18nextToolkitConfig {
  return defineConfig({
    locales: ['ru', 'en'],
    extract: {
      input: [
        path.join(projectRoot, 'apps/web/**/*.{ts,tsx}'),
        path.join(projectRoot, 'packages/shared/**/*.{ts,tsx}'),
      ],
      ignore: ['**/node_modules/**', '**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}', '**/*.d.ts'],
      output: path.join(projectRoot, 'apps/web/public/locales/{{language}}/{{namespace}}.json'),
      defaultNS: 'common',
      functions: ['t', 'i18next.t', 'i18n.t'],
      transComponents: ['Trans'],
      removeUnusedKeys: false,
      sort: true,
    },
    lint: {
      acceptedTags: [
        'p',
        'span',
        'div',
        'button',
        'label',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'a',
        'li',
        'td',
        'th',
      ],
      acceptedAttributes: ['alt', 'title', 'placeholder', 'aria-label', 'aria-describedby'],
    },
  });
}

// ============================================================================
// DETECTION (using i18next-cli linter)
// ============================================================================

/**
 * Detect hardcoded strings using i18next-cli linter
 */
export async function detectHardcodedStrings(
  projectRoot: string,
  config?: I18nextToolkitConfig,
): Promise<I18nDetectionResult> {
  const cfg = config || (await loadI18nextConfig(projectRoot)) || createDefaultConfig(projectRoot);

  try {
    const result = await runLinter(cfg);

    const issues: HardcodedStringIssue[] = [];
    let filesWithIssues = 0;

    for (const [file, strings] of Object.entries(result.files)) {
      if (strings.length > 0) {
        filesWithIssues++;
        for (const str of strings) {
          issues.push({
            file,
            line: str.line,
            text: str.text,
            suggestedKey: generateKeyFromText(str.text, file),
          });
        }
      }
    }

    return {
      success: result.success,
      issues,
      totalFiles: Object.keys(result.files).length,
      filesWithIssues,
    };
  } catch {
    return {
      success: false,
      issues: [],
      totalFiles: 0,
      filesWithIssues: 0,
    };
  }
}

// ============================================================================
// EXTRACTION (using i18next-cli extractor)
// ============================================================================

/**
 * Extract translation keys and update JSON files
 */
export async function extractKeys(
  projectRoot: string,
  config?: I18nextToolkitConfig,
  options?: { dryRun?: boolean },
): Promise<I18nExtractionResult> {
  const cfg = config || (await loadI18nextConfig(projectRoot)) || createDefaultConfig(projectRoot);

  try {
    if (options?.dryRun) {
      const { allKeys } = await findKeys(cfg);
      return {
        success: true,
        keysExtracted: allKeys.size,
        filesUpdated: [],
      };
    }

    const updated = await runExtractor(cfg);
    const { allKeys } = await findKeys(cfg);

    return {
      success: true,
      keysExtracted: allKeys.size,
      filesUpdated: updated ? ['(files updated)'] : [],
    };
  } catch {
    return {
      success: false,
      keysExtracted: 0,
      filesUpdated: [],
    };
  }
}

/**
 * Generate TypeScript types from translation files
 */
export async function generateTypes(
  projectRoot: string,
  config?: I18nextToolkitConfig,
): Promise<boolean> {
  const cfg = config || (await loadI18nextConfig(projectRoot)) || createDefaultConfig(projectRoot);

  if (!cfg.types) {
    return false;
  }

  try {
    await runTypesGenerator(cfg);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sync secondary locales with primary
 */
export async function syncLocales(
  projectRoot: string,
  config?: I18nextToolkitConfig,
): Promise<boolean> {
  const cfg = config || (await loadI18nextConfig(projectRoot)) || createDefaultConfig(projectRoot);

  try {
    await runSyncer(cfg);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// KEY GENERATION
// ============================================================================

/**
 * Generate translation key from text and file path
 * Uses existing transliterate function and namespace detector
 */
export function generateKeyFromText(text: string, filePath: string): string {
  const namespace = detectNamespace(filePath);

  // Transliterate using existing Russian support
  const transliterated = transliterate(text.toLowerCase());

  // Clean and truncate
  const cleanText = transliterated
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join('_');

  return `${namespace}.${cleanText || 'text'}`;
}

// ============================================================================
// EXPORTS
// ============================================================================

export { defineConfig, type ExtractedKey, type I18nextToolkitConfig };
