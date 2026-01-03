/**
 * @module lib/@storage/progress/types
 * @description Types for task/epic progress tracking
 */

// ============================================================================
// TASK TYPES
// ============================================================================

/**
 * Task source - where the task came from
 */
export type TaskSource = 'github' | 'local' | 'ai-generated';

/**
 * Task status
 */
export type TaskStatus = 'backlog' | 'in_progress' | 'blocked' | 'done' | 'cancelled';

/**
 * Task priority (aligned with memory importance)
 */
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * Task record
 */
export interface Task {
  id: number;
  /** Source of the task */
  source: TaskSource;
  /** External ID (GitHub issue number) */
  externalId?: string | undefined;
  /** Project name */
  project: string;
  /** Task title */
  title: string;
  /** Task description */
  description?: string | undefined;
  /** Current status */
  status: TaskStatus;
  /** Epic this task belongs to */
  epic?: string | undefined;
  /** Priority level */
  priority: TaskPriority;
  /** Reason for blocking (if status is blocked) */
  blockedBy?: string | undefined;
  /** Labels/tags */
  labels: string[];
  /** Assigned AI session ID */
  assignedSession?: string | undefined;
  /** Linked memory IDs */
  linkedMemories: number[];
  /** Created timestamp */
  createdAt: string;
  /** Last updated timestamp */
  updatedAt: string;
  /** Completed timestamp */
  completedAt?: string | undefined;
}

/**
 * Task creation options
 */
export interface TaskCreateOptions {
  source: TaskSource;
  externalId?: string | undefined;
  project: string;
  title: string;
  description?: string | undefined;
  status?: TaskStatus | undefined;
  epic?: string | undefined;
  priority?: TaskPriority | undefined;
  labels?: string[] | undefined;
}

/**
 * Task update options
 */
export interface TaskUpdateOptions {
  title?: string | undefined;
  description?: string | undefined;
  status?: TaskStatus | undefined;
  epic?: string | undefined;
  priority?: TaskPriority | undefined;
  blockedBy?: string | undefined;
  labels?: string[] | undefined;
  assignedSession?: string | undefined;
}

// ============================================================================
// EPIC TYPES
// ============================================================================

/**
 * Epic status
 */
export type EpicStatus = 'planning' | 'in_progress' | 'done' | 'on_hold';

/**
 * Epic record (group of related tasks)
 */
export interface Epic {
  id: number;
  /** Unique epic name (e.g., 'crm', 'booking') */
  name: string;
  /** Project name */
  project: string;
  /** Epic description */
  description?: string | undefined;
  /** Progress percentage (0-100) */
  progress: number;
  /** Current status */
  status: EpicStatus;
  /** Total tasks in epic */
  totalTasks: number;
  /** Completed tasks */
  completedTasks: number;
  /** Started timestamp */
  startedAt?: string | undefined;
  /** Completed timestamp */
  completedAt?: string | undefined;
}

/**
 * Epic creation options
 */
export interface EpicCreateOptions {
  name: string;
  project: string;
  description?: string | undefined;
  status?: EpicStatus | undefined;
}

/**
 * Epic update options
 */
export interface EpicUpdateOptions {
  name?: string | undefined;
  description?: string | undefined;
  status?: EpicStatus | undefined;
}

// ============================================================================
// SESSION TYPES
// ============================================================================

/**
 * AI session record
 */
export interface Session {
  id: string;
  /** Project name */
  project: string;
  /** Session start time */
  startedAt: string;
  /** Session end time */
  endedAt?: string | undefined;
  /** Session summary (auto-generated) */
  summary?: string | undefined;
  /** Task IDs worked on */
  tasksWorkedOn: number[];
  /** Task IDs completed */
  tasksCompleted: number[];
  /** Commit hashes made */
  commits: string[];
  /** Memory IDs created */
  memoriesCreated: number[];
  /** Files modified */
  filesModified: string[];
}

/**
 * Session creation options
 */
export interface SessionCreateOptions {
  project: string;
}

/**
 * Session update options
 */
export interface SessionUpdateOptions {
  summary?: string | undefined;
  tasksWorkedOn?: number[] | undefined;
  tasksCompleted?: number[] | undefined;
  commits?: string[] | undefined;
  memoriesCreated?: number[] | undefined;
  filesModified?: string[] | undefined;
}

// ============================================================================
// DATABASE ROW TYPES
// ============================================================================

/**
 * Task database row
 */
export interface TaskRow {
  id: number;
  source: string;
  external_id: string | null;
  project: string;
  title: string;
  description: string | null;
  status: string;
  epic: string | null;
  priority: string;
  blocked_by: string | null;
  labels: string;
  assigned_session: string | null;
  linked_memories: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

/**
 * Epic database row
 */
export interface EpicRow {
  id: number;
  name: string;
  project: string;
  description: string | null;
  progress: number;
  status: string;
  total_tasks: number;
  completed_tasks: number;
  started_at: string | null;
  completed_at: string | null;
}

/**
 * Session database row
 */
export interface SessionRow {
  id: string;
  project: string;
  started_at: string;
  ended_at: string | null;
  summary: string | null;
  tasks_worked_on: string;
  tasks_completed: string;
  commits: string;
  memories_created: string;
  files_modified: string;
}

// ============================================================================
// PROGRESS SUMMARY
// ============================================================================

/**
 * Progress summary for AI context
 */
export interface ProgressSummary {
  /** Task counts by status */
  tasks: {
    total: number;
    inProgress: number;
    blocked: number;
    done: number;
    backlog: number;
  };
  /** Epic summary */
  epics: {
    total: number;
    active: number;
    completed: number;
    averageProgress: number;
  };
  /** Current session info */
  currentSession?:
    | {
        id: string;
        startedAt: string;
        tasksWorkedOn: number;
        tasksCompleted: number;
      }
    | undefined;
  /** Weekly statistics */
  weeklyStats: {
    sessionsCount: number;
    tasksCompleted: number;
    commitsCount: number;
    averageSessionMinutes: number;
  };
  /** Suggested next tasks */
  suggestions: Array<{
    id: number;
    title: string;
    priority: TaskPriority;
    epic?: string | undefined;
  }>;
  /** Blocked tasks with reasons */
  blockers: Array<{
    id: number;
    title: string;
    blockedBy: string;
  }>;
}
