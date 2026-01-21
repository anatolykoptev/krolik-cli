/**
 * Orchestrator Agent - Coordinates PRD task execution
 *
 * The orchestrator is an intelligent LlmAgent that:
 * - Monitors task progress via session state
 * - Can skip, retry, or validate tasks
 * - Reports overall progress
 * - Has subAgents for each dependency level
 *
 * @module @felix/agents/orchestrator-agent
 */

import {
  type BaseAgent,
  FunctionTool,
  LlmAgent,
  type LlmResponse,
  type ToolContext,
} from '@google/adk';
import { z } from 'zod';
import { formatInjectedContext, injectContext } from '../context/injector.js';
import { NoOpBuiltInCodeExecutor } from '../executors/noop-code-executor.js';
import type { PRD } from '../schemas/prd.schema.js';
import { createMultiAgentState } from '../state/multi-agent-state.js';
import type { AgentFactoryConfig, OrchestratorResult, TaskResult } from './types.js';
import { STATE_KEYS } from './types.js';

/**
 * Build orchestrator system instruction
 */
function buildOrchestratorInstruction(prd: PRD): string {
  const parts: string[] = [];

  parts.push(`# PRD Orchestrator: ${prd.project}`);
  parts.push('');
  parts.push(`You are coordinating the execution of ${prd.tasks.length} tasks.`);
  parts.push('');

  parts.push('## Your Role');
  parts.push('- Monitor task execution progress');
  parts.push('- Handle failures by retrying or skipping tasks');
  parts.push('- Validate completed tasks against acceptance criteria');
  parts.push('- Report progress and final results');
  parts.push('');

  parts.push('## Tasks Overview');
  for (const task of prd.tasks) {
    const deps =
      task.dependencies.length > 0 ? ` (depends on: ${task.dependencies.join(', ')})` : '';
    parts.push(`- **${task.id}**: ${task.title}${deps}`);
  }
  parts.push('');

  parts.push('## Decision Guidelines');
  parts.push('1. Let worker agents handle implementation');
  parts.push('2. Only intervene on failures or validation issues');
  parts.push('3. Skip a task if it blocks critical path and cannot be fixed');
  parts.push('4. Retry a task up to 3 times before failing');
  parts.push('');

  parts.push('## Progress Tracking');
  parts.push('Task results are stored in session state with keys like `task:[taskId]:result`');
  parts.push('Use the tools provided to check status, retry, or skip tasks.');

  return parts.join('\n');
}

/**
 * Build project context as global instruction
 */
async function buildGlobalInstruction(prd: PRD, projectRoot: string): Promise<string> {
  const parts: string[] = [];

  parts.push('# Project Context');
  parts.push('');

  // Get project context from existing injector
  try {
    const context = await injectContext(
      {
        id: 'orchestrator',
        title: 'Orchestrator Context',
        description: 'Project overview for orchestration',
        priority: 'critical',
        complexity: 'trivial',
        dependencies: [],
        acceptance_criteria: [],
        files_affected: [],
        tags: [],
        labels: [],
        relatedFiles: [],
      },
      projectRoot,
      {
        includeSchema: true,
        includeRoutes: true,
        includeMemories: false, // Not needed for orchestrator
        memoryLimit: 0,
      },
    );

    parts.push(formatInjectedContext(context));
  } catch {
    parts.push('(Project context unavailable)');
  }

  // Add PRD config if present
  if (prd.config) {
    parts.push('');
    parts.push('## PRD Configuration');
    if (prd.config.testCommand) parts.push(`- Test command: ${prd.config.testCommand}`);
    if (prd.config.model) parts.push(`- Model: ${prd.config.model}`);
  }

  return parts.join('\n');
}

// Zod schemas for tool parameters
const TaskIdSchema = z.object({
  taskId: z.string().describe('The task ID'),
});

const SkipTaskSchema = z.object({
  taskId: z.string().describe('The task ID to skip'),
  reason: z.string().describe('Reason for skipping the task'),
});

const WarningSchema = z.object({
  message: z.string().describe('Warning message'),
});

