/**
 * @module lib/@ralph/context/builder
 * @description Prompt builder for Ralph Loop
 *
 * Combines context injection, templates, and task info
 * to build complete prompts for AI execution.
 */

import type { RalphGuardrail } from '@/lib/@storage/ralph/types';
import type { PRDTask } from '../schemas';
import type { InjectedContext } from './injector';
import { formatInjectedContext, type InjectContextOptions, injectContext } from './injector';
import { detectTaskType } from './task-analyzer';
import {
  fillTemplate,
  formatAcceptanceCriteria,
  formatContextFiles,
  formatGuardrails,
  formatHints,
  RALPH_RETRY_SYSTEM_PROMPT,
  RALPH_SYSTEM_PROMPT,
  RETRY_PROMPT_TEMPLATE,
  TASK_PROMPT_TEMPLATE,
} from './templates';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Built prompt ready for AI execution
 */
export interface BuiltPrompt {
  /** System prompt with instructions */
  systemPrompt: string;

  /** User prompt with task and context */
  userPrompt: string;

  /** Metadata about prompt generation */
  meta: {
    taskId: string;
    attempt: number;
    contextSections: string[];
    generatedAt: string;
  };
}

/**
 * Options for building prompts
 */
export interface BuildPromptOptions {
  /** Current attempt number (1-based) */
  attempt?: number;

  /** Maximum attempts allowed */
  maxAttempts?: number;

  /** Previous failure reason (for retries) */
  failureReason?: string;

  /** Previous failure output (for retries) */
  failureOutput?: string;

  /** Guardrails from previous failures */
  guardrails?: RalphGuardrail[];

  /** Context injection options */
  contextOptions?: InjectContextOptions;

  /** Pre-injected context (skip injection if provided) */
  preInjectedContext?: InjectedContext;
}

// ============================================================================
// MAIN BUILDER
// ============================================================================

/**
 * Build prompt for task execution
 *
 * @param task - PRD task to execute
 * @param projectRoot - Project root directory
 * @param options - Build options
 * @returns Built prompt ready for AI
 */
