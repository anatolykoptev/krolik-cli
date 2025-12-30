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

import { readFile, writeFile } from '../../../../lib/@core/fs';
import {
  createLocaleCatalog,
  DEFAULT_I18N_CONFIG,
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

/** Track files that need import added */
const filesNeedingImport = new Set<string>();

/** Path to locales directory (set during initialization) */
let localesPath = '';

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
 *
 * Loads existing translations from locale files.
 * If locale directory doesn't exist, creates it with default structure:
 * - apps/web/public/locales/ru/common.json
 * - apps/web/public/locales/en/common.json
 */
export async function initializeCatalog(projectRoot: string): Promise<void> {
  catalog = createLocaleCatalog();
  resolvedKeys.clear();
  filesNeedingImport.clear();
  localesPath = '';
  stats = { existingKeys: 0, newKeys: 0, collisions: 0 };

  // Load or create locale directory with auto-initialization
  // This will:
  // 1. Detect existing locales directory (apps/web/public/locales, public/locales, etc.)
  // 2. If not found, create appropriate directory based on project structure
  // 3. Create default language files (ru/common.json, en/common.json)
  const loadedPath = await catalog.loadOrCreate(projectRoot, 'ru', DEFAULT_I18N_CONFIG);

  // Store relative path for comments
  localesPath = loadedPath.replace(projectRoot, '').replace(/^\//, '');
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
 * Finds the FULL quoted string that contains baseText, not just the truncated part.
 */
function findActualText(
  line: string,
  baseText: string,
): { text: string; quoted: boolean; quoteChar?: '"' | "'" } | null {
  // Try exact match first (when text wasn't truncated)
  if (line.includes(`"${baseText}"`)) {
    return { text: baseText, quoted: true, quoteChar: '"' };
  }
  if (line.includes(`'${baseText}'`)) {
    return { text: baseText, quoted: true, quoteChar: "'" };
  }

  // For truncated text, find the FULL quoted string that starts with baseText
  // Extract all double-quoted strings
  const doubleQuotedStrings = line.match(/"[^"]+"/g) ?? [];
  for (const quoted of doubleQuotedStrings) {
    const content = quoted.slice(1, -1);
    if (content.startsWith(baseText)) {
      return { text: content, quoted: true, quoteChar: '"' };
    }
  }

  // Extract all single-quoted strings
  const singleQuotedStrings = line.match(/'[^']+'/g) ?? [];
  for (const quoted of singleQuotedStrings) {
    const content = quoted.slice(1, -1);
    if (content.startsWith(baseText)) {
      return { text: content, quoted: true, quoteChar: "'" };
    }
  }

  // Check for JSX text: >Текст< (exact match only)
  if (line.includes(`>${baseText}<`)) {
    return { text: baseText, quoted: false };
  }

  // For JSX text with truncation, find full text between > and <
  const jsxTextMatch = line.match(/>([^<]+)</g) ?? [];
  for (const match of jsxTextMatch) {
    const content = match.slice(1, -1);
    if (content.startsWith(baseText)) {
      return { text: content, quoted: false };
    }
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

  const { text, quoted, quoteChar } = found;

  // Generate key using catalog-first approach
  // This will reuse existing keys or add new translations to catalog
  const keyText = text.replace(/\.\.\.$/, '');
  const key = resolveKeyForText(keyText, issue.file);

  // Find the text in the line and replace
  let newLine = ctx.line;

  // Determine context: JSX attribute vs object property vs JSX expression vs JSX text
  // Object property pattern: key: "value" or key: 'value'
  // Also matches: { key: "value" or , key: "value"
  const trimmedLine = ctx.line.trim();
  const isObjectProperty =
    /^\w+:\s*["']/.test(trimmedLine) || // key: "value" at line start
    /[{,]\s*\w+:\s*["']/.test(trimmedLine); // { key: "value" or , key: "value"

  // Check for object property with fallback: key: value ?? 'text' or key: value || 'text'
  // Pattern: error: error.message ?? 'Ошибка' or title: val || 'Заголовок'
  const isObjectPropertyWithFallback =
    /^\w+:\s*.+(\?\?|\|\|)\s*["']/.test(trimmedLine) || // key: expr ?? "value"
    /[{,]\s*\w+:\s*.+(\?\?|\|\|)\s*["']/.test(trimmedLine); // { key: expr ?? "value"

  // Check for default parameter value: paramName = 'text' (in destructuring)
  // Pattern: selectFileText = 'Выбрать файл', or { onClose, title = 'Заголовок' }
  const isDefaultParam =
    /^\w+\s*=\s*["']/.test(trimmedLine) || // param = "value" at line start
    /[{,]\s*\w+\s*=\s*["']/.test(trimmedLine); // { param = "value" or , param = "value"

  // Check for return statement: return 'text'
  const isReturnStatement = /^return\s+["']/.test(trimmedLine);

  // Check for ternary in assignment: const x = cond ? val : 'text'
  // Pattern: variable assignment with ternary operator ending in string
  const isTernaryFallback = /^(const|let|var)\s+\w+\s*=\s*.+\?\s*.+:\s*["']/.test(trimmedLine);

  // Check for ternary continuation: ? 'text' or : 'text' (multi-line ternary)
  const isTernaryContinuation = /^[?:]\s*["']/.test(trimmedLine);

  // Check for function call argument: fn('text') or fn(arg, 'text')
  // Pattern: functionName('text' or , 'text' inside parentheses
  const isFunctionArg = /\(\s*["']/.test(trimmedLine) || /,\s*["']/.test(trimmedLine);

  // Check if text is inside JSX expression: {value || 'text'} or {condition ? 'text' : other}
  // Find position of the quoted text and check for surrounding braces
  const quotedText = `${quoteChar}${text}${quoteChar}`;
  const textIndex = ctx.line.indexOf(quotedText);
  let isInsideJsxExpression = false;

  if (textIndex >= 0 && quoteChar) {
    // Look for opening brace before the text (not part of JSX attribute pattern like prop={)
    const beforeText = ctx.line.slice(0, textIndex);
    const afterText = ctx.line.slice(textIndex + quotedText.length);

    // Check if we're inside {... || 'text'} or {... ? 'text' : ...} patterns
    const hasOpenBrace = beforeText.includes('{') && !beforeText.match(/=\s*\{$/);
    const hasCloseBrace = afterText.includes('}');

    // Also check for logical operators or ternary before the text
    const hasLogicalPattern = /(\|\||\?\?|\?)\s*$/.test(beforeText);

    isInsideJsxExpression = hasOpenBrace && hasCloseBrace && hasLogicalPattern;
  }

  // 1. Quoted string in object property: title: "Текст" → title: t('key')
  if (quoted && isObjectProperty && quoteChar) {
    newLine = ctx.line.replace(quotedText, `t('${key}')`);
  }
  // 2. Object property with fallback: error: msg ?? 'Текст' → error: msg ?? t('key')
  else if (quoted && isObjectPropertyWithFallback && quoteChar) {
    newLine = ctx.line.replace(quotedText, `t('${key}')`);
  }
  // 3. Default parameter value: param = 'Текст' → param = t('key')
  else if (quoted && isDefaultParam && quoteChar) {
    newLine = ctx.line.replace(quotedText, `t('${key}')`);
  }
  // 4. Return statement: return 'Текст' → return t('key')
  else if (quoted && isReturnStatement && quoteChar) {
    newLine = ctx.line.replace(quotedText, `t('${key}')`);
  }
  // 5. Ternary in assignment: const x = cond ? val : 'Текст' → const x = cond ? val : t('key')
  else if (quoted && isTernaryFallback && quoteChar) {
    newLine = ctx.line.replace(quotedText, `t('${key}')`);
  }
  // 6. Ternary continuation: ? 'Текст' or : 'Текст' → ? t('key') or : t('key')
  else if (quoted && isTernaryContinuation && quoteChar) {
    newLine = ctx.line.replace(quotedText, `t('${key}')`);
  }
  // 7. Function argument: fn('Текст') → fn(t('key'))
  else if (quoted && isFunctionArg && quoteChar) {
    newLine = ctx.line.replace(quotedText, `t('${key}')`);
  }
  // 8. Quoted string inside JSX expression: {val || 'Текст'} → {val || t('key')}
  else if (quoted && isInsideJsxExpression && quoteChar) {
    newLine = ctx.line.replace(quotedText, `t('${key}')`);
  }
  // 9. Quoted attribute in JSX: prop="Текст" → prop={t('key')}
  else if (quoted && quoteChar) {
    newLine = ctx.line.replace(quotedText, `{t('${key}')}`);
  }
  // 10. Direct text in JSX: >Текст< → >{t('key')}<
  else if (ctx.line.includes(`>${text}<`)) {
    newLine = ctx.line.replace(`>${text}<`, `>{t('${key}')}<`);
  }
  // 11. Text in JSX without delimiters: Текст → {t('key')}
  else {
    newLine = ctx.line.replace(text, `{t('${key}')}`);
  }

  // No change made
  if (newLine === ctx.line) {
    return null;
  }

  // Track file for import injection
  filesNeedingImport.add(issue.file);

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

/**
 * Generate comment pointing to locale files location
 */
export function generateI18nComment(localesPath: string): string {
  return `// i18n: Translations → ${localesPath}`;
}

/**
 * Get set of files that need import injection
 */
export function getFilesNeedingImport(): Set<string> {
  return new Set(filesNeedingImport);
}

/**
 * Add missing t() imports to files that were fixed
 *
 * Should be called in onComplete after fixes are applied.
 * Reads each file, checks if import exists, adds if missing.
 *
 * @returns Number of files updated with imports
 */
export function addMissingImports(): number {
  let filesUpdated = 0;

  for (const filePath of filesNeedingImport) {
    const content = readFile(filePath);
    if (!content) continue;

    // Skip if already has import
    if (hasI18nImport(content)) continue;

    // Find first import statement to insert after
    const lines = content.split('\n');
    let insertIndex = 0;
    let lastImportIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      // Track last import line
      if (line.startsWith('import ') || line.match(/^import\s*{/)) {
        lastImportIndex = i;
        // Handle multi-line imports
        if (!line.includes(';') && !line.endsWith("';") && !line.endsWith('";')) {
          // Find closing line
          for (let j = i + 1; j < lines.length; j++) {
            if (lines[j]!.includes(';')) {
              lastImportIndex = j;
              break;
            }
          }
        }
      }
    }

    // Insert after last import, or at beginning if no imports
    if (lastImportIndex >= 0) {
      insertIndex = lastImportIndex + 1;
    }

    // Add import and comment
    const importLine = generateI18nImport();
    const commentLine = localesPath ? generateI18nComment(localesPath) : '';

    if (commentLine) {
      lines.splice(insertIndex, 0, importLine, commentLine);
    } else {
      lines.splice(insertIndex, 0, importLine);
    }

    // Write back
    writeFile(filePath, lines.join('\n'));
    filesUpdated++;
  }

  // Clear tracking after injection
  filesNeedingImport.clear();

  return filesUpdated;
}
