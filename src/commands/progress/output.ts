/**
 * @module commands/progress/output
 * @description Output formatters for progress command
 */

import chalk from 'chalk';
import type { ProgressResult } from './index';

// ============================================================================
// TEXT OUTPUT
// ============================================================================

/**
 * Print progress to console
 */
export function printProgress(result: ProgressResult, projectName: string): string {
  const { summary, syncResult } = result;
  const lines: string[] = [];

  // Header
  lines.push('');
  lines.push(chalk.bold.cyan(`  Progress: ${projectName}`));
  lines.push(chalk.dim('  ─'.repeat(30)));

  // Tasks overview
  lines.push('');
  lines.push(chalk.bold('  Tasks'));
  lines.push(`    ${chalk.yellow('●')} In Progress: ${chalk.yellow(summary.tasks.inProgress)}`);
  lines.push(`    ${chalk.red('●')} Blocked:     ${chalk.red(summary.tasks.blocked)}`);
  lines.push(`    ${chalk.gray('○')} Backlog:     ${summary.tasks.backlog}`);
  lines.push(`    ${chalk.green('●')} Completed:   ${chalk.green(summary.tasks.done)}`);
  lines.push(`    ${chalk.dim('Total:')} ${summary.tasks.total}`);

  // Epics
  if (summary.epics.total > 0) {
    lines.push('');
    lines.push(chalk.bold('  Epics'));
    lines.push(`    Active:   ${summary.epics.active} / ${summary.epics.total}`);
    lines.push(`    Progress: ${formatProgressBar(summary.epics.averageProgress)}`);
  }

  // Current session
  if (summary.currentSession) {
    lines.push('');
    lines.push(chalk.bold('  Current Session'));
    lines.push(`    Started:  ${formatRelativeTime(summary.currentSession.startedAt)}`);
    lines.push(`    Worked:   ${summary.currentSession.tasksWorkedOn} tasks`);
    lines.push(`    Done:     ${summary.currentSession.tasksCompleted} tasks`);
  }

  // Weekly stats
  if (summary.weeklyStats.sessionsCount > 0) {
    lines.push('');
    lines.push(chalk.bold('  Last 7 Days'));
    lines.push(`    Sessions: ${summary.weeklyStats.sessionsCount}`);
    lines.push(`    Tasks:    ${summary.weeklyStats.tasksCompleted} completed`);
    lines.push(`    Commits:  ${summary.weeklyStats.commitsCount}`);
  }

  // Suggestions
  if (summary.suggestions.length > 0) {
    lines.push('');
    lines.push(chalk.bold('  Suggested Next'));
    for (const task of summary.suggestions.slice(0, 3)) {
      const priority = formatPriority(task.priority);
      const epic = task.epic ? chalk.dim(` [${task.epic}]`) : '';
      lines.push(`    ${priority} ${task.title}${epic}`);
    }
  }

  // Blockers
  if (summary.blockers.length > 0) {
    lines.push('');
    lines.push(chalk.bold.red('  Blockers'));
    for (const blocker of summary.blockers) {
      lines.push(`    ${chalk.red('✗')} ${blocker.title}`);
      lines.push(`      ${chalk.dim(blocker.blockedBy)}`);
    }
  }

  // Sync result
  if (syncResult) {
    lines.push('');
    lines.push(chalk.bold('  GitHub Sync'));
    if (syncResult.errors.length > 0) {
      lines.push(`    ${chalk.red('✗')} ${syncResult.errors[0]}`);
    } else {
      lines.push(`    ${chalk.green('✓')} Synced ${syncResult.synced} issues`);
      if (syncResult.created > 0) {
        lines.push(`      Created: ${syncResult.created}`);
      }
      if (syncResult.updated > 0) {
        lines.push(`      Updated: ${syncResult.updated}`);
      }
    }
  }

  lines.push('');
  return lines.join('\n');
}

// ============================================================================
// JSON OUTPUT
// ============================================================================

/**
 * Format as JSON
 */
export function formatJson(result: ProgressResult): string {
  return JSON.stringify(result, null, 2);
}

// ============================================================================
// MARKDOWN OUTPUT
// ============================================================================

/**
 * Format as Markdown
 */
export function formatMarkdown(result: ProgressResult, projectName: string): string {
  const { summary, syncResult } = result;
  const lines: string[] = [];

  lines.push(`# Progress: ${projectName}`);
  lines.push('');

  // Tasks
  lines.push('## Tasks');
  lines.push('');
  lines.push(`| Status | Count |`);
  lines.push(`|--------|-------|`);
  lines.push(`| In Progress | ${summary.tasks.inProgress} |`);
  lines.push(`| Blocked | ${summary.tasks.blocked} |`);
  lines.push(`| Backlog | ${summary.tasks.backlog} |`);
  lines.push(`| Completed | ${summary.tasks.done} |`);
  lines.push(`| **Total** | **${summary.tasks.total}** |`);
  lines.push('');

  // Epics
  if (summary.epics.total > 0) {
    lines.push('## Epics');
    lines.push('');
    lines.push(`- Active: ${summary.epics.active} / ${summary.epics.total}`);
    lines.push(`- Average Progress: ${summary.epics.averageProgress}%`);
    lines.push('');
  }

  // Current session
  if (summary.currentSession) {
    lines.push('## Current Session');
    lines.push('');
    lines.push(`- Started: ${summary.currentSession.startedAt}`);
    lines.push(`- Tasks worked on: ${summary.currentSession.tasksWorkedOn}`);
    lines.push(`- Tasks completed: ${summary.currentSession.tasksCompleted}`);
    lines.push('');
  }

  // Suggestions
  if (summary.suggestions.length > 0) {
    lines.push('## Suggested Next Tasks');
    lines.push('');
    for (const task of summary.suggestions) {
      const epic = task.epic ? ` (${task.epic})` : '';
      lines.push(`- [${task.priority}] ${task.title}${epic}`);
    }
    lines.push('');
  }

  // Blockers
  if (summary.blockers.length > 0) {
    lines.push('## Blocked Tasks');
    lines.push('');
    for (const blocker of summary.blockers) {
      lines.push(`- **${blocker.title}**`);
      lines.push(`  - Reason: ${blocker.blockedBy}`);
    }
    lines.push('');
  }

  // Sync result
  if (syncResult && syncResult.synced > 0) {
    lines.push('## GitHub Sync');
    lines.push('');
    lines.push(`- Synced: ${syncResult.synced} issues`);
    lines.push(`- Created: ${syncResult.created}`);
    lines.push(`- Updated: ${syncResult.updated}`);
    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================================
// AI OUTPUT
// ============================================================================

/**
 * Format as AI-friendly XML (delegated to lib)
 */
export function formatAI(_projectName: string): string {
  // This is handled by formatProgressContext in the lib
  return '';
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Format priority indicator
 */
function formatPriority(priority: string): string {
  switch (priority) {
    case 'critical':
      return chalk.red.bold('!!');
    case 'high':
      return chalk.yellow('! ');
    case 'medium':
      return chalk.blue('· ');
    case 'low':
      return chalk.dim('  ');
    default:
      return '  ';
  }
}

/**
 * Format progress bar
 */
function formatProgressBar(percent: number): string {
  const width = 20;
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;

  const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
  return `${bar} ${percent}%`;
}

/**
 * Format relative time
 */
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}