export async function buildPrompt(
  task: PRDTask,
  projectRoot: string,
  options: BuildPromptOptions = {},
): Promise<BuiltPrompt> {
  const attempt = options.attempt ?? 1;
  const isRetry = attempt > 1;

  // Get or inject context
  const context =
    options.preInjectedContext ?? (await injectContext(task, projectRoot, options.contextOptions));

  // Build system prompt
  const systemPrompt = isRetry
    ? buildRetrySystemPrompt(options.failureReason, options.guardrails)
    : RALPH_SYSTEM_PROMPT;

  // Build user prompt
  const userPrompt = isRetry
    ? buildRetryUserPrompt(task, context, options)
    : buildTaskUserPrompt(task, context);

  return {
    systemPrompt,
    userPrompt,
    meta: {
      taskId: task.id,
      attempt,
      contextSections: context.meta.sections,
      generatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Build system prompt for retry
 */
function buildRetrySystemPrompt(failureReason?: string, guardrails?: RalphGuardrail[]): string {
  return fillTemplate(RALPH_RETRY_SYSTEM_PROMPT, {
    FAILURE_REASON: failureReason ?? 'Unknown failure',
    GUARDRAILS: formatGuardrails(
      guardrails?.map((g) => ({ problem: g.problem, solution: g.solution })) ?? [],
    ),
  });
}

/**
 * Normalize acceptance criteria to common format
 */
function normalizeAcceptanceCriteria(
  criteria: PRDTask['acceptance_criteria'],
): Array<{ id: string; description: string; testCommand?: string }> {
  return criteria.map((c, i) => {
    if (typeof c === 'string') {
      return { id: `ac-${i + 1}`, description: c };
    }
    const item: { id: string; description: string; testCommand?: string } = {
      id: c.id,
      description: c.description,
    };
    if (c.testCommand) {
      item.testCommand = c.testCommand;
    }
    return item;
  });
}

/**
 * Build user prompt for initial task execution
 */
function buildTaskUserPrompt(task: PRDTask, context: InjectedContext): string {
  return fillTemplate(TASK_PROMPT_TEMPLATE, {
    TASK_TITLE: task.title,
    TASK_DESCRIPTION: task.description,
    TASK_TYPE: detectTaskType(task),
    TASK_PRIORITY: task.priority,
    TASK_COMPLEXITY: task.complexity ?? 'moderate',
    ACCEPTANCE_CRITERIA: formatAcceptanceCriteria(
      normalizeAcceptanceCriteria(task.acceptance_criteria),
    ),
    CONTEXT_FILES: formatContextFiles([...task.files_affected, ...task.relatedFiles]),
    HINTS: formatHints(context.hints ?? []),
    INJECTED_CONTEXT: formatInjectedContext(context),
  });
}

/**
 * Build user prompt for retry
 */
function buildRetryUserPrompt(
  task: PRDTask,
  context: InjectedContext,
  options: BuildPromptOptions,
): string {
  return fillTemplate(RETRY_PROMPT_TEMPLATE, {
    TASK_TITLE: task.title,
    TASK_DESCRIPTION: task.description,
    TASK_TYPE: detectTaskType(task),
    TASK_PRIORITY: task.priority,
    TASK_COMPLEXITY: task.complexity ?? 'moderate',
    ACCEPTANCE_CRITERIA: formatAcceptanceCriteria(
      normalizeAcceptanceCriteria(task.acceptance_criteria),
    ),
    CONTEXT_FILES: formatContextFiles([...task.files_affected, ...task.relatedFiles]),
    HINTS: formatHints(context.hints ?? []),
    INJECTED_CONTEXT: formatInjectedContext(context),
    ATTEMPT_NUMBER: String(options.attempt ?? 1),
    MAX_ATTEMPTS: String(options.maxAttempts ?? 3),
    FAILURE_REASON: options.failureReason ?? 'Unknown failure',
    FAILURE_OUTPUT: options.failureOutput
      ? `\`\`\`\n${options.failureOutput}\n\`\`\``
      : '_No output captured_',
    WHAT_TO_FIX: analyzeWhatToFix(options.failureReason, options.failureOutput),
  });
}

/**
 * Analyze failure and suggest what to fix
 */
function analyzeWhatToFix(failureReason?: string, failureOutput?: string): string {
  const suggestions: string[] = [];

  if (!failureReason && !failureOutput) {
    return 'Review the acceptance criteria and ensure all requirements are met.';
  }

  const combined = `${failureReason ?? ''} ${failureOutput ?? ''}`.toLowerCase();

  // Type errors
  if (combined.includes('type') && (combined.includes('error') || combined.includes('ts'))) {
    suggestions.push('Fix TypeScript type errors - check function signatures and return types');
  }

  // Test failures
  if (combined.includes('test') && (combined.includes('fail') || combined.includes('expect'))) {
    suggestions.push('Review failing tests - ensure implementation matches expected behavior');
  }

  // Import errors
  if (combined.includes('import') || combined.includes('module not found')) {
    suggestions.push('Check imports - ensure all dependencies are correctly imported');
  }

  // Runtime errors
  if (combined.includes('undefined') || combined.includes('null')) {
    suggestions.push('Handle null/undefined cases - add proper checks and fallbacks');
  }

  // Build errors
  if (combined.includes('build') && combined.includes('fail')) {
    suggestions.push('Fix build errors - check for syntax errors and missing dependencies');
  }

  if (suggestions.length === 0) {
    suggestions.push('Analyze the error output carefully and address the root cause');
  }

  return suggestions.map((s) => `- ${s}`).join('\n');
}

// ============================================================================
// EXPORTS
// ============================================================================

export { injectContext, formatInjectedContext };
export type { InjectedContext, InjectContextOptions };
