/**
 * @module commands/context/formatters/ai/sections/task-git
 * @description Task, Git, Tree, and Diff section formatters
 *
 * Includes smart diff truncation with noise filtering (previously in diff-utils.ts)
 */

import { MAX_DIFF_LINES } from '@/lib/@format';
import type { AiContextData } from '../../../types';
import { escapeXml, MAX_ITEMS_MEDIUM, MAX_ITEMS_SMALL, truncate } from '../helpers';

// ============================================================================
// DIFF UTILITIES (tightly coupled with Git section)
// ============================================================================

/** File extension priorities (higher = more important) */
const EXTENSION_PRIORITY: Record<string, number> = {
  '.ts': 10,
  '.tsx': 10,
  '.js': 9,
  '.jsx': 9,
  '.json': 5,
  '.yaml': 5,
  '.yml': 5,
  '.md': 2,
  '.txt': 1,
};

/** Files/patterns to always exclude from diff (noise) */
const NOISE_PATTERNS = [
  '.krolik/',
  'krolik.config',
  'CLAUDE.md',
  '.lock',
  'pnpm-lock',
  'package-lock',
  'yarn.lock',
  '.env',
  '.git/',
  'node_modules/',
  'dist/',
  '.next/',
  '.turbo/',
  'coverage/',
  '*.log',
  '.DS_Store',
  'typecheck-cache',
  'audit-data.json',
  'AI-REPORT.md',
];

interface DiffHunk {
  file: string;
  extension: string;
  priority: number;
  lines: string[];
  lineCount: number;
}

/** Get file extension */
function getExtension(file: string): string {
  const match = file.match(/(\.[^.]+)$/);
  return match?.[1] ?? '';
}

/** Parse diff into file hunks */
function parseDiffHunks(diff: string): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  const lines = diff.split('\n');
  let currentHunk: DiffHunk | null = null;

  for (const line of lines) {
    if (line.startsWith('diff --git')) {
      if (currentHunk) hunks.push(currentHunk);

      const match = line.match(/diff --git a\/(.+?) b\//);
      const file = match?.[1] ?? 'unknown';
      const ext = getExtension(file);

      currentHunk = {
        file,
        extension: ext,
        priority: EXTENSION_PRIORITY[ext] ?? 3,
        lines: [line],
        lineCount: 1,
      };
    } else if (currentHunk) {
      currentHunk.lines.push(line);
      currentHunk.lineCount++;
    }
  }

  if (currentHunk) hunks.push(currentHunk);
  return hunks;
}

/** Check if file matches any noise pattern */
function isNoiseFile(file: string): boolean {
  const fileLower = file.toLowerCase();
  return NOISE_PATTERNS.some((pattern) => {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(fileLower);
    }
    return fileLower.includes(pattern.toLowerCase());
  });
}

/** Filter out noise files */
function filterNoise(hunks: DiffHunk[]): DiffHunk[] {
  return hunks.filter((hunk) => !isNoiseFile(hunk.file));
}

/** Filter hunks by domain keywords */
function filterByDomain(hunks: DiffHunk[], keywords: string[]): DiffHunk[] {
  if (keywords.length === 0) return hunks;
  return hunks.filter((hunk) => {
    const fileLower = hunk.file.toLowerCase();
    return keywords.some((k) => fileLower.includes(k.toLowerCase()));
  });
}

interface FilterResult {
  hunks: DiffHunk[];
  noiseFiltered: number;
}

/** Apply noise and domain filters to hunks */
function applyFilters(hunks: DiffHunk[], keywords: string[]): FilterResult {
  const originalCount = hunks.length;
  let filtered = filterNoise(hunks);
  const noiseFiltered = originalCount - filtered.length;

  if (keywords.length > 0 && filtered.length > 0) {
    const domainFiltered = filterByDomain(filtered, keywords);
    if (domainFiltered.length > 0) {
      filtered = domainFiltered;
    }
  }

  return { hunks: filtered, noiseFiltered };
}

/** Select hunks that fit within line limit */
function selectHunksWithinLimit(hunks: DiffHunk[]): { selected: DiffHunk[]; omitted: string[] } {
  const selected: DiffHunk[] = [];
  const omitted: string[] = [];
  let currentLineCount = 0;

  for (const hunk of hunks) {
    if (currentLineCount + hunk.lineCount <= MAX_DIFF_LINES) {
      selected.push(hunk);
      currentLineCount += hunk.lineCount;
    } else {
      omitted.push(hunk.file);
    }
  }

  return { selected, omitted };
}

/** Build summary string from filter results */
function buildSummary(noiseFiltered: number, omittedFiles: string[]): string {
  const parts: string[] = [];
  if (noiseFiltered > 0) {
    parts.push(`${noiseFiltered} noise files filtered`);
  }
  if (omittedFiles.length > 0) {
    const preview = omittedFiles.slice(0, 3).join(', ');
    const suffix = omittedFiles.length > 3 ? '...' : '';
    parts.push(`${omittedFiles.length} files omitted: ${preview}${suffix}`);
  }
  return parts.length > 0 ? `(${parts.join(', ')})` : '';
}

