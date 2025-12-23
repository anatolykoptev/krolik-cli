import type { RefineResult, DirectoryInfo, NamespaceCategory } from '../types';
import { NAMESPACE_INFO } from '../analyzer';

// ============================================================================
// HELPERS
// ============================================================================

function groupByCategory(directories: DirectoryInfo[]): Map<NamespaceCategory, DirectoryInfo[]> {
  const map = new Map<NamespaceCategory, DirectoryInfo[]>();
  for (const dir of directories) {
    const existing = map.get(dir.category) || [];
    existing.push(dir);
    map.set(dir.category, existing);
  }
  return map;
}

// ============================================================================
// FORMATTERS
// ============================================================================

export function formatJson(result: RefineResult): string {
  return JSON.stringify(result, null, 2);
}

export function formatMarkdown(result: RefineResult): string {
  if (!result.libDir) {
    return '# Error\n\nNo lib directory found in project.';
  }

  const lines: string[] = [
    '# Namespace Structure Analysis',
    '',
    `**Project:** \`${result.projectRoot}\``,
    `**Lib directory:** \`${result.libDir}\``,
    `**Generated:** ${result.timestamp}`,
    '',
    '## Current Structure',
    '',
  ];

  // Group by category
  const byCategory = groupByCategory(result.directories);

  for (const [category, dirs] of byCategory) {
    const info = NAMESPACE_INFO[category];

    lines.push(`### @${category}`);
    lines.push('');
    lines.push(`> ${info.description}`);
    lines.push('');
    lines.push('| Directory | Status | Files | Subdirs |');
    lines.push('|-----------|--------|-------|---------|');

    for (const dir of dirs) {
      const status = dir.isNamespaced ? '✅ Namespaced' : '⚠️ Needs migration';
      const subdirs = dir.subdirs.length > 0 ? dir.subdirs.join(', ') : '-';
      lines.push(`| ${dir.name} | ${status} | ${dir.fileCount} | ${subdirs} |`);
    }

    lines.push('');
  }

  // Unknown
  const unknown = result.directories.filter(d => d.category === 'unknown');
  if (unknown.length > 0) {
    lines.push('### Uncategorized');
    lines.push('');
    lines.push('| Directory | Files |');
    lines.push('|-----------|-------|');

    for (const dir of unknown) {
      lines.push(`| ${dir.name} | ${dir.fileCount} |`);
    }

    lines.push('');
  }

  // Migration plan
  if (result.plan.moves.length > 0) {
    lines.push('## Migration Plan');
    lines.push('');
    lines.push('| From | To | Reason |');
    lines.push('|------|----|---------');

    for (const move of result.plan.moves) {
      lines.push(`| ${move.from}/ | ${move.to}/ | ${move.reason} |`);
    }

    lines.push('');
  }

  // Score
  lines.push('## Organization Score');
  lines.push('');
  lines.push(`- **Current:** ${result.currentScore}%`);
  lines.push(`- **Potential:** ${result.suggestedScore}%`);
  lines.push('');

  if (result.suggestedScore > result.currentScore) {
    lines.push('Run `krolik refine --apply` to reorganize structure.');
  } else {
    lines.push('✅ Structure is already optimized!');
  }

  return lines.join('\n');
}
