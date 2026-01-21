/**
 * PRD Schema
 *
 * Zod schema for validating PRD.json files at runtime.
 * PRD (Product Requirements Document) defines tasks for Krolik Felix execution.
 *
 * @module @felix/schemas/prd
 */

import { z } from 'zod';

/**
 * Known Claude models (for documentation, not validation)
 * New models can be used without code changes
 */
export const KNOWN_MODELS = ['opus', 'sonnet', 'haiku'] as const;
export type KnownModel = (typeof KNOWN_MODELS)[number];

/**
 * Model tiers for routing
 */
export const MODEL_TIERS = ['cheap', 'mid', 'premium'] as const;
export type ModelTier = (typeof MODEL_TIERS)[number];

/**
 * Model names including Gemini models
 */
export const ROUTER_MODELS = ['haiku', 'flash', 'sonnet', 'pro', 'opus'] as const;
export type RouterModel = (typeof ROUTER_MODELS)[number];

/**
 * Model schema - accepts any string but shows known values as reference
 * This allows new models (like claude-3-7-opus) without schema changes
 */
export const ModelSchema = z
  .string()
  .describe(
    `Claude model name. Known: ${KNOWN_MODELS.join(', ')}. ` +
      `Any valid model name accepted (e.g., 'opus', 'sonnet', 'claude-opus-4-5-20251101')`,
  );

/**
 * Task complexity levels for estimation
 */
export const TaskComplexitySchema = z.enum(['trivial', 'simple', 'moderate', 'complex', 'epic']);
export type TaskComplexity = z.infer<typeof TaskComplexitySchema>;

/**
 * Task priority levels
 */
export const TaskPrioritySchema = z.enum(['critical', 'high', 'medium', 'low']);
export type TaskPriority = z.infer<typeof TaskPrioritySchema>;

/**
 * Acceptance criteria for task completion verification
 */
export const AcceptanceCriteriaSchema = z.object({
  /** Unique criterion ID */
  id: z.string().min(1),
  /** Human-readable description */
  description: z.string().min(1),
  /** Optional command to verify */
  testCommand: z.string().optional(),
  /** Expected outcome */
  expected: z.string().optional(),
});
export type AcceptanceCriteria = z.infer<typeof AcceptanceCriteriaSchema>;

/**
 * Model preference for task-level routing control
 */
export const ModelPreferenceSchema = z.object({
  /** Force specific model for this task */
  model: z.enum(ROUTER_MODELS).optional(),
  /** Minimum tier (can escalate but not go lower) */
  minTier: z.enum(MODEL_TIERS).optional(),
  /** Disable cascade fallback for this task */
  noCascade: z.boolean().optional(),
});
export type ModelPreference = z.infer<typeof ModelPreferenceSchema>;

/**
 * Single PRD task schema
 */
export const PRDTaskSchema = z.object({
  /** Unique task identifier (kebab-case recommended) */
  id: z.string().min(1, 'Task ID is required'),
  /** Human-readable task title */
  title: z.string().min(1, 'Task title is required'),
  /** Detailed description of what needs to be done */
  description: z.string().min(1, 'Task description is required'),
  /** Optional user story format */
  userStory: z.string().optional(),
  /** List of acceptance criteria to verify completion */
  acceptance_criteria: z
    .array(z.union([z.string().min(1), AcceptanceCriteriaSchema]))
    .min(1, 'At least one acceptance criterion is required'),
  /** List of files that will be affected by this task */
  files_affected: z.array(z.string()).default([]),
  /** Task priority for ordering */
  priority: TaskPrioritySchema.default('medium'),
  /** Task dependencies (IDs of tasks that must complete first) */
  dependencies: z.array(z.string()).default([]),
  /** Estimated complexity for token budgeting */
  complexity: TaskComplexitySchema.optional(),
  /** Estimated tokens (auto-calculated from complexity if omitted) */
  estimatedTokens: z.number().min(0).optional(),
  /** Tags for categorization */
  tags: z.array(z.string()).default([]),
  /** Labels for filtering */
  labels: z.array(z.string()).default([]),
  /** Related files to focus on */
  relatedFiles: z.array(z.string()).default([]),
  /** Epic/feature this belongs to */
  epic: z.string().optional(),
  /** Linked GitHub issue number */
  githubIssue: z.number().optional(),
  /** Model routing preference for this task */
  modelPreference: ModelPreferenceSchema.optional(),
});
export type PRDTask = z.infer<typeof PRDTaskSchema>;