/** Truncate diff intelligently with noise filtering */
function truncateDiff(
  diff: string,
  keywords: string[] = [],
): { diff: string; truncated: boolean; summary: string } {
  if (!diff || diff.length === 0) {
    return { diff: '', truncated: false, summary: '' };
  }

  const originalHunks = parseDiffHunks(diff);
  const { hunks, noiseFiltered } = applyFilters(originalHunks, keywords);

  if (hunks.length === 0) {
    const summary = noiseFiltered > 0 ? `(${noiseFiltered} noise files filtered)` : '';
    return { diff: '', truncated: true, summary };
  }

  hunks.sort((a, b) => b.priority - a.priority);
  const totalLines = hunks.reduce((sum, h) => sum + h.lineCount, 0);

  if (totalLines <= MAX_DIFF_LINES) {
    const filteredDiff = hunks.map((h) => h.lines.join('\n')).join('\n');
    const wasFiltered = noiseFiltered > 0 || hunks.length < originalHunks.length;
    return {
      diff: filteredDiff,
      truncated: wasFiltered,
      summary: noiseFiltered > 0 ? `(${noiseFiltered} noise files filtered)` : '',
    };
  }

  const { selected, omitted } = selectHunksWithinLimit(hunks);
  const truncatedDiff = selected.map((h) => h.lines.join('\n')).join('\n');

  return {
    diff: truncatedDiff,
    truncated: true,
    summary: buildSummary(noiseFiltered, omitted),
  };
}

// ============================================================================
// TASK SECTION
// ============================================================================

/** Format task section */
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

/** Format issue subsection */
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

// ============================================================================
// GIT SECTION
// ============================================================================

/** Format git section */
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

/** Format changed files */
function formatChangedFiles(lines: string[], git: NonNullable<AiContextData['git']>): void {
  if (git.changedFiles.length === 0) return;

  const extra = git.changedFiles.length > 10 ? `, +${git.changedFiles.length - 10} more` : '';
  lines.push(
    `    <changed count="${git.changedFiles.length}">${git.changedFiles.slice(0, 10).join(', ')}${extra}</changed>`,
  );
}

/** Format staged files */
function formatStagedFiles(lines: string[], git: NonNullable<AiContextData['git']>): void {
  if (git.stagedFiles.length === 0) return;

  lines.push(
    `    <staged count="${git.stagedFiles.length}">${git.stagedFiles.slice(0, MAX_ITEMS_MEDIUM).join(', ')}</staged>`,
  );
}

/** Format untracked files */
function formatUntrackedFiles(lines: string[], git: NonNullable<AiContextData['git']>): void {
  if (git.untrackedFiles.length === 0) return;

  lines.push(
    `    <untracked count="${git.untrackedFiles.length}">${git.untrackedFiles.slice(0, MAX_ITEMS_MEDIUM).join(', ')}</untracked>`,
  );
}

/** Format recent commits */
function formatRecentCommits(lines: string[], git: NonNullable<AiContextData['git']>): void {
  if (!git.recentCommits || git.recentCommits.length === 0) return;

  lines.push('    <recent-commits>');
  for (const commit of git.recentCommits.slice(0, MAX_ITEMS_SMALL)) {
    lines.push(`      <commit>${escapeXml(commit)}</commit>`);
  }
  lines.push('    </recent-commits>');
}

/** Format diff section with smart truncation */
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

// ============================================================================
// TREE SECTION
// ============================================================================

/** Parse tree structure to extract top-level directories with file counts */
function parseTopLevelDirs(structure: string): Array<{ name: string; fileCount: number }> {
  const lines = structure.split('\n');
  const result: Array<{ name: string; fileCount: number }> = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const dirMatch = line.match(/^[├└]── (.+)\/$/);
    if (dirMatch && dirMatch[1]) {
      const dirName = dirMatch[1];
      let fileCount = 0;

      for (let j = i + 1; j < lines.length; j++) {
        const subLine = lines[j];
        if (!subLine) continue;

        if (!subLine.startsWith('│') && !subLine.startsWith(' ')) {
          break;
        }

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

/** Extract unique parent directories from changed files */
function extractChangedDirs(changedFiles: string[]): string[] {
  const dirs = new Set<string>();

  for (const file of changedFiles) {
    const parts = file.split('/');
    if (parts.length >= 2) {
      const dirPath = `${parts.slice(0, Math.min(3, parts.length - 1)).join('/')}/`;
      dirs.add(dirPath);
    }
  }

  return [...dirs].sort();
}

/**
 * Format project tree section - smart compact format
 * Reduces ~1600 tokens to ~400 tokens
 */
export function formatTreeSection(lines: string[], data: AiContextData): void {
  const { tree, git } = data;
  if (!tree) return;

  const MAX_LINES = 20;
  const topLevelDirs = parseTopLevelDirs(tree.structure);
  const changedDirs = git?.changedFiles ? extractChangedDirs(git.changedFiles) : [];

  const totalItems = topLevelDirs.length + changedDirs.length;
  const truncated = totalItems > MAX_LINES;
  const truncAttr = truncated ? ' truncated="true"' : '';

  lines.push(`  <project-tree files="${tree.totalFiles}" dirs="${tree.totalDirs}"${truncAttr}>`);

  if (topLevelDirs.length > 0) {
    lines.push('    <top-level>');
    const maxTopLevel = Math.min(topLevelDirs.length, MAX_LINES - 2);
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

  if (changedDirs.length > 0) {
    lines.push('    <changed hint="Directories with recent changes">');
    const remainingLines = MAX_LINES - (topLevelDirs.length + 4);
    const maxChanged = Math.max(Math.min(changedDirs.length, remainingLines), 3);
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

// ============================================================================
// GITHUB ISSUES SECTION
// ============================================================================

/** Format GitHub issues section */
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
