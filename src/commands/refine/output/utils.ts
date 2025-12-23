import type { Logger } from '../../../types';
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
  return icons[category] || '📁';
}

function createProgressBar(percent: number, width = 20): string {
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
}

function printProjectContext(result: RefineResult, logger: Logger): void {
  logger.section('Project Context');
  if (result.context) {
    logger.info(`Type: ${result.context.type || 'unknown'}`);
  }
}

function printArchHealth(result: RefineResult, logger: Logger): void {
  logger.section('Architecture Health');
  if (result.archHealth) {
    logger.info(`Score: ${result.archHealth.score || 0}%`);
  }
}

function printStandards(result: RefineResult, logger: Logger): void {
  logger.section('Standards Compliance');
  if (result.standards) {
    logger.info(`Compliance: ${result.standards.score || 0}%`);
  }
}

function printAiNavigation(result: RefineResult, logger: Logger): void {
  logger.section('AI Navigation');
  if (result.aiNavigation) {
    logger.info('AI-friendly structure detected');
  }
}

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

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
