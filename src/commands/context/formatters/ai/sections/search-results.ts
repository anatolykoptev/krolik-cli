/**
 * @module commands/context/formatters/ai/sections/search-results
 * @description Search results section formatter
 *
 * Formats code search results for AI context.
 * Shows matching files and code snippets.
 */

import type { AiContextData } from '../../../types';
import { escapeXml } from '../helpers';

/**
 * Format search-results section
 */
export function formatSearchResultsSection(lines: string[], data: AiContextData): void {
  const { searchResults } = data;
  if (!searchResults || searchResults.matches.length === 0) return;

  lines.push(
    `  <search-results pattern="${escapeXml(searchResults.pattern)}" files="${searchResults.fileCount}" matches="${searchResults.matchCount}">`,
  );

  // Group matches by file for better readability
  const byFile = new Map<string, Array<{ line: number; content: string }>>();
  for (const match of searchResults.matches) {
    if (!byFile.has(match.file)) {
      byFile.set(match.file, []);
    }
    byFile.get(match.file)?.push({ line: match.line, content: match.content });
  }

  for (const [file, matches] of byFile) {
    lines.push(`    <file path="${escapeXml(file)}">`);
    for (const match of matches) {
      lines.push(`      <match line="${match.line}">${escapeXml(match.content)}</match>`);
    }
    lines.push('    </file>');
  }

  if (searchResults.matchCount > searchResults.matches.length) {
    lines.push(
      `    <!-- +${searchResults.matchCount - searchResults.matches.length} more matches (truncated for token budget) -->`,
    );
  }

  lines.push('  </search-results>');
}
