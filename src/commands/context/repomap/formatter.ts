/**
 * @module commands/context/repomap/formatter
 * @description Aider-style repo map formatter for Smart Context
 *
 * Phase 9 improvements:
 * - Deduplicate signatures by name (re-exports shown once)
 * - Replace meaningless rank scores with semantic importance levels
 */

import type { RankedFile, RepoMapResult, Signature } from './types.js';

// ============================================================================
// TYPES
// ============================================================================

interface FormatOptions {
  /** Show line numbers */
  showLineNumbers?: boolean;
  /** Show rank scores (deprecated, use importance instead) */
  showScores?: boolean;
  /** Maximum signatures per file */
  maxSignaturesPerFile?: number;
  /** Output format */
  format?: 'tree' | 'flat' | 'xml';
}

/** Semantic importance level for files */
export type ImportanceLevel = 'critical' | 'high' | 'medium' | 'low';

// ============================================================================
// IMPORTANCE CALCULATION
// ============================================================================

/**
 * Calculate semantic importance level from rank and reference count
 *
 * Importance levels:
 * - critical: Entry points, heavily referenced core files
 * - high: Domain core types, frequently used utilities
 * - medium: Regular files with moderate usage
 * - low: Utilities, rarely referenced files
 *
 * @param rank - PageRank score (0-1)
 * @param refCount - Number of references to symbols in this file
 * @returns Semantic importance level
 */
export function calculateImportance(rank: number, refCount: number): ImportanceLevel {
  // Critical: very high rank OR very many references
  if (rank > 0.01 || refCount > 30) {
    return 'critical';
  }

  // High: significant rank OR many references
  if (rank > 0.005 || refCount > 15) {
    return 'high';
  }

  // Medium: moderate rank OR some references
  if (rank > 0.002 || refCount > 5) {
    return 'medium';
  }

  return 'low';
}

/**
 * Deduplicate signatures by name within a file
 *
 * When a symbol is re-exported multiple times (common with barrel exports),
 * only show it once to reduce noise. Preserves the highest-refs version
 * and sorts by refs descending for usage-based ordering.
 *
 * @param signatures - Array of signatures (may contain duplicates)
 * @returns Deduplicated signatures array, sorted by refs (most used first)
 */
export function deduplicateSignatures(signatures: Signature[]): Signature[] {
  const seen = new Map<string, Signature>();

  for (const sig of signatures) {
    const existing = seen.get(sig.name);
    // Keep the signature with higher refs, or first occurrence if same
    if (!existing || (sig.refs ?? 0) > (existing.refs ?? 0)) {
      seen.set(sig.name, sig);
    }
  }

  // Sort by refs (most used first), then by line number
  return Array.from(seen.values()).sort((a, b) => (b.refs ?? 0) - (a.refs ?? 0) || a.line - b.line);
}

/**
 * Format a single file's signatures
 */
function formatFileSignatures(
  filePath: string,
  signatures: Signature[],
  options: FormatOptions = {},
): string {
  const lines: string[] = [];

  lines.push(`${filePath}:`);

  for (const sig of signatures) {
    lines.push('⋮...');
    if (options.showLineNumbers) {
      lines.push(`│${sig.line}: ${sig.text}`);
    } else {
      lines.push(`│${sig.text}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format the complete repo map
 */
export function formatRepoMap(
  rankedFiles: RankedFile[],
  signatures: Map<string, Signature[]>,
  options: FormatOptions = {},
): string {
  const sections: string[] = [];

  for (const { path, rank } of rankedFiles) {
    const fileSigs = signatures.get(path) || [];
    if (fileSigs.length === 0) continue;

    const limited = options.maxSignaturesPerFile
      ? fileSigs.slice(0, options.maxSignaturesPerFile)
      : fileSigs;

    let header = path;
    if (options.showScores) {
      header = `${path} (rank: ${rank.toFixed(4)})`;
    }

    sections.push(formatFileSignatures(header, limited, options));
  }

  return sections.join('\n\n');
}

/**
 * Format as XML for AI consumption
 *
 * Phase 9 improvements:
 * - Deduplicates signatures by name (avoids showing re-exports twice)
 * - Uses semantic importance instead of raw rank scores
 *
 * @example Output:
 * ```xml
 * <repo-map>
 *   <file path="src/booking/types.ts" importance="high" defs="16" refs="39">
 *     <type name="Booking" line="5">type Booking</type>
 *   </file>
 * </repo-map>
 * ```
 */
export function formatRepoMapXml(
  rankedFiles: RankedFile[],
  signatures: Map<string, Signature[]>,
  options: FormatOptions = {},
): string {
  const lines: string[] = ['<repo-map>'];

  for (const { path, rank, defCount, refCount } of rankedFiles) {
    const fileSigs = signatures.get(path) || [];
    if (fileSigs.length === 0) continue;

    // Phase 9.1: Deduplicate signatures by name
    const dedupedSigs = deduplicateSignatures(fileSigs);

    const limited = options.maxSignaturesPerFile
      ? dedupedSigs.slice(0, options.maxSignaturesPerFile)
      : dedupedSigs;

    // Phase 9.2: Use semantic importance instead of raw rank
    const importance = calculateImportance(rank, refCount);

    lines.push(
      `  <file path="${path}" importance="${importance}" defs="${defCount}" refs="${refCount}">`,
    );

    for (const sig of limited) {
      const escapedText = sig.text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      lines.push(
        `    <${sig.type} name="${sig.name}" line="${sig.line}">${escapedText}</${sig.type}>`,
      );
    }

    lines.push('  </file>');
  }

  lines.push('</repo-map>');
  return lines.join('\n');
}

/**
 * Format stats summary
 */
export function formatStats(stats: RepoMapResult['stats']): string {
  return [
    `Files ranked: ${stats.filesRanked}`,
    `Files included: ${stats.filesIncluded}`,
    `Tokens used: ${stats.tokensUsed}`,
    `Build time: ${stats.buildTimeMs}ms`,
    `Top files: ${stats.topFiles.slice(0, 5).join(', ')}`,
  ].join('\n');
}