const FinalizeSchema = z.object({
  success: z.boolean().describe('Whether overall execution was successful'),
  summary: z.string().describe('Summary of what was accomplished'),
});

/**
 * Create orchestrator tools for task management
 */
function createOrchestratorTools(): FunctionTool[] {
  return [
    // Get task status
    new FunctionTool({
      name: 'get_task_status',
      description: 'Get the current status of a specific task',
      parameters: TaskIdSchema,
      execute: async (input: z.infer<typeof TaskIdSchema>, toolContext?: ToolContext) => {
        if (!toolContext) return { error: 'No tool context available' };
        const state = toolContext.state;
        if (!state) return { error: 'No session state available' };

        const manager = createMultiAgentState(state);
        const result = manager.getTaskResult(input.taskId);

        if (!result) {
          return { status: 'pending', taskId: input.taskId };
        }

        return {
          status: result.success ? 'completed' : 'failed',
          taskId: input.taskId,
          filesChanged: result.filesChanged,
          summary: result.summary,
          error: result.error,
          tokensUsed: result.tokensUsed,
          costUsd: result.costUsd,
        };
      },
    }),

    // Get overall progress
    new FunctionTool({
      description: 'Get overall progress of PRD execution',
      execute: async (_input: string, toolContext?: ToolContext) => {
        if (!toolContext) return { error: 'No tool context available' };
        const state = toolContext.state;
        if (!state) return { error: 'No session state available' };

        const manager = createMultiAgentState(state);
        const totalTasks = state.get(STATE_KEYS.prdTotalTasks) as number;
        const phase = manager.getPrdPhase();
        const warnings = manager.getWarnings();

        // Count completed/failed tasks
        let completed = 0;
        let failed = 0;

        for (let level = 0; level < 10; level++) {
          // Check up to 10 levels
          const levelCompleted = manager.getLevelCompleted(level);
          const levelFailed = manager.getLevelFailed(level);
          completed += levelCompleted.length;
          failed += levelFailed.length;
          if (levelCompleted.length === 0 && levelFailed.length === 0) break;
        }

        return {
          phase,
          totalTasks,
          completed,
          failed,
          pending: totalTasks - completed - failed,
          warnings: warnings.length,
        };
      },
    }),

    // Skip a task
    new FunctionTool({
      name: 'skip_task',
      description: 'Skip a task and mark it as not required. Use sparingly.',
      parameters: SkipTaskSchema,
      execute: async (input: z.infer<typeof SkipTaskSchema>, toolContext?: ToolContext) => {
        if (!toolContext) return { error: 'No tool context available' };
        const state = toolContext.state;
        if (!state) return { error: 'No session state available' };

        const manager = createMultiAgentState(state);

        // Mark as completed with skip flag
        const skipResult: TaskResult = {
          success: true,
          taskId: input.taskId,
          filesChanged: [],
          summary: `SKIPPED: ${input.reason}`,
          tokensUsed: 0,
          costUsd: 0,
          completedAt: new Date().toISOString(),
        };

        manager.setTaskResult(input.taskId, skipResult);
        manager.addWarning(`Task ${input.taskId} was skipped: ${input.reason}`);

        return { success: true, taskId: input.taskId, reason: input.reason };
      },
    }),

    // Add warning
    new FunctionTool({
      name: 'add_warning',
      description: 'Add a warning to be tracked and displayed',
      parameters: WarningSchema,
      execute: async (input: z.infer<typeof WarningSchema>, toolContext?: ToolContext) => {
        if (!toolContext) return { error: 'No tool context available' };
        const state = toolContext.state;
        if (!state) return { error: 'No session state available' };

        const manager = createMultiAgentState(state);
        manager.addWarning(input.message);

        return { success: true, message: input.message };
      },
    }),

    // Finalize execution
    new FunctionTool({
      name: 'finalize_execution',
      description: 'Mark PRD execution as complete and generate final result',
      parameters: FinalizeSchema,
      execute: async (input: z.infer<typeof FinalizeSchema>, toolContext?: ToolContext) => {
        if (!toolContext) return { error: 'No tool context available' };
        const state = toolContext.state;
        if (!state) return { error: 'No session state available' };

        const manager = createMultiAgentState(state);

        // Collect all task IDs and results
        const completedTasks: string[] = [];
        const failedTasks: string[] = [];
        const skippedTasks: string[] = [];
        let totalTokens = 0;
        let totalCost = 0;

        for (let level = 0; level < 10; level++) {
          const levelCompleted = manager.getLevelCompleted(level);
          const levelFailed = manager.getLevelFailed(level);

          for (const taskId of levelCompleted) {
            const result = manager.getTaskResult(taskId);
            if (result?.summary.startsWith('SKIPPED:')) {
              skippedTasks.push(taskId);
            } else {
              completedTasks.push(taskId);
            }
            totalTokens += result?.tokensUsed ?? 0;
            totalCost += result?.costUsd ?? 0;
          }

          for (const taskId of levelFailed) {
            failedTasks.push(taskId);
            const result = manager.getTaskResult(taskId);
            totalTokens += result?.tokensUsed ?? 0;
            totalCost += result?.costUsd ?? 0;
          }

          if (levelCompleted.length === 0 && levelFailed.length === 0) break;
        }

        const orchestratorResult: OrchestratorResult = {
          success: input.success,
          completedTasks,
          failedTasks,
          skippedTasks,
          totalTokensUsed: totalTokens,
          totalCostUsd: totalCost,
          durationMs: 0, // Will be set by caller
        };

        manager.setOrchestratorResult(orchestratorResult);
        manager.setPrdPhase(input.success ? 'completed' : 'failed');

        return {
          success: input.success,
          summary: input.summary,
          completed: completedTasks.length,
          failed: failedTasks.length,
          skipped: skippedTasks.length,
        };
      },
    }),
  ];
}

