/**
 * PRD Generation Types
 *
 * @module commands/prd/types
 */

import type { PRD, PRDTask, TaskComplexity, TaskPriority } from '@/lib/@ralph/schemas/prd.schema';

/**
 * Supported models for PRD generation
 */
export type PrdModel =
  | 'opus'
  | 'sonnet'
  | 'haiku'
  | 'flash'
  | 'pro'
  | 'gemini-flash'
  | 'gemini-pro';

/**
 * Options for PRD generation
 */
export interface PrdGeneratorOptions {
  /** GitHub issue number */
  issue: number;
  /** Model for task decomposition (default: sonnet) */
  model?: PrdModel | undefined;
  /** Max tasks to generate (default: 10) */
  maxTasks?: number | undefined;
  /** Complexity estimation mode */
  complexity?: 'auto' | TaskComplexity | undefined;
  /** Include project context in analysis */
  includeContext?: boolean | undefined;
  /** Output format */
  format?: 'xml' | 'json' | undefined;
}

/**
 * Parsed GitHub issue for PRD generation
 */
export interface ParsedIssue {
  number: number;
  title: string;
  body: string;
  labels: string[];
  /** Extracted checklists from body */
  checklists: ChecklistItem[];
  /** Files mentioned in body */
  mentionedFiles: string[];
  /** Priority inferred from labels */
  inferredPriority: TaskPriority;
  /** Tags extracted from labels */
  tags: string[];
}

/**
 * Checklist item extracted from issue body
 */
export interface ChecklistItem {
  text: string;
  checked: boolean;
}

/**
 * Project context for PRD generation
 */
export interface PrdContext {
  /** Prisma schema models */
  schemaModels?: string[];
  /** tRPC routes */
  routes?: string[];
  /** Relevant memories from krolik DB */
  memories?: Array<{ title: string; description: string }>;
  /** Related files discovered */
  relatedFiles?: string[];
}

/**
 * Generated task before full PRD construction
 */
export interface GeneratedTask {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  filesAffected: string[];
  complexity: TaskComplexity;
  priority: TaskPriority;
  dependencies: string[];
  tags: string[];
}

/**
 * Result of PRD generation
 */
export interface PrdGenerationResult {
  success: boolean;
  prd?: PRD;
  xml?: string;
  json?: string;
  errors?: string[];
  meta: {
    issueNumber: number;
    tasksGenerated: number;
    model: string;
    durationMs: number;
    /** Path where PRD was saved */
    savedPath?: string | undefined;
  };
}

export type { PRD, PRDTask, TaskComplexity, TaskPriority };
