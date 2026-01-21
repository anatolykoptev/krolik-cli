/**
 * @module lib/@felix/context
 * @description Context injection and prompt building for Krolik Felix
 */

// Builder types (defined locally to avoid broken imports)
export interface BuildPromptOptions {
  task: unknown;
  projectRoot: string;
  context?: unknown;
}

export interface BuiltPrompt {
  systemPrompt: string;
  taskPrompt: string;
}

// Builder function (stub - import from actual location if needed)
export function buildPrompt(_options: BuildPromptOptions): BuiltPrompt {
  return {
    systemPrompt: '',
    taskPrompt: '',
  };
}

// Injector
export {
  formatInjectedContext,
  type InjectContextOptions,
  type InjectedContext,
  injectContext,
} from './injector';
// Task analyzer
export { detectTaskType, type TaskType } from './task-analyzer';
// Templates
export {
  FELIX_RETRY_SYSTEM_PROMPT,
  FELIX_SYSTEM_PROMPT,
  fillTemplate,
  formatAcceptanceCriteria,
  formatContextFiles,
  formatGuardrails,
  formatHints,
  RETRY_PROMPT_TEMPLATE,
  TASK_PROMPT_TEMPLATE,
} from './templates';
