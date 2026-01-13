/**
 * @module commands/fix/fixers/i18n/analyzer
 * @description Analyzer for detecting hardcoded i18n strings
 *
 * Hybrid detection strategy:
 * 1. Uses i18next-cli API for comprehensive AST-based detection (project scan)
 * 2. Falls back to regex-based Russian text detection (per-file analysis)
 *
 * The i18next-cli cache is populated via `scanProjectI18n()` before running fixers.
 */

import { escapeRegex } from '@/lib/@security/regex';
import {
  detectHardcodedStrings,
  type HardcodedStringIssue,
  hasRussianText,
} from '../../../../lib/@i18n';
import type { QualityIssue } from '../../core/types';

// ============================================================================
// I18NEXT-CLI CACHE
// ============================================================================

/** Cache for i18next-cli detection results, keyed by file path */
const i18nextCache = new Map<string, HardcodedStringIssue[]>();

/** Whether the cache has been populated */
let cachePopulated = false;

/**
 * Scan project using i18next-cli API and populate cache
 * Call this before running fixers for better detection
 */
export async function scanProjectI18n(projectRoot: string): Promise<number> {
  const result = await detectHardcodedStrings(projectRoot);

  // Clear and repopulate cache
  i18nextCache.clear();

  for (const issue of result.issues) {
    const existing = i18nextCache.get(issue.file) ?? [];
    existing.push(issue);
    i18nextCache.set(issue.file, existing);
  }

  cachePopulated = true;
  return result.issues.length;
}

/**
 * Clear the i18next-cli cache
 */
export function clearI18nCache(): void {
  i18nextCache.clear();
  cachePopulated = false;
}

/**
 * Check if cache is populated
 */
export function isCachePopulated(): boolean {
  return cachePopulated;
}

/**
 * Get cached issues for a file
 */
function getCachedIssues(file: string): HardcodedStringIssue[] | undefined {
  return i18nextCache.get(file);
}

// ============================================================================
// PATTERNS
// ============================================================================

/** Match JSX text content: >Текст< */
const JSX_TEXT_RE = />([^<>{]+)</g;

/** Match string literals in JSX attributes: attr="Текст" or attr='Текст' */
const JSX_ATTR_RE = /(\w+)=["']([^"']+)["']/g;

/** Match string literals: "Текст" or 'Текст' */
const STRING_LITERAL_RE = /["']([^"']{2,})["']/g;

/** Technical patterns to skip */
const TECHNICAL_PATTERNS = [
  /^[a-z0-9_-]+$/, // kebab-case, snake_case identifiers
  /^#[0-9a-fA-F]{3,8}$/, // hex colors
  /^\d+(\.\d+)?%?$/, // numbers/percentages
  /^https?:\/\//, // URLs
  /^[a-z]+:\/\//, // URIs
  /^\w+\.\w+/, // file.ext or module.path
  /^@\w+/, // decorators/handles
];

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Truncate text to specified length
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

/**
 * Check if text is technical (should skip)
 */
function isTechnical(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 2) return true;
  return TECHNICAL_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * Determine context type from match
 */
function getContext(line: string, text: string): string {
  if (line.includes(`>${text}<`)) return 'jsx text';
  if (line.match(new RegExp(`\\w+=["']${escapeRegex(text)}["']`))) return 'jsx attribute';
  return 'string literal';
}

// ============================================================================
// ANALYZER
// ============================================================================

/**
 * Convert i18next-cli issue to QualityIssue format
 */
function convertToQualityIssue(issue: HardcodedStringIssue, file: string): QualityIssue {
  return {
    file,
    line: issue.line,
    severity: 'warning',
    category: 'i18n',
    message: `Hardcoded text: "${truncate(issue.text, 50)}"`,
    suggestion: issue.suggestedKey
      ? `Extract to key: ${issue.suggestedKey}`
      : 'Extract to i18n translation key',
    snippet: issue.text,
    fixerId: 'i18n',
  };
}

/**
 * Analyze file for hardcoded strings using hybrid detection
 *
 * Strategy:
 * 1. If i18next-cli cache is populated, use it (more accurate)
 * 2. Otherwise, fall back to regex-based Russian text detection
 *
 * @param content - File content
 * @param file - File path
 * @returns Array of detected issues
 */
export function analyzeI18nIssues(content: string, file: string): QualityIssue[] {
  // Skip non-tsx/jsx files
  if (!file.endsWith('.tsx') && !file.endsWith('.jsx')) {
    return [];
  }

  // Strategy 1: Use i18next-cli cache if available
  const cachedIssues = getCachedIssues(file);
  if (cachedIssues && cachedIssues.length > 0) {
    return cachedIssues.map((issue) => convertToQualityIssue(issue, file));
  }

  // Strategy 2: Fall back to regex-based Russian text detection
  return analyzeRussianText(content, file);
}

/**
 * Analyze file for hardcoded Russian strings (fallback method)
 *
 * @param content - File content
 * @param file - File path
 * @returns Array of detected issues
 */
function analyzeRussianText(content: string, file: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const lines = content.split('\n');
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const lineNumber = i + 1;

    // Skip comment lines
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
      continue;
    }

    // Check for Russian text in various patterns
    const patterns = [JSX_TEXT_RE, JSX_ATTR_RE, STRING_LITERAL_RE];

    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = pattern.exec(line)) !== null) {
        // Extract text (group 1 for JSX_TEXT/STRING, group 2 for JSX_ATTR)
        const text = match[2] ?? match[1];
        if (!text) continue;

        const trimmed = text.trim();

        // Skip if technical or already seen
        if (isTechnical(trimmed)) continue;
        if (seen.has(`${lineNumber}:${trimmed}`)) continue;

        // Check for Russian text
        if (hasRussianText(trimmed)) {
          seen.add(`${lineNumber}:${trimmed}`);
          const context = getContext(line, trimmed);

          issues.push({
            file,
            line: lineNumber,
            severity: 'warning',
            category: 'i18n',
            message: `Hardcoded Russian text in ${context}: "${truncate(trimmed, 50)}"`,
            suggestion: 'Extract to i18n translation key',
            snippet: trimmed,
            fixerId: 'i18n',
          });
        }
      }
    }
  }

  return issues;
}
