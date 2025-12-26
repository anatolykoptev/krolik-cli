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

// Files/patterns to always exclude from diff (noise)
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
 * Check if file matches any noise pattern
 */
function isNoiseFile(file: string): boolean {
  const fileLower = file.toLowerCase();
  return NOISE_PATTERNS.some((pattern) => {
    // Handle glob-like patterns
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(fileLower);
    }
    return fileLower.includes(pattern.toLowerCase());
  });
}

/**
 * Filter out noise files
 */
function filterNoise(hunks: DiffHunk[]): DiffHunk[] {
  return hunks.filter((hunk) => !isNoiseFile(hunk.file));
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

/** Result of applying filters to diff hunks */
interface FilterResult {
  hunks: DiffHunk[];
  noiseFiltered: number;
}

/**
 * Apply noise and domain filters to hunks
 */
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

/**
 * Select hunks that fit within line limit
 */
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

/**
 * Build summary string from filter results
 */
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

/**
 * Truncate diff intelligently with noise filtering
 */
export function truncateDiff(
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
