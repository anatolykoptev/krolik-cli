/**
 * @module lib/@storage/progress
 * @description Progress tracking: tasks, epics, sessions
 *
 * Architecture:
 * - tasks.ts - Task CRUD with automatic epic stats
 * - epics.ts - Epic CRUD with progress tracking
 * - sessions.ts - AI session tracking with auto-summary
 * - github-sync.ts - GitHub issue synchronization
 * - types.ts - Type definitions
 */

// Epics
export {
  completeEpic,
  createEpic,
  deleteEpic,
  getActiveEpics,
  getEpicById,
  getEpicByName,
  getEpicsByProject,
  getEpicsSummary,
  getOrCreateEpic,
  holdEpic,
  recalculateAllEpicStats,
  rowToEpic,
  startEpic,
  updateEpic,
} from './epics';

// GitHub sync
export {
  createGitHubIssue,
  fetchGitHubIssue,
  fetchGitHubIssues,
  type GitHubIssue,
  getRepoInfo,
  isGitHubAvailable,
  type SyncResult,
  syncGitHubIssue,
  syncGitHubIssues,
  syncIssueToTask,
  updateGitHubIssue,
} from './github-sync';

// Sessions
export {
  addCommitToSession,
  addFileToSession,
  addMemoryToSession,
  addTaskToSession,
  cleanupOldSessions,
  completeTaskInSession,
  deleteSession,
  endSession,
  getActiveSession,
  getOrCreateActiveSession,
  getRecentSessions,
  getSessionById,
  getSessionStats,
  getSessionsByDateRange,
  rowToSession,
  startSession,
  updateSession,
} from './sessions';

// Tasks
export {
  blockTask,
  completeTask,
  createTask,
  deleteTask,
  getBlockedTasks,
  getInProgressTasks,
  getRecentlyCompletedTasks,
  getSuggestedTasks,
  getTaskByExternalId,
  getTaskById,
  getTasksByEpic,
  getTasksByProject,
  linkMemoryToTask,
  rowToTask,
  startTask,
  unblockTask,
  updateTask,
  upsertTask,
} from './tasks';

// Types
export type {
  Epic,
  EpicCreateOptions,
  EpicRow,
  EpicStatus,
  EpicUpdateOptions,
  ProgressSummary,
  Session,
  SessionCreateOptions,
  SessionRow,
  SessionUpdateOptions,
  Task,
  TaskCreateOptions,
  TaskPriority,
  TaskRow,
  TaskSource,
  TaskStatus,
  TaskUpdateOptions,
} from './types';

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

import { escapeXml } from '@/lib/@format/xml/escape';
import { getEpicsSummary } from './epics';
import { getActiveSession, getSessionStats, startSession } from './sessions';
import { getBlockedTasks, getInProgressTasks, getSuggestedTasks, getTasksByProject } from './tasks';
import type { ProgressSummary } from './types';

/**
 * Get full progress summary for AI context injection
 */
export function getProgressSummary(project: string): ProgressSummary {
  const allTasks = getTasksByProject(project);
  const inProgress = getInProgressTasks(project);
  const blocked = getBlockedTasks(project);
  const suggested = getSuggestedTasks(project, 5);
  const epicsSummary = getEpicsSummary(project);
  const activeSession = getActiveSession(project);
  const stats = getSessionStats(project, 7);

  return {
    tasks: {
      total: allTasks.length,
      inProgress: inProgress.length,
      blocked: blocked.length,
      done: allTasks.filter((t) => t.status === 'done').length,
      backlog: allTasks.filter((t) => t.status === 'backlog').length,
    },
    epics: {
      total: epicsSummary.total,
      active: epicsSummary.active,
      completed: epicsSummary.completed,
      averageProgress: epicsSummary.averageProgress,
    },
    currentSession: activeSession
      ? {
          id: activeSession.id,
          startedAt: activeSession.startedAt,
          tasksWorkedOn: activeSession.tasksWorkedOn.length,
          tasksCompleted: activeSession.tasksCompleted.length,
        }
      : undefined,
    weeklyStats: {
      sessionsCount: stats.totalSessions,
      tasksCompleted: stats.totalTasksCompleted,
      commitsCount: stats.totalCommits,
      averageSessionMinutes: stats.averageDurationMinutes,
    },
    suggestions: suggested.map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      epic: t.epic,
    })),
    blockers: blocked.map((t) => ({
      id: t.id,
      title: t.title,
      blockedBy: t.blockedBy ?? 'Unknown',
    })),
  };
}

/**
 * Format progress summary as XML for AI context
 */
export function formatProgressContext(project: string): string {
  const summary = getProgressSummary(project);
  const lines: string[] = [];

  lines.push('<progress-context>');

  // Tasks overview
  lines.push('  <tasks>');
  lines.push(`    <total>${summary.tasks.total}</total>`);
  lines.push(`    <in-progress>${summary.tasks.inProgress}</in-progress>`);
  lines.push(`    <blocked>${summary.tasks.blocked}</blocked>`);
  lines.push(`    <completed>${summary.tasks.done}</completed>`);
  lines.push(`    <backlog>${summary.tasks.backlog}</backlog>`);
  lines.push('  </tasks>');

  // Epics overview
  lines.push('  <epics>');
  lines.push(`    <total>${summary.epics.total}</total>`);
  lines.push(`    <active>${summary.epics.active}</active>`);
  lines.push(`    <average-progress>${summary.epics.averageProgress}%</average-progress>`);
  lines.push('  </epics>');

  // Current session
  if (summary.currentSession) {
    lines.push('  <current-session>');
    lines.push(`    <started>${summary.currentSession.startedAt}</started>`);
    lines.push(`    <tasks-worked-on>${summary.currentSession.tasksWorkedOn}</tasks-worked-on>`);
    lines.push(`    <tasks-completed>${summary.currentSession.tasksCompleted}</tasks-completed>`);
    lines.push('  </current-session>');
  }

  // Suggestions
  if (summary.suggestions.length > 0) {
    lines.push('  <suggested-tasks>');
    for (const task of summary.suggestions) {
      lines.push(
        `    <task priority="${task.priority}"${task.epic ? ` epic="${task.epic}"` : ''}>`,
      );
      lines.push(`      ${escapeXml(task.title)}`);
      lines.push('    </task>');
    }
    lines.push('  </suggested-tasks>');
  }

  // Blockers
  if (summary.blockers.length > 0) {
    lines.push('  <blockers>');
    for (const blocker of summary.blockers) {
      lines.push(`    <blocked-task reason="${escapeXml(blocker.blockedBy)}">`);
      lines.push(`      ${escapeXml(blocker.title)}`);
      lines.push('    </blocked-task>');
    }
    lines.push('  </blockers>');
  }

  lines.push('</progress-context>');
  return lines.join('\n');
}

/**
 * Ensure active session exists, create if needed
 */
export function ensureActiveSession(project: string): string {
  const active = getActiveSession(project);
  if (active) {
    return active.id;
  }
  return startSession({ project });
}
