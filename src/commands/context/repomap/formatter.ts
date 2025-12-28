/**
 * @module commands/context/repomap/formatter
 * @description Aider-style repo map formatter for Smart Context
 */

import type { RankedFile, RepoMapResult, Signature } from './types.js';

interface FormatOptions {
  /** Show line numbers */
  showLineNumbers?: boolean;
  /** Show rank scores */
  showScores?: boolean;
  /** Maximum signatures per file */
  maxSignaturesPerFile?: number;
  /** Output format */
  format?: 'tree' | 'flat' | 'xml';
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

    const limited = options.maxSignaturesPerFile
      ? fileSigs.slice(0, options.maxSignaturesPerFile)
      : fileSigs;

    lines.push(
      `  <file path="${path}" rank="${rank.toFixed(4)}" defs="${defCount}" refs="${refCount}">`,
    );

    for (const sig of limited) {
      const escapedText = sig.text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      lines.push(
        `    <${sig.type} name="${sig.name}" line="${sig.line}" exported="${sig.isExported}">${escapedText}</${sig.type}>`,
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