/**
 * Krolik Felix configuration
 */
export const FelixConfigSchema = z.object({
  /** Max retry attempts per task */
  maxAttempts: z.number().min(1).max(10).default(3),
  /** Total token budget (optional) */
  maxTokenBudget: z.number().min(0).optional(),
  /** Continue to next task on failure */
  continueOnFailure: z.boolean().default(false),
  /** Auto-commit successful tasks */
  autoCommit: z.boolean().default(true),
  /** Auto-generate guardrails from failures */
  autoGuardrails: z.boolean().default(true),
  /** Delay between retries (ms) */
  retryDelayMs: z.number().min(0).default(2000),
  /** Claude temperature */
  temperature: z.number().min(0).max(1).default(0.7),
  /** Claude model preference (accepts any model name, 'sonnet' recommended) */
  model: ModelSchema.default('sonnet'),
  /** Custom test command */
  testCommand: z.string().optional(),
});
export type FelixConfig = z.infer<typeof FelixConfigSchema>;

/**
 * Full PRD document schema
 */
export const PRDSchema = z.object({
  /** Schema version for migrations */
  version: z.string().default('1.0'),
  /** Project name */
  project: z.string().min(1, 'Project name is required'),
  /** PRD title */
  title: z.string().optional(),
  /** Project description */
  description: z.string().optional(),
  /** Creation timestamp */
  createdAt: z.string().datetime().optional(),
  /** Last update timestamp */
  updatedAt: z.string().datetime().optional(),
  /** Configuration options */
  config: FelixConfigSchema.optional(),
  /** List of tasks to implement */
  tasks: z.array(PRDTaskSchema).min(1, 'At least one task is required'),
  /** Optional metadata */
  metadata: z
    .object({
      author: z.string().optional(),
      tags: z.array(z.string()).optional(),
      notes: z.string().optional(),
    })
    .optional(),
});
export type PRD = z.infer<typeof PRDSchema>;

/**
 * Base token estimates by complexity (without file sizes)
 */
export const COMPLEXITY_TOKEN_ESTIMATES: Record<TaskComplexity, number> = {
  trivial: 3000,
  simple: 8000,
  moderate: 15000,
  complex: 30000,
  epic: 50000,
};

/**
 * Tokens per line of code (rough estimate)
 * TypeScript/JavaScript averages ~4 tokens per line
 */
const TOKENS_PER_LINE = 4;

/**
 * Minimum token buffer for agent reasoning
 */
const REASONING_BUFFER = 2000;

/**
 * Check for circular dependencies in tasks
 */
function checkCircularDependencies(tasks: PRDTask[]): { hasCircular: boolean; cycle: string[] } {
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function dfs(taskId: string, path: string[]): string[] | null {
    if (recursionStack.has(taskId)) {
      const cycleStart = path.indexOf(taskId);
      return [...path.slice(cycleStart), taskId];
    }
    if (visited.has(taskId)) return null;

    visited.add(taskId);
    recursionStack.add(taskId);

    const task = taskMap.get(taskId);
    if (task) {
      for (const depId of task.dependencies) {
        const cycle = dfs(depId, [...path, taskId]);
        if (cycle) return cycle;
      }
    }

    recursionStack.delete(taskId);
    return null;
  }

  for (const task of tasks) {
    const cycle = dfs(task.id, []);
    if (cycle) return { hasCircular: true, cycle };
  }

  return { hasCircular: false, cycle: [] };
}

/**
 * Find dependencies that reference non-existent tasks
 */
function findMissingDependencies(tasks: PRDTask[]): { taskId: string; depId: string }[] {
  const taskIds = new Set(tasks.map((t) => t.id));
  const missing: { taskId: string; depId: string }[] = [];

  for (const task of tasks) {
    for (const depId of task.dependencies) {
      if (!taskIds.has(depId)) {
        missing.push({ taskId: task.id, depId });
      }
    }
  }

  return missing;
}

/**
 * Validate PRD with detailed error messages
 */
