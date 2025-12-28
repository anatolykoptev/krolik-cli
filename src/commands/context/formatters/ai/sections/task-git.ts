/**
 * @module commands/context/formatters/ai/sections/task-git
 * @description Task, Git, and Tree section formatters
 */

import type { AiContextData } from '../../../types';
import { truncateDiff } from '../diff-utils';
import { escapeXml, MAX_ITEMS_MEDIUM, MAX_ITEMS_SMALL, truncate } from '../helpers';

/**
 * Format task section
 */
export function formatTaskSection(lines: string[], data: AiContextData): void {
  const { context } = data;

  lines.push('  <task>');
  lines.push(`    <title>${escapeXml(context.task)}</title>`);
  lines.push(`    <domains>${context.domains.join(', ')}</domains>`);

  if (context.issue) {
    formatIssue(lines, context.issue);
  }

  lines.push('  </task>');
}

/**
 * Format issue subsection
 */
function formatIssue(lines: string[], issue: NonNullable<AiContextData['context']['issue']>): void {
  lines.push(`    <issue number="${issue.number}">`);
  lines.push(`      <title>${escapeXml(issue.title)}</title>`);

  if (issue.body) {
    lines.push(`      <body>${escapeXml(truncate(issue.body, 1000))}</body>`);
  }

  if (issue.labels.length > 0) {
    lines.push(`      <labels>${issue.labels.join(', ')}</labels>`);
  }

  lines.push('    </issue>');
}

/**
 * Format git section
 */
export function formatGitSection(lines: string[], data: AiContextData): void {
  const { git, context } = data;
  if (!git) return;

  lines.push('  <git>');
  lines.push(`    <branch>${git.branch}</branch>`);

  formatChangedFiles(lines, git);
  formatStagedFiles(lines, git);
  formatUntrackedFiles(lines, git);
  formatRecentCommits(lines, git);
  formatDiffSection(lines, git, context.domains);

  lines.push('  </git>');
}

/**
 * Format changed files
 */
function formatChangedFiles(lines: string[], git: NonNullable<AiContextData['git']>): void {
  if (git.changedFiles.length === 0) return;

  const extra = git.changedFiles.length > 10 ? `, +${git.changedFiles.length - 10} more` : '';
  lines.push(
    `    <changed count="${git.changedFiles.length}">${git.changedFiles.slice(0, 10).join(', ')}${extra}</changed>`,
  );
}

/**
 * Format staged files
 */
function formatStagedFiles(lines: string[], git: NonNullable<AiContextData['git']>): void {
  if (git.stagedFiles.length === 0) return;

  lines.push(
    `    <staged count="${git.stagedFiles.length}">${git.stagedFiles.slice(0, MAX_ITEMS_MEDIUM).join(', ')}</staged>`,
  );
}

/**
 * Format untracked files
 */
function formatUntrackedFiles(lines: string[], git: NonNullable<AiContextData['git']>): void {
  if (git.untrackedFiles.length === 0) return;

  lines.push(
    `    <untracked count="${git.untrackedFiles.length}">${git.untrackedFiles.slice(0, MAX_ITEMS_MEDIUM).join(', ')}</untracked>`,
  );
}

/**
 * Format recent commits
 */
function formatRecentCommits(lines: string[], git: NonNullable<AiContextData['git']>): void {
  if (!git.recentCommits || git.recentCommits.length === 0) return;

  lines.push('    <recent-commits>');
  for (const commit of git.recentCommits.slice(0, MAX_ITEMS_SMALL)) {
    lines.push(`      <commit>${escapeXml(commit)}</commit>`);
  }
  lines.push('    </recent-commits>');
}

/**
 * Format diff section with smart truncation
 */
function formatDiffSection(
  lines: string[],
  git: NonNullable<AiContextData['git']>,
  domains: string[],
): void {
  if (!git.diff || git.diff.length === 0) return;

  const { diff, truncated, summary } = truncateDiff(git.diff, domains);
  const diffLineCount = diff.split('\n').length;
  const originalLines = git.diff.split('\n').length;

  const truncAttr = truncated ? ` truncated="true" original="${originalLines}"` : '';
  lines.push(`    <diff lines="${diffLineCount}"${truncAttr}>`);
  lines.push('      <![CDATA[');
  lines.push(diff);
  if (summary) {
    lines.push(`\n${summary}`);
  }
  lines.push('      ]]>');
  lines.push('    </diff>');
}

/**
 * Parse tree structure to extract top-level directories with file counts
 */
