/**
 * @module commands/fix/fixers/i18n/fixer
 * @description Fixes hardcoded i18n strings using catalog-first approach
 *
 * This fixer uses Google/Airbnb-style i18n workflow:
 * 1. Load existing translations from locale files
 * 2. For each hardcoded string:
 *    - If translation exists → reuse existing key
 *    - If not → generate new key, add to catalog
 * 3. Replace text with t('key') call
 * 4. Flush new translations to locale files
 */

import * as path from 'node:path';
import {
  createLocaleCatalog,
  type LocaleCatalog,
  type ResolvedKey,
  resolveKey,
} from '../../../../lib/@i18n';
import type { FixOperation, QualityIssue } from '../../core/types';
import { createReplaceLine, getLineContext } from '../../core/utils';

// ============================================================================
// CATALOG STATE (module-level for lifecycle management)
// ============================================================================

/** Active locale catalog instance */
let catalog: LocaleCatalog | null = null;

/** Resolved keys cache for batch processing */
const resolvedKeys = new Map<string, ResolvedKey>();

/** Statistics for current fix session */
let stats = {
  existingKeys: 0,
  newKeys: 0,
  collisions: 0,
};

// ============================================================================
// LIFECYCLE FUNCTIONS (called by index.ts)
// ============================================================================

/**
 * Initialize catalog before fixing
 * Loads existing translations from locale files
 */
export async function initializeCatalog(projectRoot: string): Promise<void> {
  catalog = createLocaleCatalog();
  resolvedKeys.clear();
  stats = { existingKeys: 0, newKeys: 0, collisions: 0 };

  // Find locales directory (try common locations)
  const localesPaths = [
    path.join(projectRoot, 'apps/web/public/locales'),
    path.join(projectRoot, 'public/locales'),
    path.join(projectRoot, 'locales'),
  ];

  for (const localesDir of localesPaths) {
    try {
      await catalog.load(localesDir, 'ru');
      return;
    } catch {}
  }
}

/**
 * Flush catalog to disk after fixing
 * Writes new translations to locale files
 */
export async function flushCatalog(): Promise<{ newKeys: number; filesUpdated: number }> {
  if (!catalog) {
    return { newKeys: 0, filesUpdated: 0 };
  }

  const pendingWrites = catalog.getPendingWrites();
  const filesUpdated = pendingWrites.size;

  await catalog.flush();

  const result = { newKeys: stats.newKeys, filesUpdated };

  // Reset state
  catalog = null;
  resolvedKeys.clear();
  stats = { existingKeys: 0, newKeys: 0, collisions: 0 };

  return result;
}

/**
 * Get fix session statistics
 */
export function getFixStats(): typeof stats {
  return { ...stats };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Find actual text in line - handles truncation markers correctly
 * Returns the actual text found and whether it was quoted
 */
function findActualText(line: string, baseText: string): { text: string; quoted: boolean } | null {
  // Try with the base text first (exact match in quotes)
  if (line.includes(`"${baseText}"`)) {
    return { text: baseText, quoted: true };
  }

  // Try with trailing ... (might have been wrongly stripped)
  const textWithDots = `${baseText}...`;
  if (line.includes(`"${textWithDots}"`)) {
    return { text: textWithDots, quoted: true };
  }

  // Check for JSX text: >Текст<
  if (line.includes(`>${baseText}<`)) {
    return { text: baseText, quoted: false };
  }
  if (line.includes(`>${textWithDots}<`)) {
    return { text: textWithDots, quoted: false };
  }

  // Fallback to base text
  if (line.includes(baseText)) {
    return { text: baseText, quoted: false };
  }

  return null;
}

/**
 * Resolve key for text using catalog-first approach
 * Falls back to simple generation if catalog not initialized
 */
function resolveKeyForText(text: string, filePath: string): string {
  // Check cache first
  const cached = resolvedKeys.get(text);
  if (cached) {
    return cached.key;
  }

  // If catalog is available, use full resolution
  if (catalog) {
    const resolved = resolveKey(text, { catalog, filePath });

    // Track stats
    if (resolved.isExisting) {
      stats.existingKeys++;
    }
    if (resolved.isNew) {
      stats.newKeys++;
      // Add to catalog for subsequent lookups and final flush
      catalog.addTranslation(resolved.key, text);
    }
    if (resolved.collision) {
      stats.collisions++;
    }

    // Cache result
    resolvedKeys.set(text, resolved);

    return resolved.key;
  }

  // Fallback: simple key generation (legacy behavior)
  const { detectNamespace, textToKey } = require('../../../../lib/@i18n/key-builder');
  const namespace = detectNamespace(filePath);
  const keyPart = textToKey(text);
  return `${namespace}.${keyPart}`;
}

// ============================================================================
// FIX FUNCTION
// ============================================================================

/**
 * Fix i18n issue by replacing hardcoded text with t() call
 * Uses catalog-first approach: reuse existing keys, add new ones
 */
export function fixI18nIssue(issue: QualityIssue, content: string): FixOperation | null {
  if (!issue.line || !issue.file) return null;

  const ctx = getLineContext(content, issue.line);
  if (!ctx) return null;

  // Extract the text value from the message
  const textMatch = issue.message.match(/: "([^"]+)"$/);
  if (!textMatch?.[1]) return null;

  // Remove potential truncation marker, but we'll verify against the actual line
  const baseText = textMatch[1].replace(/\.\.\.$/, '');

  // Find actual text in line (handles cases where ... is part of the real text)
  const found = findActualText(ctx.line, baseText);
  if (!found) return null;

  const { text, quoted } = found;

  // Generate key using catalog-first approach
  // This will reuse existing keys or add new translations to catalog
  const keyText = text.replace(/\.\.\.$/, '');
  const key = resolveKeyForText(keyText, issue.file);

  // Find the text in the line and replace
  let newLine = ctx.line;

  // 1. Quoted attribute: "Текст..." → {t('key')}
  if (quoted) {
    newLine = ctx.line.replace(`"${text}"`, `{t('${key}')}`);
  }
  // 2. Direct text in JSX: >Текст< → >{t('key')}<
  else if (ctx.line.includes(`>${text}<`)) {
    newLine = ctx.line.replace(`>${text}<`, `>{t('${key}')}<`);
  }
  // 3. Text in JSX without delimiters: Текст → {t('key')}
  else {
    newLine = ctx.line.replace(text, `{t('${key}')}`);
  }

  // No change made
  if (newLine === ctx.line) {
    return null;
  }

  return createReplaceLine(issue.file, issue.line, ctx.line, newLine);
}

// ============================================================================
// IMPORT HELPERS
// ============================================================================

/**
 * Check if the t() import is already present in the file
 */
export function hasI18nImport(content: string): boolean {
  return /import\s+.*\bt\b.*from\s+['"]@piternow\/shared['"]/g.test(content);
}

/**
 * Generate import statement for t function
 */
export function generateI18nImport(): string {
  return "import { t } from '@piternow/shared';";
}