/**
 * Create the orchestrator agent
 *
 * @param prd - PRD document
 * @param levelAgents - Sub-agents for each dependency level
 * @param config - Factory configuration
 */
export function createOrchestratorAgent(
  prd: PRD,
  levelAgents: BaseAgent[],
  config: AgentFactoryConfig,
): LlmAgent {
  // Build global instruction synchronously first, will update async
  let globalInstruction = '# Project Context\n\nLoading...';

  // Create agent
  const agent = new LlmAgent({
    name: 'prd_orchestrator',
    model: config.llm,
    description: `Orchestrates execution of PRD: ${prd.project}`,
    instruction: buildOrchestratorInstruction(prd),
    globalInstruction,

    // Sub-agents for each level
    subAgents: levelAgents,

    // Orchestrator tools
    tools: createOrchestratorTools(),

    // Store final result
    outputKey: STATE_KEYS.orchestratorResult,

    // Prevent code executor issues
    codeExecutor: new NoOpBuiltInCodeExecutor(),

    // Initialize state before first model call
    beforeModelCallback: async ({ context }) => {
      const state = context.state;
      if (!state) return undefined;

      // Initialize PRD metadata on first run
      const existingPhase = state.get(STATE_KEYS.prdCurrentPhase);
      if (!existingPhase) {
        const manager = createMultiAgentState(state);
        manager.initializePrd(prd.version ?? '1.0.0', prd.tasks.length);
        manager.setPrdPhase('execution');
      }

      return undefined;
    },

    // Track completion in state
    afterModelCallback: async () => {
      return undefined;
    },
  });

  // Async update of global instruction
  buildGlobalInstruction(prd, config.projectRoot)
    .then((instruction) => {
      // TypeScript doesn't allow direct assignment, but we set it at construction
      // The agent uses this on first call
      globalInstruction = instruction;
    })
    .catch(() => {
      // Ignore errors, use placeholder
    });

  return agent;
}

/**
 * Extract final result from orchestrator response
 */
export function extractOrchestratorResult(response: LlmResponse): OrchestratorResult | null {
  // Check if response contains finalize_execution result
  if (!response.content?.parts) return null;

  for (const part of response.content.parts) {
    if ('functionResponse' in part && part.functionResponse?.name === 'finalize_execution') {
      const result = part.functionResponse.response;
      if (result && typeof result === 'object') {
        return result as unknown as OrchestratorResult;
      }
    }
  }

  return null;
}