function parseTopLevelDirs(structure: string): Array<{ name: string; fileCount: number }> {
  const lines = structure.split('\n');
  const result: Array<{ name: string; fileCount: number }> = [];

  // Skip first line (project root)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Match top-level directories (with ├── or └── prefix, followed by directory name/)
    const dirMatch = line.match(/^[├└]── (.+)\/$/);
    if (dirMatch && dirMatch[1]) {
      const dirName = dirMatch[1];
      let fileCount = 0;

      // Scan subsequent lines at deeper levels to count files
      for (let j = i + 1; j < lines.length; j++) {
        const subLine = lines[j];
        if (!subLine) continue;

        // Check if we're still inside this directory (has │ or spaces prefix)
        if (!subLine.startsWith('│') && !subLine.startsWith(' ')) {
          break;
        }

        // Match file count patterns like "(50 files: .ts, .tsx)"
        const fileCountMatch = subLine.match(/\((\d+) files?:/);
        if (fileCountMatch && fileCountMatch[1]) {
          fileCount += parseInt(fileCountMatch[1], 10);
        }
      }

      result.push({ name: dirName, fileCount });
    }
  }

  return result;
}

/**
 * Extract unique parent directories from changed files
 */
function extractChangedDirs(changedFiles: string[]): string[] {
  const dirs = new Set<string>();

  for (const file of changedFiles) {
    // Extract parent directory path (2 levels deep for better context)
    const parts = file.split('/');
    if (parts.length >= 2) {
      // Take up to 3 parts for meaningful path (e.g., "src/commands/context/")
      const dirPath = `${parts.slice(0, Math.min(3, parts.length - 1)).join('/')}/`;
      dirs.add(dirPath);
    }
  }

  return [...dirs].sort();
}

/**
 * Format project tree section - smart compact format
 * Reduces ~1600 tokens to ~400 tokens by showing only:
 * 1. Top-level directories with file counts
 * 2. Changed file directories (from git)
 * 3. Truncated after 20 lines
 */
export function formatTreeSection(lines: string[], data: AiContextData): void {
  const { tree, git } = data;
  if (!tree) return;

  const MAX_LINES = 20;
  const topLevelDirs = parseTopLevelDirs(tree.structure);
  const changedDirs = git?.changedFiles ? extractChangedDirs(git.changedFiles) : [];

  // Check if we need truncation
  const totalItems = topLevelDirs.length + changedDirs.length;
  const truncated = totalItems > MAX_LINES;
  const truncAttr = truncated ? ' truncated="true"' : '';

  lines.push(`  <project-tree files="${tree.totalFiles}" dirs="${tree.totalDirs}"${truncAttr}>`);

  // Top-level directories section
  if (topLevelDirs.length > 0) {
    lines.push('    <top-level>');
    const maxTopLevel = Math.min(topLevelDirs.length, MAX_LINES - 2); // Reserve space for changed
    for (let i = 0; i < maxTopLevel; i++) {
      const dir = topLevelDirs[i];
      if (dir) {
        const fileStr = dir.fileCount > 0 ? ` (${dir.fileCount} files)` : '';
        lines.push(`      ${dir.name}/${fileStr}`);
      }
    }
    if (topLevelDirs.length > maxTopLevel) {
      lines.push(`      ... +${topLevelDirs.length - maxTopLevel} more directories`);
    }
    lines.push('    </top-level>');
  }

  // Changed directories section (only if git data available)
  if (changedDirs.length > 0) {
    lines.push('    <changed hint="Directories with recent changes">');
    const remainingLines = MAX_LINES - (topLevelDirs.length + 4); // Account for XML tags
    const maxChanged = Math.max(Math.min(changedDirs.length, remainingLines), 3); // At least 3
    for (let i = 0; i < maxChanged; i++) {
      const dir = changedDirs[i];
      if (dir) {
        lines.push(`      ${dir}`);
      }
    }
    if (changedDirs.length > maxChanged) {
      lines.push(`      ... +${changedDirs.length - maxChanged} more`);
    }
    lines.push('    </changed>');
  }

  lines.push('  </project-tree>');
}

/**
 * Format GitHub issues section
 */
export function formatGitHubIssuesSection(lines: string[], data: AiContextData): void {
  const { githubIssues } = data;
  if (!githubIssues || githubIssues.count === 0) return;

  lines.push(`  <github-issues count="${githubIssues.count}" source="${githubIssues.source}">`);

  for (const issue of githubIssues.issues.slice(0, MAX_ITEMS_MEDIUM)) {
    const labelsAttr = issue.labels.length > 0 ? ` labels="${issue.labels.join(',')}"` : '';
    lines.push(`    <issue number="${issue.number}" state="${issue.state}"${labelsAttr}>`);
    lines.push(`      <title>${escapeXml(issue.title)}</title>`);
    lines.push('    </issue>');
  }

  if (githubIssues.count > MAX_ITEMS_MEDIUM) {
    lines.push(`    <!-- ${githubIssues.count - MAX_ITEMS_MEDIUM} more issues available -->`);
  }

  lines.push('  </github-issues>');
}
