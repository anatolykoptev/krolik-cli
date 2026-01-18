/**
 * @module lib/@ralph/context/task-analyzer
 * @description Shared task analysis utilities for context building
 */

import type { PRDTask } from '../schemas/prd.schema';

// ============================================================================
// TASK TYPE DETECTION
// ============================================================================

/**
 * Task type categories
 */
export type TaskType = 'feature' | 'bugfix' | 'refactor' | 'test' | 'docs' | 'other';

/**
 * Detect task type from tags and labels
 *
 * Priority order:
 * 1. bugfix (bug, fix)
 * 2. refactor
 * 3. test
 * 4. docs
 * 5. feature (feat, feature)
 * 6. other (default)
 */
export function detectTaskType(task: PRDTask): TaskType {
  const allTags = [...task.tags, ...task.labels].map((t) => t.toLowerCase());

  if (allTags.some((t) => t.includes('bug') || t.includes('fix'))) return 'bugfix';
  if (allTags.some((t) => t.includes('refactor'))) return 'refactor';
  if (allTags.some((t) => t.includes('test'))) return 'test';
  if (allTags.some((t) => t.includes('doc'))) return 'docs';
  if (allTags.some((t) => t.includes('feat') || t.includes('feature'))) return 'feature';

  return 'other';
}
