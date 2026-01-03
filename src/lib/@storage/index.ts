/**
 * @module lib/@storage
 * @description Unified SQLite-based storage system
 *
 * This module provides persistent storage for:
 * - Memory system (AI context, decisions, patterns, bugfixes)
 * - Documentation cache (Context7 library docs with FTS5 search)
 *
 * Structure:
 * - database.ts - Shared SQLite database with migrations
 * - memory/ - Memory storage operations
 * - docs/ - Documentation cache operations
 */

// Audit history storage
export {
  // Types
  type AuditHistoryEntry,
  type AuditHistoryRow,
  type AuditTrend,
  // CRUD
  calculateTrend,
  clearProjectHistory,
  getAllAudits,
  getAuditHistory,
  getLatestAudit,
  getPreviousAudit,
  getProjectSummary,
  getTotalAuditCount,
  type LegacyAuditHistory,
  type LegacyAuditHistoryEntry,
  type ProjectAuditSummary,
  saveAuditEntry,
} from './audit';
// Shared database
export {
  clearStatementCache,
  closeDatabase,
  getDatabase,
  getDatabasePath,
  getDatabaseStats,
  prepareStatement,
} from './database';
// Docs cache storage
export {
  // Types
  type CachedLibrary,
  // Cache management
  clearExpired,
  type DocSearchResult,
  type DocSection,
  type DocsCacheStats,
  type DocsSearchOptions,
  deleteLibrary,
  // Constants
  getExpirationEpoch,
  // Library operations
  getLibrary,
  getLibraryByName,
  // Section operations
  getSectionsByLibrary,
  getStats,
  listLibraries,
  // Converters
  rowToLibrary,
  rowToSection,
  saveLibrary,
  saveSection,
  // Search operations
  searchDocs,
  TTL_DAYS,
} from './docs';
// Memory storage
export {
  // Constants
  BM25_RELEVANCE_MULTIPLIER,
  DEFAULT_IMPORTANCE,
  DEFAULT_SEARCH_LIMIT,
  FEATURE_FALLBACK_RELEVANCE,
  // CRUD
  getById,
  getProjects,
  HIGH_IMPORTANCE_LEVELS,
  LIKE_MATCH_RELEVANCE,
  // Types
  type Memory,
  type MemoryContext,
  type MemoryImportance,
  type MemorySaveOptions,
  type MemorySearchOptions,
  type MemorySearchResult,
  type MemoryStats,
  type MemoryType,
  recent,
  remove,
  // Converters
  rowToMemory,
  save,
  search,
  searchByFeatures,
  searchWithLike,
  stats,
  update,
} from './memory';
// Progress tracking (tasks, epics, sessions)
export {
  // Sessions
  addCommitToSession,
  addFileToSession,
  addMemoryToSession,
  addTaskToSession,
  // Tasks
  blockTask,
  cleanupOldSessions,
  // Epics
  completeEpic,
  completeTask,
  completeTaskInSession,
  createEpic,
  // GitHub sync
  createGitHubIssue,
  createTask,
  deleteEpic,
  deleteSession,
  deleteTask,
  // Types
  type Epic,
  type EpicCreateOptions,
  type EpicRow,
  type EpicStatus,
  type EpicUpdateOptions,
  endSession,
  ensureActiveSession,
  fetchGitHubIssue,
  fetchGitHubIssues,
  formatProgressContext,
  type GitHubIssue,
  getActiveEpics,
  getActiveSession,
  getBlockedTasks,
  getEpicById,
  getEpicByName,
  getEpicsByProject,
  getEpicsSummary,
  getInProgressTasks,
  getOrCreateActiveSession,
  getOrCreateEpic,
  getProgressSummary,
  getRecentlyCompletedTasks,
  getRecentSessions,
  getRepoInfo,
  getSessionById,
  getSessionStats,
  getSessionsByDateRange,
  getSuggestedTasks,
  getTaskByExternalId,
  getTaskById,
  getTasksByEpic,
  getTasksByProject,
  holdEpic,
  isGitHubAvailable,
  linkMemoryToTask,
  type ProgressSummary,
  recalculateAllEpicStats,
  rowToEpic,
  rowToSession,
  rowToTask,
  type Session,
  type SessionCreateOptions,
  type SessionRow,
  type SessionUpdateOptions,
  type SyncResult,
  startEpic,
  startSession,
  startTask,
  syncGitHubIssue,
  syncGitHubIssues,
  syncIssueToTask,
  type Task,
  type TaskCreateOptions,
  type TaskPriority,
  type TaskRow,
  type TaskSource,
  type TaskStatus,
  type TaskUpdateOptions,
  unblockTask,
  updateEpic,
  updateGitHubIssue,
  updateSession,
  updateTask,
  upsertTask,
} from './progress';