export function validatePRD(
  data: unknown,
): { success: true; data: PRD } | { success: false; errors: string[] } {
  const result = PRDSchema.safeParse(data);

  if (result.success) {
    // Check for duplicate IDs
    const ids = result.data.tasks.map((t) => t.id);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    if (duplicates.length > 0) {
      return {
        success: false,
        errors: [`Duplicate task IDs found: ${[...new Set(duplicates)].join(', ')}`],
      };
    }

    // Check for circular dependencies
    const circularCheck = checkCircularDependencies(result.data.tasks);
    if (circularCheck.hasCircular) {
      return {
        success: false,
        errors: [`Circular dependency detected: ${circularCheck.cycle.join(' -> ')}`],
      };
    }

    // Check for missing dependencies
    const missingDeps = findMissingDependencies(result.data.tasks);
    if (missingDeps.length > 0) {
      return {
        success: false,
        errors: missingDeps.map(
          (m) => `Task "${m.taskId}" depends on non-existent task "${m.depId}"`,
        ),
      };
    }

    return { success: true, data: result.data };
  }

  const errors = result.error.issues.map((issue) => {
    const path = issue.path.join('.');
    return path ? `${path}: ${issue.message}` : issue.message;
  });

  return { success: false, errors };
}

/**
 * Options for dynamic token estimation
 */
export interface TokenEstimationOptions {
  /** Project root for file size calculation */
  projectRoot?: string;
  /** Pre-calculated file sizes (lines per file) */
  fileSizes?: Map<string, number>;
}

/**
 * Calculate estimated tokens for a task
 *
 * Uses dynamic calculation based on:
 * 1. Explicit estimatedTokens (highest priority)
 * 2. File sizes from files_affected + relatedFiles
 * 3. Complexity-based estimate (fallback)
 *
 * @param task - The PRD task
 * @param options - Optional settings for dynamic calculation
 */
export function estimateTaskTokens(task: PRDTask, options?: TokenEstimationOptions): number {
  // Priority 1: Explicit estimate
  if (task.estimatedTokens) return task.estimatedTokens;

  // Priority 2: Dynamic calculation from file sizes
  if (options?.projectRoot || options?.fileSizes) {
    const fileTokens = calculateFileTokens(task, options);
    if (fileTokens > 0) {
      // Add reasoning buffer + complexity multiplier
      const complexityMultiplier = task.complexity
        ? { trivial: 1, simple: 1.2, moderate: 1.5, complex: 2, epic: 3 }[task.complexity]
        : 1.5;
      return Math.ceil((fileTokens + REASONING_BUFFER) * complexityMultiplier);
    }
  }

  // Priority 3: Static complexity estimate
  if (task.complexity) return COMPLEXITY_TOKEN_ESTIMATES[task.complexity];

  // Default fallback
  return COMPLEXITY_TOKEN_ESTIMATES.moderate;
}

/**
 * Calculate tokens based on actual file sizes
 */
function calculateFileTokens(task: PRDTask, options: TokenEstimationOptions): number {
  const allFiles = [...task.files_affected, ...task.relatedFiles];
  if (allFiles.length === 0) return 0;

  let totalLines = 0;

  // Use pre-calculated sizes if available
  if (options.fileSizes) {
    for (const file of allFiles) {
      totalLines += options.fileSizes.get(file) ?? 0;
    }
  }
  // Otherwise, try to read file sizes dynamically
  else if (options.projectRoot) {
    try {
      const fs = require('node:fs');
      const path = require('node:path');

      for (const file of allFiles) {
        try {
          const fullPath = path.join(options.projectRoot, file);
          const content = fs.readFileSync(fullPath, 'utf-8');
          totalLines += content.split('\n').length;
        } catch {
          // File doesn't exist or can't be read, skip
        }
      }
    } catch {
      // fs not available, return 0
      return 0;
    }
  }

  return totalLines * TOKENS_PER_LINE;
}

/**
 * Get topological order of tasks based on dependencies
 */
export function getTaskExecutionOrder(tasks: PRDTask[]): PRDTask[] {
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  // Initialize
  for (const task of tasks) {
    inDegree.set(task.id, 0);
    adjacency.set(task.id, []);
  }

  // Build graph
  for (const task of tasks) {
    for (const depId of task.dependencies) {
      if (taskMap.has(depId)) {
        adjacency.get(depId)!.push(task.id);
        inDegree.set(task.id, (inDegree.get(task.id) ?? 0) + 1);
      }
    }
  }

  // Kahn's algorithm
  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }

  const result: PRDTask[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    result.push(taskMap.get(id)!);

    for (const neighbor of adjacency.get(id) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) queue.push(neighbor);
    }
  }

  return result;
}
