/**
 * @module commands/refine/output
 * @description Output formatters for refine command
 */

import type { Logger } from '../../types';
import type { RefineResult, DirectoryInfo, NamespaceCategory } from './types';
import { NAMESPACE_INFO } from './analyzer';

// ============================================================================
// CONSOLE OUTPUT
// ============================================================================

/**
 * Print analysis summary to console
 */
export function printRefineAnalysis(result: RefineResult, logger: Logger): void {
  if (!result.libDir) {
    logger.error('No lib directory found in project');
    logger.info('Expected locations: lib/, src/lib/, apps/web/lib/');
    return;
  }

  // Header
  logger.section('Namespace Structure Analysis');
  logger.info(`Project: ${result.projectRoot}`);
  logger.info(`Lib dir: ${result.libDir}`);
  logger.info('');

  // Current structure
  logger.section('Current Structure');

  // Group by category
  const byCategory = groupByCategory(result.directories);

  for (const [category, dirs] of byCategory) {
    const info = NAMESPACE_INFO[category];
    const icon = getCategoryIcon(category);

    logger.info(`${icon} @${category} — ${info.description}`);

    for (const dir of dirs) {
      const status = dir.isNamespaced ? '✓' : '○';
      const name = dir.isNamespaced ? dir.name : `${dir.name} → @${category}/@${dir.name}`;
      logger.info(`   ${status} ${name} (${dir.fileCount} files)`);
    }
    logger.info('');
  }

  // Unknown directories
  const unknown = result.directories.filter(d => d.category === 'unknown');
  if (unknown.length > 0) {
    logger.info('❓ Uncategorized');
    for (const dir of unknown) {
      logger.info(`   ○ ${dir.name} (${dir.fileCount} files)`);
    }
    logger.info('');
  }

  // Score
  printScore(result, logger);
}

/**
 * Print organization score
 */
export function printScore(result: RefineResult, logger: Logger): void {
  logger.section('Organization Score');

  const { currentScore, suggestedScore } = result;
  const bar = createProgressBar(currentScore);

  logger.info(`Current:   ${bar} ${currentScore}%`);

  if (suggestedScore > currentScore) {
    const suggestedBar = createProgressBar(suggestedScore);
    logger.info(`Potential: ${suggestedBar} ${suggestedScore}%`);
    logger.info('');
    logger.info(`Run with --apply to reorganize structure`);
  } else {
    logger.success('Structure is already optimized!');
  }
}

/**
 * Create ASCII progress bar
 */
function createProgressBar(percent: number): string {
  const filled = Math.round(percent / 5);
  const empty = 20 - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
}

/**
 * Get emoji icon for category
 */
function getCategoryIcon(category: NamespaceCategory): string {
  const icons: Record<NamespaceCategory, string> = {
    core: '🔧',
    domain: '📦',
    integrations: '🔌',
    ui: '🎨',
    utils: '🛠️',
    seo: '🔍',
    unknown: '❓',
  };
  return icons[category];
}

/**
 * Group directories by category
 */
function groupByCategory(
  directories: DirectoryInfo[],
): Map<NamespaceCategory, DirectoryInfo[]> {
  const result = new Map<NamespaceCategory, DirectoryInfo[]>();

  for (const dir of directories) {
    if (dir.category === 'unknown') continue;

    if (!result.has(dir.category)) {
      result.set(dir.category, []);
    }
    result.get(dir.category)!.push(dir);
  }

  return result;
}

// ============================================================================
// JSON OUTPUT
// ============================================================================

/**
 * Format result as JSON
 */
export function formatJson(result: RefineResult): string {
  return JSON.stringify(result, null, 2);
}

// ============================================================================
// MARKDOWN OUTPUT
// ============================================================================

/**
 * Format result as Markdown
 */
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

// ============================================================================
// SUMMARY OUTPUT
// ============================================================================

/**
 * Print brief summary (for non-verbose mode)
 */
export function printSummary(result: RefineResult, logger: Logger): void {
  if (!result.libDir) {
    logger.error('No lib directory found');
    return;
  }

  const namespaced = result.directories.filter(d => d.isNamespaced).length;
  const total = result.directories.length;

  logger.info(`Directories: ${total} total, ${namespaced} namespaced`);
  logger.info(`Score: ${result.currentScore}%`);

  if (result.plan.moves.length > 0) {
    logger.info(`Migrations available: ${result.plan.moves.length}`);
    logger.info(`Run with --dry-run to preview or --apply to execute`);
  }
}
