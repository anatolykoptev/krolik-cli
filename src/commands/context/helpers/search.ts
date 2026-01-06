/**
 * @module commands/context/helpers/search
 * @description Search functionality for context command
 *
 * Provides code search using ripgrep (rg) or grep fallback.
 */

import { commandExists, execLines } from '../../../lib/@core/shell';
import type { SearchMatch, SearchResults } from '../types';

/** Max matches to return (for token budget) */
const MAX_MATCHES = 50;

/** Max line content length */
const MAX_LINE_LENGTH = 200;

/** File patterns to exclude from search */
const EXCLUDE_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'coverage',
  '*.min.js',
  '*.map',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
];

/**
 * Perform code search in project
 *
 * Uses ripgrep (rg) if available, falls back to grep.
 * Returns structured search results for AI context.
 */
export function searchInProject(projectRoot: string, pattern: string): SearchResults | undefined {
  if (!pattern || pattern.trim().length === 0) {
    return undefined;
  }

  const hasRipgrep = commandExists('rg');
  const matches = hasRipgrep
    ? searchWithRipgrep(projectRoot, pattern)
    : searchWithGrep(projectRoot, pattern);

  if (matches.length === 0) {
    return undefined;
  }

  // Count unique files
  const files = new Set(matches.map((m) => m.file));

  return {
    pattern,
    matchCount: matches.length,
    fileCount: files.size,
    matches: matches.slice(0, MAX_MATCHES),
  };
}

/**
 * Search using ripgrep (faster, better)
 */
function searchWithRipgrep(projectRoot: string, pattern: string): SearchMatch[] {
  // Build exclude arguments
  const excludeArgs = EXCLUDE_PATTERNS.map((p) => `-g '!${p}'`).join(' ');

  // rg outputs: file:line:content
  const command = `rg --no-heading --line-number --with-filename ${excludeArgs} -e '${escapePattern(pattern)}' . 2>/dev/null | head -n ${MAX_MATCHES * 2}`;

  const lines = execLines(command, { cwd: projectRoot, timeout: 10000 });

  return parseSearchOutput(lines, projectRoot);
}

/**
 * Search using grep (fallback)
 */
function searchWithGrep(projectRoot: string, pattern: string): SearchMatch[] {
  // Build exclude arguments for grep
  const excludeArgs = EXCLUDE_PATTERNS.map((p) => `--exclude-dir='${p}'`).join(' ');

  // grep outputs: file:line:content
  const command = `grep -rn ${excludeArgs} -e '${escapePattern(pattern)}' . 2>/dev/null | head -n ${MAX_MATCHES * 2}`;

  const lines = execLines(command, { cwd: projectRoot, timeout: 15000 });

  return parseSearchOutput(lines, projectRoot);
}

/**
 * Parse search output lines into structured matches
 */
function parseSearchOutput(lines: string[], _projectRoot: string): SearchMatch[] {
  const matches: SearchMatch[] = [];

  for (const line of lines) {
    // Format: ./file/path:lineNumber:content
    const match = line.match(/^\.?\/?(.*?):(\d+):(.*)$/);
    if (!match) continue;

    const [, file, lineNum, content] = match;
    if (!file || !lineNum || content === undefined) continue;

    // Truncate long lines
    const truncatedContent =
      content.length > MAX_LINE_LENGTH ? `${content.slice(0, MAX_LINE_LENGTH)}...` : content;

    matches.push({
      file: file.startsWith('./') ? file.slice(2) : file,
      line: parseInt(lineNum, 10),
      content: truncatedContent.trim(),
    });
  }

  return matches;
}

/**
 * Escape pattern for shell command
 */
function escapePattern(pattern: string): string {
  // Escape single quotes and special shell characters
  return pattern.replace(/'/g, "'\\''").replace(/[;&|<>()$`\\!]/g, '\\$&');
}
