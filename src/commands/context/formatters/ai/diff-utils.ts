/**
 * @module commands/context/formatters/ai/diff-utils
 * @description Smart diff truncation and filtering for AI context
 */

// Max lines to include in diff output
const MAX_DIFF_LINES = 500;

// File extension priorities (higher = more important)
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

interface DiffHunk {
  file: string;
  extension: string;
  priority: number;
  lines: string[];
  lineCount: number;
}

/**
 * Parse diff into file hunks
 */
function parseDiffHunks(diff: string): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  const lines = diff.split('\n');

  let currentHunk: DiffHunk | null = null;

  for (const line of lines) {
    // New file header: "diff --git a/path/file.ts b/path/file.ts"
    if (line.startsWith('diff --git')) {
      if (currentHunk) {
        hunks.push(currentHunk);
      }

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

  if (currentHunk) {
    hunks.push(currentHunk);
  }

  return hunks;
}

/**
 * Get file extension
 */
function getExtension(file: string): string {
  const match = file.match(/(\.[^.]+)$/);
  return match?.[1] ?? '';
}

/**
 * Filter hunks by domain keywords
 */
function filterByDomain(hunks: DiffHunk[], keywords: string[]): DiffHunk[] {
  if (keywords.length === 0) return hunks;

  return hunks.filter((hunk) => {
    const fileLower = hunk.file.toLowerCase();
    return keywords.some((k) => fileLower.includes(k.toLowerCase()));
  });
}

/**
 * Truncate diff intelligently
 */
export function truncateDiff(
  diff: string,
  keywords: string[] = [],
): { diff: string; truncated: boolean; summary: string } {
  if (!diff || diff.length === 0) {
    return { diff: '', truncated: false, summary: '' };
  }

  const totalLines = diff.split('\n').length;

  // If under limit, return as-is
  if (totalLines <= MAX_DIFF_LINES) {
    return { diff, truncated: false, summary: '' };
  }

  // Parse into hunks
  let hunks = parseDiffHunks(diff);

  // Filter by domain if keywords provided
  if (keywords.length > 0) {
    const filtered = filterByDomain(hunks, keywords);
    if (filtered.length > 0) {
      hunks = filtered;
    }
  }

  // Sort by priority (code first, docs last)
  hunks.sort((a, b) => b.priority - a.priority);

  // Collect hunks until we hit the limit
  const selectedHunks: DiffHunk[] = [];
  let currentLineCount = 0;
  const omittedFiles: string[] = [];

  for (const hunk of hunks) {
    if (currentLineCount + hunk.lineCount <= MAX_DIFF_LINES) {
      selectedHunks.push(hunk);
      currentLineCount += hunk.lineCount;
    } else {
      omittedFiles.push(hunk.file);
    }
  }

  // Build truncated diff
  const truncatedDiff = selectedHunks.map((h) => h.lines.join('\n')).join('\n');

  // Build summary
  const summary =
    omittedFiles.length > 0
      ? `(${omittedFiles.length} files omitted: ${omittedFiles.slice(0, 3).join(', ')}${omittedFiles.length > 3 ? '...' : ''})`
      : '';

  return {
    diff: truncatedDiff,
    truncated: true,
    summary,
  };
}
