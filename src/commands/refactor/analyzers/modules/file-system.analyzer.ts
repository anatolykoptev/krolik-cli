/**
 * @module commands/refactor/analyzers/modules/file-system.analyzer
 * @description File System Health Analyzer for the registry-based architecture
 *
 * Detects filesystem hygiene issues that clutter the repository:
 * - Backup files (.bak, .orig, ~)
 * - Temporary files (.tmp, .swp)
 * - Editor artifacts
 *
 * These files should be deleted and added to .gitignore.
 *
 * @example
 * ```typescript
 * import { fileSystemAnalyzer } from './modules/file-system.analyzer';
 * import { analyzerRegistry } from '../registry';
 *
 * // Register the analyzer
 * analyzerRegistry.register(fileSystemAnalyzer);
 *
 * // Run with context
 * const results = await analyzerRegistry.runAll(ctx);
 * const fsResult = results.get('file-system');
 * ```
 */

import * as path from 'node:path';
import { findFiles } from '../../../../lib/@core/fs';
import type { Analyzer } from '../registry';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Type of file system issue detected
 */
export type FileSystemIssueType = 'backup-file' | 'temp-file' | 'editor-artifact';

/**
 * A file system hygiene issue
 */
export interface FileSystemIssue {
  /** Type of issue */
  type: FileSystemIssueType;
  /** Relative file path from project root */
  file: string;
  /** Pattern that matched this file */
  pattern: string;
  /** Suggested .gitignore entry */
  gitignoreEntry: string;
  /** Human-readable suggestion */
  suggestion: string;
}

/**
 * File system analysis result
 */
export interface FileSystemAnalysis {
  /** All issues found */
  issues: FileSystemIssue[];
  /** Issues grouped by type */
  byType: {
    'backup-file': FileSystemIssue[];
    'temp-file': FileSystemIssue[];
    'editor-artifact': FileSystemIssue[];
  };
  /** Unique .gitignore entries to add */
  suggestedGitignore: string[];
  /** Summary counts */
  summary: {
    total: number;
    backupFiles: number;
    tempFiles: number;
    editorArtifacts: number;
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Patterns for detecting problematic files
 *
 * Each pattern includes:
 * - regex: Pattern to match against file paths
 * - type: Category of the issue
 * - gitignore: Suggested .gitignore entry
 */
const BAD_FILE_PATTERNS: Array<{
  pattern: RegExp;
  type: FileSystemIssueType;
  gitignore: string;
  description: string;
}> = [
  // Backup files
  {
    pattern: /\.bak$/i,
    type: 'backup-file',
    gitignore: '*.bak',
    description: 'backup file',
  },
  {
    pattern: /\.orig$/i,
    type: 'backup-file',
    gitignore: '*.orig',
    description: 'original file from merge/patch',
  },
  {
    pattern: /~$/,
    type: 'backup-file',
    gitignore: '*~',
    description: 'editor backup file',
  },
  {
    pattern: /\.backup$/i,
    type: 'backup-file',
    gitignore: '*.backup',
    description: 'backup file',
  },
  {
    pattern: /\.old$/i,
    type: 'backup-file',
    gitignore: '*.old',
    description: 'old version file',
  },

  // Temporary files
  {
    pattern: /\.tmp$/i,
    type: 'temp-file',
    gitignore: '*.tmp',
    description: 'temporary file',
  },
  {
    pattern: /\.temp$/i,
    type: 'temp-file',
    gitignore: '*.temp',
    description: 'temporary file',
  },
  {
    pattern: /\.swp$/i,
    type: 'temp-file',
    gitignore: '*.swp',
    description: 'Vim swap file',
  },
  {
    pattern: /\.swo$/i,
    type: 'temp-file',
    gitignore: '*.swo',
    description: 'Vim swap file',
  },

  // Editor artifacts
  {
    pattern: /\.DS_Store$/,
    type: 'editor-artifact',
    gitignore: '.DS_Store',
    description: 'macOS folder metadata',
  },
  {
    pattern: /Thumbs\.db$/i,
    type: 'editor-artifact',
    gitignore: 'Thumbs.db',
    description: 'Windows thumbnail cache',
  },
  {
    pattern: /desktop\.ini$/i,
    type: 'editor-artifact',
    gitignore: 'desktop.ini',
    description: 'Windows folder settings',
  },
];

/**
 * Directories to skip during file system scan
 * These contain expected artifacts and should not trigger warnings
 */
const SKIP_DIRS = ['node_modules', 'dist', '.next', '.git', 'build', '.turbo', 'coverage', '.pnpm'];

// ============================================================================
// FILE SYSTEM ANALYZER
// ============================================================================

/**
 * Analyzer for detecting file system hygiene issues.
 *
 * Scans the entire project (not just source files) to find:
 * - Backup files that should be deleted
 * - Temporary files left by editors
 * - OS-specific artifacts
 *
 * Features:
 * - Fast scanning (no AST parsing needed)
 * - Suggests .gitignore entries
 * - Groups issues by type for easier remediation
 */
export const fileSystemAnalyzer: Analyzer<FileSystemAnalysis> = {
  metadata: {
    id: 'file-system',
    name: 'File System Health',
    description: 'Detects backup files, temp files, and suggests .gitignore updates',
    defaultEnabled: true,
    // No dependencies - independent analyzer
  },

  /**
   * Determines if the analyzer should run.
   *
   * Always runs unless explicitly disabled.
   *
   * @param ctx - The analyzer context
   * @returns true unless explicitly disabled
   */
  shouldRun(ctx) {
    return ctx.options.includeFileSystem !== false;
  },

  /**
   * Scans the project for file system hygiene issues.
   *
   * @param ctx - The analyzer context
   * @returns Promise resolving to the analysis result
   */
  async analyze(ctx) {
    const { projectRoot } = ctx;
    const issues: FileSystemIssue[] = [];
    const gitignoreEntries = new Set<string>();

    try {
      // Find ALL files (no extension filter) to catch backup/temp files
      const allFiles = findFiles(projectRoot, {
        // No extensions = all files
        skipDirs: SKIP_DIRS,
      });

      for (const filePath of allFiles) {
        const relativePath = path.relative(projectRoot, filePath);

        // Check against all bad file patterns
        for (const { pattern, type, gitignore, description } of BAD_FILE_PATTERNS) {
          if (pattern.test(relativePath)) {
            issues.push({
              type,
              file: relativePath,
              pattern: pattern.source,
              gitignoreEntry: gitignore,
              suggestion: `Delete ${description} and add "${gitignore}" to .gitignore`,
            });
            gitignoreEntries.add(gitignore);
            // Only match first pattern per file
            break;
          }
        }
      }

      // Group issues by type
      const byType: FileSystemAnalysis['byType'] = {
        'backup-file': [],
        'temp-file': [],
        'editor-artifact': [],
      };

      for (const issue of issues) {
        byType[issue.type].push(issue);
      }

      return {
        status: 'success',
        data: {
          issues,
          byType,
          suggestedGitignore: [...gitignoreEntries].sort(),
          summary: {
            total: issues.length,
            backupFiles: byType['backup-file'].length,
            tempFiles: byType['temp-file'].length,
            editorArtifacts: byType['editor-artifact'].length,
          },
        },
      };
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error scanning file system',
      };
    }
  },
};
