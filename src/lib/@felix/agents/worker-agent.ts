/**
 * Worker Agent - Executes individual PRD tasks
 *
 * Each worker agent:
 * - Has outputKey to save results to session state
 * - Reads previous task results via beforeModelCallback
 * - Extracts files changed via afterModelCallback
 *
 * @module @ralph/agents/worker-agent
 */

import type { BaseLlm } from '@google/adk';
import { LlmAgent, type LlmResponse } from '@google/adk';
import { NoOpBuiltInCodeExecutor } from '../executors/noop-code-executor.js';
import type { RoutingDecision } from '../router/types.js';
import type { PRD, PRDTask } from '../schemas/prd.schema.js';
import { createComponentLogger } from '../utils/logger.js';
import { toAgentName } from './agent-factory.js';
import type { AgentFactoryConfig } from './types.js';
import { STATE_KEYS } from './types.js';

const logger = createComponentLogger('worker-agent');

/**
 * Build system prompt for a worker agent
 */
function buildWorkerInstruction(task: PRDTask, prdConfig?: PRD['config']): string {
  const parts: string[] = [];

  // Task header
  parts.push(`# Task: ${task.title}`);
  parts.push('');

  // Description
  if (task.description) {
    parts.push(`## Description`);
    parts.push(task.description);
    parts.push('');
  }

  // Acceptance criteria
  if (task.acceptance_criteria?.length) {
    parts.push(`## Acceptance Criteria`);
    for (const criterion of task.acceptance_criteria) {
      const text = typeof criterion === 'string' ? criterion : criterion.description;
      parts.push(`- ${text}`);
    }
    parts.push('');
  }

  // Files to modify (hint)
  if (task.files_affected?.length) {
    parts.push(`## Files to Modify`);
    for (const file of task.files_affected) {
      parts.push(`- ${file}`);
    }
    parts.push('');
  }

  // Dependencies context
  if (task.dependencies?.length) {
    parts.push(`## Dependencies`);
    parts.push(
      `This task depends on: ${task.dependencies.join(', ')}. Check previous task results in context.`,
    );
    parts.push('');
  }

  // PRD-level config
  if (prdConfig) {
    parts.push(`## Project Configuration`);
    if (prdConfig.testCommand) parts.push(`- Test command: ${prdConfig.testCommand}`);
    if (prdConfig.model) parts.push(`- Model: ${prdConfig.model}`);
    parts.push('');
  }

  // Instructions
  parts.push(`## Instructions`);
  parts.push(`1. Implement the task according to acceptance criteria`);
  parts.push(`2. Modify only the necessary files`);
  parts.push(`3. Follow existing code patterns and conventions`);
  parts.push(`4. Report files you changed in your response`);

  return parts.join('\n');
}

/**
 * Extract files changed from model response
 */
function extractFilesChanged(response: LlmResponse): string[] {
  if (!response.content?.parts) return [];

  const files: string[] = [];
  for (const part of response.content.parts) {
    if ('text' in part && part.text) {
      // Look for file paths in the response
      const filePatterns = [
        /(?:modified|created|updated|changed|edited)\s+[`"']?([^\s`"']+\.[a-z]+)[`"']?/gi,
        /(?:file|path):\s*[`"']?([^\s`"']+\.[a-z]+)[`"']?/gi,
      ];

      for (const pattern of filePatterns) {
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(part.text)) !== null) {
          const file = match[1];
          if (file && !files.includes(file)) {
            files.push(file);
          }
        }
      }
    }
  }

  return files;
}

/**
 * Extract summary from model response
 */
function extractSummary(response: LlmResponse): string {
  if (!response.content?.parts) return 'Task completed';

  for (const part of response.content.parts) {
    if ('text' in part && part.text) {
      // Take first 500 chars as summary
      const text = part.text.trim();
      if (text.length > 500) {
        return `${text.slice(0, 497)}...`;
      }
      return text;
    }
  }

  return 'Task completed';
}

/** State key for storing routing decision */
const ROUTING_DECISION_KEY = (taskId: string) => `routing:${taskId}:decision` as const;

/**
 * Select LLM for a task using router or fallback
 */
function selectLlmForTask(
  task: PRDTask,
  config: AgentFactoryConfig,
): { llm: BaseLlm; decision: RoutingDecision | null } {
  // Use router if available
  if (config.getLlmForTask) {
    const result = config.getLlmForTask(task);

    logger.info(`[Router] Task ${task.id} → ${result.decision.selectedModel}`, {
      taskId: task.id,
      model: result.decision.selectedModel,
      tier: result.decision.tier,
      source: result.decision.source,
      score: result.decision.score,
      canEscalate: result.decision.canEscalate,
      escalationPath: result.decision.escalationPath,
    });

    return { llm: result.llm, decision: result.decision };
  }

  // Fallback to default LLM
  logger.debug(`Task ${task.id}: using default LLM (no router)`, { taskId: task.id });
  return { llm: config.llm, decision: null };
}

/**
 * Create a worker agent for a single task
 */
export function createWorkerAgent(
  task: PRDTask,
  config: AgentFactoryConfig,
  _levelIndex: number,
): LlmAgent {
  const taskId = task.id;
  const outputKey = STATE_KEYS.taskResult(taskId);

  // Select LLM using router or fallback
  const { llm, decision } = selectLlmForTask(task, config);

  return new LlmAgent({
    name: toAgentName(taskId),
    model: llm,
    description: task.title,
    instruction: buildWorkerInstruction(task),

    // Save result to session state
    outputKey,

    // Prevent Gemini code executor issues with Claude
    codeExecutor: new NoOpBuiltInCodeExecutor(),

    // Tools from config
    tools: config.tools,

    // Inject context from previous tasks before model call
    beforeModelCallback: async ({ context, request }) => {
      const state = context.state;
      if (!state) return undefined;

      // Store routing decision in state for cascade handling
      if (decision) {
        state.set(ROUTING_DECISION_KEY(taskId), decision);
      }

      // Get accumulated changes from previous tasks
      const accumulated = state.get(STATE_KEYS.accumulatedChanges) as string | undefined;
      const warnings = state.get(STATE_KEYS.warnings) as string[] | undefined;

      if (accumulated || warnings?.length) {
        const contextParts: string[] = [];

        if (accumulated) {
          contextParts.push('## Context from Previous Tasks');
          contextParts.push(accumulated);
        }

        if (warnings?.length) {
          contextParts.push('## Warnings');
          contextParts.push(warnings.join('\n'));
        }

        // Prepend context to the conversation
        const contextMessage = {
          role: 'user' as const,
          parts: [{ text: contextParts.join('\n\n') }],
        };

        request.contents = [contextMessage, ...request.contents];
      }

      return undefined;
    },

    // Extract metadata after model response
    afterModelCallback: async ({ context, response }) => {
      const state = context.state;
      if (!state) return undefined;

      // Extract files changed
      const filesChanged = extractFilesChanged(response);
      state.set(STATE_KEYS.taskFiles(taskId), filesChanged);

      // Check for errors
      if (response.errorCode || response.errorMessage) {
        state.set(STATE_KEYS.taskError(taskId), response.errorMessage ?? response.errorCode);
      }

      // Accumulate context for next tasks
      const summary = extractSummary(response);
      const existingAccumulated = (state.get(STATE_KEYS.accumulatedChanges) as string) ?? '';
      const newAccumulated = `${existingAccumulated}\n\n### ${taskId}\n${summary}`.trim();
      state.set(STATE_KEYS.accumulatedChanges, newAccumulated);

      return undefined;
    },
  });
}
