/**
 * @module commands/refactor/output/sections/file-system.section
 * @description File system health section for refactor output
 *
 * Shows file system issues that should be addressed:
 * - Backup files (.bak, .tmp, .swp, ~, .orig)
 * - Temp files that shouldn't be committed
 * - Suggestions for .gitignore updates
 *
 * Helps maintain a clean repository structure.
 */

import { escapeXml } from '../../../../lib/@format';
import type { Section, SectionContext } from '../registry';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Type of file system issue
 */
type FileSystemIssueType = 'backup-file' | 'temp-file';

/**
 * Single file system issue
 */
interface FileSystemIssue {
  type: FileSystemIssueType;
  file: string;
  suggestion: string;
}

/**
 * Analysis result from file-system analyzer
 */
interface FileSystemAnalysis {
  issues: FileSystemIssue[];
  summary: {
    backupFiles: number;
    tempFiles: number;
  };
  gitignoreSuggestions: string[];
}

// ============================================================================
// SECTION DEFINITION
// ============================================================================

/**
 * File system health section
 *
 * Renders file system issues like backup files and temp files
 * that shouldn't be in the repository.
 *
 * Output format:
 * ```xml
 * <file-system issues="N">
 *   <backup-file>path/to/file.bak</backup-file>
 *   <temp-file>path/to/file.tmp</temp-file>
 *   <suggestion>Add "*.bak" to .gitignore</suggestion>
 * </file-system>
 * ```
 */
export const fileSystemSection: Section = {
  metadata: {
    id: 'file-system',
    name: 'File System Health',
    description: 'Shows backup files, temp files, and gitignore suggestions',
    order: 68, // After dead-code at 67
    requires: ['file-system'],
    showWhen: 'has-issues',
  },

  shouldRender(ctx: SectionContext): boolean {
    const result = ctx.results.get('file-system');
    if (result?.status === 'skipped') return false;
    if (result?.status === 'error') return true;

    const data = result?.data as FileSystemAnalysis | undefined;
    return !!data && data.issues.length > 0;
  },

  render(lines: string[], ctx: SectionContext): void {
    const result = ctx.results.get('file-system');

    // Handle error case
    if (result?.status === 'error') {
      lines.push('  <file-system status="error">');
      lines.push(`    <error>${escapeXml(result.error ?? 'Unknown error')}</error>`);
      lines.push('  </file-system>');
      lines.push('');
      return;
    }

    const data = result?.data as FileSystemAnalysis | undefined;

    // Handle no data
    if (!data) {
      lines.push('  <file-system status="no-data" />');
      lines.push('');
      return;
    }

    // No issues found
    if (data.issues.length === 0) {
      lines.push('  <!-- File system: no issues found -->');
      lines.push('  <file-system issues="0" status="clean" />');
      lines.push('');
      return;
    }

    // Group issues by type
    const backupFiles = data.issues.filter((i) => i.type === 'backup-file');
    const tempFiles = data.issues.filter((i) => i.type === 'temp-file');

    // Normal rendering with issues
    lines.push('  <!-- FILE SYSTEM - Files that should be removed from repository -->');
    lines.push(`  <file-system issues="${data.issues.length}">`);

    // Render backup files
    if (backupFiles.length > 0) {
      lines.push('    <!-- BACKUP FILES: Should be deleted and added to .gitignore -->');
      for (const issue of backupFiles.slice(0, 20)) {
        lines.push(`    <backup-file>${escapeXml(issue.file)}</backup-file>`);
      }
      if (backupFiles.length > 20) {
        lines.push(`    <!-- +${backupFiles.length - 20} more backup files -->`);
      }
    }

    // Render temp files
    if (tempFiles.length > 0) {
      lines.push('    <!-- TEMP FILES: Should be deleted and added to .gitignore -->');
      for (const issue of tempFiles.slice(0, 10)) {
        lines.push(`    <temp-file>${escapeXml(issue.file)}</temp-file>`);
      }
      if (tempFiles.length > 10) {
        lines.push(`    <!-- +${tempFiles.length - 10} more temp files -->`);
      }
    }

    // Render gitignore suggestions
    const suggestions = data.gitignoreSuggestions ?? [];
    if (suggestions.length > 0) {
      lines.push('    <!-- GITIGNORE SUGGESTIONS -->');
      for (const suggestion of suggestions) {
        lines.push(`    <suggestion>${escapeXml(suggestion)}</suggestion>`);
      }
    } else if (data.issues.length > 0) {
      // Generate suggestions based on issues found
      const uniqueSuggestions: string[] = [];
      const seen = new Map<string, boolean>();
      for (const issue of data.issues) {
        if (!seen.has(issue.suggestion)) {
          seen.set(issue.suggestion, true);
          uniqueSuggestions.push(issue.suggestion);
        }
      }
      if (uniqueSuggestions.length > 0) {
        lines.push('    <!-- GITIGNORE SUGGESTIONS -->');
        for (const suggestion of uniqueSuggestions) {
          lines.push(`    <suggestion>${escapeXml(suggestion)}</suggestion>`);
        }
      }
    }

    lines.push('  </file-system>');
    lines.push('');
  },
};
