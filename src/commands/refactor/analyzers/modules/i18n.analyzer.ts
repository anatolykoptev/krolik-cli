/**
 * @module commands/refactor/analyzers/modules/i18n.analyzer
 * @description I18n Analyzer for the registry-based architecture
 *
 * Hybrid detection strategy:
 * 1. Uses i18next-cli API for comprehensive AST-based detection (if config exists)
 * 2. Falls back to regex-based Russian text detection
 *
 * @example
 * ```typescript
 * import { i18nAnalyzer } from './modules/i18n.analyzer';
 * import { analyzerRegistry } from '../registry';
 *
 * analyzerRegistry.register(i18nAnalyzer);
 * const results = await analyzerRegistry.runAll(ctx);
 * ```
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { findFiles } from '../../../../lib/@core';
import { detectHardcodedStrings, hasRussianText } from '../../../../lib/@i18n';
import type { Analyzer, AnalyzerResult } from '../registry';
import type { FileI18nInfo, I18nAnalysisResult } from './i18n.types';

// Re-export types for backwards compatibility
export type { FileI18nInfo, I18nAnalysisResult } from './i18n.types';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Extensions that contain JSX/TSX content */
const JSX_EXTENSIONS = ['.tsx', '.jsx'];

/** Patterns to extract text from */
const TEXT_PATTERNS = [
  />([^<>{]+)</g, // JSX text content
  /(\w+)=["']([^"']+)["']/g, // JSX attributes
  /["']([^"']{2,})["']/g, // String literals
];

/** Directories to skip */
const SKIP_DIRS = ['node_modules', 'dist', '.next', 'build', 'coverage', '__tests__', '.git'];

// ============================================================================
// I18NEXT-CLI INTEGRATION
// ============================================================================

/**
 * Try to detect hardcoded strings using i18next-cli API
 * Returns null if i18next-cli detection fails or no config found
 */
async function tryI18nextCliDetection(projectRoot: string): Promise<I18nAnalysisResult | null> {
  try {
    const result = await detectHardcodedStrings(projectRoot);

    if (!result.success || result.issues.length === 0) {
      return null;
    }

    // Group issues by file
    const fileMap = new Map<string, { count: number; lines: number[] }>();

    for (const issue of result.issues) {
      const relPath = path.relative(projectRoot, issue.file);
      const existing = fileMap.get(relPath) ?? { count: 0, lines: [] };
      existing.count++;
      existing.lines.push(issue.line);
      fileMap.set(relPath, existing);
    }

    // Convert to FileI18nInfo array
    const files: FileI18nInfo[] = [];
    for (const [file, data] of fileMap) {
      files.push({
        file,
        count: data.count,
        lines: [...new Set(data.lines)].sort((a, b) => a - b),
      });
    }

    // Sort by count (highest first)
    files.sort((a, b) => b.count - a.count);

    return {
      files,
      totalStrings: result.issues.length,
      totalFiles: files.length,
      timestamp: new Date().toISOString(),
    };
  } catch {
    // i18next-cli detection failed, fall back to regex
    return null;
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Analyze a single file for hardcoded Russian text
 */
function analyzeFile(filePath: string): FileI18nInfo | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const russianLines: number[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      // Skip comments
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

      // Check each pattern
      for (const pattern of TEXT_PATTERNS) {
        pattern.lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = pattern.exec(line)) !== null) {
          const text = match[2] ?? match[1];
          if (text && hasRussianText(text.trim())) {
            russianLines.push(i + 1);
            break; // Found Russian text on this line, move to next line
          }
        }
      }
    }

    if (russianLines.length === 0) return null;

    return {
      file: filePath,
      count: russianLines.length,
      lines: [...new Set(russianLines)], // Deduplicate
    };
  } catch {
    return null;
  }
}

// ============================================================================
// I18N ANALYZER
// ============================================================================

/**
 * Analyzer for detecting hardcoded i18n strings.
 *
 * This analyzer scans TSX/JSX files for hardcoded Russian text.
 * It provides file-level statistics useful for prioritizing i18n work.
 *
 * For full text extraction, use i18next-cli instead.
 */
export const i18nAnalyzer: Analyzer<I18nAnalysisResult> = {
  metadata: {
    id: 'i18n',
    name: 'I18n Hardcoded Strings',
    description: 'Detects hardcoded Russian text in React components',
    defaultEnabled: true,
    cliFlag: '--include-i18n',
  },

  shouldRun(ctx) {
    // Check if explicitly disabled
    if (ctx.options.includeI18n === false) {
      return false;
    }

    // Skip in quick mode
    if (ctx.options.quickMode === true) {
      return false;
    }

    // Check if there are any JSX/TSX files to analyze
    const jsxFiles = findFiles(ctx.targetPath, {
      extensions: JSX_EXTENSIONS,
      skipDirs: SKIP_DIRS,
    });

    return jsxFiles.length > 0;
  },

  async analyze(ctx): Promise<AnalyzerResult<I18nAnalysisResult>> {
    try {
      // Strategy 1: Try i18next-cli API first (more accurate)
      const i18nextResult = await tryI18nextCliDetection(ctx.projectRoot);
      if (i18nextResult) {
        return {
          status: 'success',
          data: i18nextResult,
        };
      }

      // Strategy 2: Fall back to regex-based detection
      const jsxFiles = findFiles(ctx.targetPath, {
        extensions: JSX_EXTENSIONS,
        skipDirs: SKIP_DIRS,
      });

      const files: FileI18nInfo[] = [];
      let totalStrings = 0;

      for (const file of jsxFiles) {
        const result = analyzeFile(file);
        if (result) {
          files.push({
            file: path.relative(ctx.projectRoot, result.file),
            count: result.count,
            lines: result.lines,
          });
          totalStrings += result.count;
        }
      }

      // Sort by count (highest first)
      files.sort((a, b) => b.count - a.count);

      return {
        status: 'success',
        data: {
          files,
          totalStrings,
          totalFiles: files.length,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      ctx.logger?.warn?.(`I18n analysis failed: ${errorMessage}`);

      return {
        status: 'error',
        error: errorMessage,
      };
    }
  },
};
