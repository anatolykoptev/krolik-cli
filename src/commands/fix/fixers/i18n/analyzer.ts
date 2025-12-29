/**
 * @module commands/fix/fixers/i18n/analyzer
 * @description Analyzer for detecting hardcoded i18n strings
 *
 * Uses the i18n analyzer from refactor command to detect hardcoded
 * user-facing text that should be extracted for internationalization.
 */

import {
  analyzeFileI18n,
  type HardcodedStringInfo,
  type I18nAnalyzerOptions,
} from '../../../refactor/analyzers/i18n';
import type { QualityIssue } from '../../core/types';

/**
 * Convert HardcodedStringInfo to QualityIssue format
 */
function toQualityIssue(info: HardcodedStringInfo, file: string): QualityIssue {
  const contextLabel = info.context.replace('-', ' ');
  const languageLabel =
    info.language === 'ru' ? 'Russian' : info.language === 'en' ? 'English' : 'Mixed';

  return {
    file,
    line: info.location.line,
    severity: info.priority <= 2 ? 'error' : 'warning',
    category: 'i18n',
    message: `Hardcoded ${languageLabel} text in ${contextLabel}: "${truncate(info.value, 50)}"`,
    suggestion: `Extract to i18n translation key`,
    snippet: info.snippet ?? info.value,
    fixerId: 'i18n',
  };
}

/**
 * Truncate text to specified length
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

/**
 * Analyze file for hardcoded i18n strings
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

  const options: I18nAnalyzerOptions = {
    rootPath: '',
    files: [file],
    includeJsxText: true,
    includeJsxAttributes: true,
    includeStringLiterals: false, // Focus on JSX for now
    includeTemplateLiterals: false,
    languages: ['ru'], // Focus on Russian text
    minLength: 3,
    maxLength: 200,
  };

  try {
    const mergedOptions = {
      rootPath: '',
      files: [file],
      minLength: options.minLength ?? 2,
      maxLength: options.maxLength ?? 500,
      languages: options.languages ?? ['ru', 'en'],
      includeJsxText: options.includeJsxText ?? true,
      includeJsxAttributes: options.includeJsxAttributes ?? true,
      includeStringLiterals: options.includeStringLiterals ?? true,
      includeTemplateLiterals: options.includeTemplateLiterals ?? true,
      skipFilePatterns: [],
      skipStringPatterns: [],
      existingKeys: new Set<string>(),
      i18nConfigPath: '',
      verbose: false,
      limit: 0,
    };

    const result = analyzeFileI18n(file, content, mergedOptions);

    if (result.status !== 'analyzed') {
      return [];
    }

    // Convert to QualityIssue format, filter by confidence
    return result.strings
      .filter((s) => s.confidence >= 0.7 && !s.isTechnical)
      .map((s) => toQualityIssue(s, file));
  } catch {
    // Silently skip files that can't be parsed
    return [];
  }
}
