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

// ============================================================================
// ENHANCED OUTPUT (with context, arch health, standards)
// ============================================================================

/**
 * Print full enhanced analysis
 */
export function printEnhancedAnalysis(result: RefineResult, logger: Logger): void {
  // Print basic analysis first
  printRefineAnalysis(result, logger);

  // Print project context
  if (result.context) {
    printProjectContext(result, logger);
  }

  // Print architecture health
  if (result.archHealth) {
    printArchHealth(result, logger);
  }

  // Print standards compliance
  if (result.standards) {
    printStandards(result, logger);
  }

  // Print AI navigation
  if (result.aiNavigation) {
    printAiNavigation(result, logger);
  }
}

/**
 * Print project context section
 */
function printProjectContext(result: RefineResult, logger: Logger): void {
  const ctx = result.context!;

  logger.section('Project Context');

  logger.info(`Type:      ${getProjectTypeLabel(ctx.type)}`);
  logger.info(`Name:      ${ctx.name}`);
  logger.info(`Framework: ${ctx.techStack.framework || 'none'}`);
  logger.info(`Runtime:   ${ctx.techStack.runtime}`);
  logger.info(`Language:  ${ctx.techStack.language}`);

  if (ctx.techStack.ui) {
    logger.info(`UI:        ${ctx.techStack.ui}`);
  }

  if (ctx.techStack.database.length > 0) {
    logger.info(`Database:  ${ctx.techStack.database.join(', ')}`);
  }

  if (ctx.techStack.stateManagement.length > 0) {
    logger.info(`State:     ${ctx.techStack.stateManagement.join(', ')}`);
  }

  if (ctx.techStack.styling.length > 0) {
    logger.info(`Styling:   ${ctx.techStack.styling.join(', ')}`);
  }

  if (ctx.techStack.testing.length > 0) {
    logger.info(`Testing:   ${ctx.techStack.testing.join(', ')}`);
  }

  if (ctx.importAlias) {
    logger.info(`Alias:     ${ctx.importAlias}/`);
  }

  logger.info('');
}

function getProjectTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    cli: '🖥️  CLI Tool',
    'web-app': '🌐 Web Application',
    api: '⚡ API Service',
    library: '📚 Library',
    monorepo: '🏗️  Monorepo',
    mobile: '📱 Mobile App',
    unknown: '❓ Unknown',
  };
  return labels[type] || type;
}

/**
 * Print architecture health section
 */
function printArchHealth(result: RefineResult, logger: Logger): void {
  const health = result.archHealth!;

  logger.section('Architecture Health');

  const healthBar = createProgressBar(health.score);
  const healthIcon = health.score >= 80 ? '✅' : health.score >= 50 ? '⚠️' : '❌';

  logger.info(`Score: ${healthBar} ${health.score}% ${healthIcon}`);
  logger.info('');

  // Dependency graph
  if (Object.keys(health.dependencyGraph).length > 0) {
    logger.info('Dependencies:');
    for (const [ns, deps] of Object.entries(health.dependencyGraph)) {
      if (deps.length > 0) {
        logger.info(`  ${ns} → ${deps.join(', ')}`);
      } else {
        logger.info(`  ${ns} (no dependencies)`);
      }
    }
    logger.info('');
  }

  // Violations
  if (health.violations.length > 0) {
    logger.info('Violations:');
    for (const v of health.violations) {
      const icon = v.severity === 'error' ? '❌' : v.severity === 'warning' ? '⚠️' : 'ℹ️';
      logger.info(`  ${icon} ${v.message}`);
      logger.info(`     Fix: ${v.fix}`);
    }
    logger.info('');
  } else {
    logger.success('No architecture violations found!');
    logger.info('');
  }
}

/**
 * Print standards compliance section
 */
function printStandards(result: RefineResult, logger: Logger): void {
  const standards = result.standards!;

  logger.section('Standards Compliance');

  const bar = createProgressBar(standards.score);
  const icon = standards.score >= 80 ? '✅' : standards.score >= 50 ? '⚠️' : '❌';

  logger.info(`Overall: ${bar} ${standards.score}% ${icon}`);
  logger.info('');

  // Category scores
  logger.info('Categories:');
  logger.info(`  Structure:     ${createMiniBar(standards.categories.structure)} ${standards.categories.structure}%`);
  logger.info(`  Naming:        ${createMiniBar(standards.categories.naming)} ${standards.categories.naming}%`);
  logger.info(`  Dependencies:  ${createMiniBar(standards.categories.dependencies)} ${standards.categories.dependencies}%`);
  logger.info(`  Documentation: ${createMiniBar(standards.categories.documentation)} ${standards.categories.documentation}%`);
  logger.info('');

  // Failed checks
  const failed = standards.checks.filter(c => !c.passed);
  if (failed.length > 0) {
    logger.info('Issues:');
    for (const check of failed) {
      const fixable = check.autoFixable ? ' [auto-fixable]' : '';
      logger.info(`  ○ ${check.name}${fixable}`);
      logger.info(`    ${check.details}`);
    }
    logger.info('');
  }
}

function createMiniBar(percent: number): string {
  const filled = Math.round(percent / 10);
  const empty = 10 - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
}

/**
 * Print AI navigation hints
 */
function printAiNavigation(result: RefineResult, logger: Logger): void {
  const nav = result.aiNavigation!;

  logger.section('AI Navigation Guide');

  logger.info('Where to add new code:');
  logger.info(`  Server logic:   ${nav.addNewCode.serverLogic}`);
  logger.info(`  Client hook:    ${nav.addNewCode.clientHook}`);
  logger.info(`  Utility:        ${nav.addNewCode.utility}`);
  logger.info(`  Constant:       ${nav.addNewCode.constant}`);
  logger.info(`  Integration:    ${nav.addNewCode.integration}`);
  logger.info(`  Component:      ${nav.addNewCode.component}`);
  logger.info(`  API route:      ${nav.addNewCode.apiRoute}`);
  logger.info(`  Test:           ${nav.addNewCode.test}`);
  logger.info('');

  logger.info('Import conventions:');
  logger.info(`  Absolute imports: ${nav.importConventions.absoluteImports ? 'Yes' : 'No'}`);
  if (nav.importConventions.alias) {
    logger.info(`  Alias: ${nav.importConventions.alias}/`);
  }
  logger.info(`  Barrel exports: ${nav.importConventions.barrelExports ? 'Yes' : 'No'}`);
  logger.info('');

  logger.info('Naming conventions:');
  logger.info(`  Files:      ${nav.namingConventions.files}`);
  logger.info(`  Components: ${nav.namingConventions.components}`);
  logger.info(`  Hooks:      ${nav.namingConventions.hooks}`);
  logger.info(`  Utilities:  ${nav.namingConventions.utilities}`);
  logger.info(`  Constants:  ${nav.namingConventions.constants}`);
  logger.info(`  Types:      ${nav.namingConventions.types}`);
  logger.info('');
}
