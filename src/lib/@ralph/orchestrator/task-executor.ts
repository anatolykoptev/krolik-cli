/**
 * Task Executor Module
 *
 * Handles single task execution logic including agent creation,
 * prompt building, and running tasks through ADK.
 *
 * @module @ralph/orchestrator/task-executor
 */

import type { BaseLlm, BasePlugin } from '@google/adk';
import { type Event, LlmAgent, Runner } from '@google/adk';
import type { Content } from '@google/genai';
import { NoOpBuiltInCodeExecutor } from '../executors/noop-code-executor.js';
import { formatTimeout, getTimeoutForComplexity } from '../models/timeout-config.js';
import type { CostPlugin } from '../plugins/cost-plugin.js';
import type { RetryPlugin } from '../plugins/retry-plugin.js';
import type { PRD, PRDTask } from '../schemas/prd.schema.js';
import type { SQLiteSessionService } from '../services/sqlite-session.js';
import type { EventEmitter, TaskExecutionResult } from '../types.js';
import { createComponentLogger } from '../utils/logger.js';

const logger = createComponentLogger('task-executor');

// Re-export EventEmitter for use by orchestrator
export type { EventEmitter } from '../types.js';

import type { QualityGateConfig, QualityGateResult } from '../executor/quality-gate.js';
import { runQualityGate } from '../executor/quality-gate.js';
import type { ValidationState } from './types.js';

/**
 * Default timeout for quality gate execution in milliseconds
 * Safety: Prevents hanging if quality gate commands don't return
 */
const QUALITY_GATE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Run quality gate with timeout protection
 * Safety: Prevents task execution from hanging indefinitely
 */
async function runQualityGateWithTimeout(
  projectRoot: string,
  config: QualityGateConfig,
  timeoutMs: number = QUALITY_GATE_TIMEOUT_MS,
): Promise<QualityGateResult> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Quality gate timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    runQualityGate(projectRoot, config)
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}
/**
 * Event handler for ADK events
 */
export type AdkEventHandler = (event: Event, taskId: string) => Promise<void>;

/**
 * Task executor configuration
 */
export interface TaskExecutorConfig {
  llm: BaseLlm;
  sessionService: SQLiteSessionService;
  plugins: BasePlugin[];
  retryPlugin: RetryPlugin;
  costPlugin: CostPlugin;
  emit: EventEmitter;
  handleEvent: AdkEventHandler;
  now: () => string;
  qualityGate?: QualityGateConfig;
  projectRoot: string;
}

/**
 * Build system prompt for task
 */
export function buildSystemPrompt(task: PRDTask, config?: PRD['config'], context?: string): string {
  const acceptanceCriteria = task.acceptance_criteria
    .map((ac, i) => {
      if (typeof ac === 'string') return `${i + 1}. ${ac}`;
      return `${i + 1}. ${ac.description}${ac.testCommand ? ` (verify: ${ac.testCommand})` : ''}`;
    })
    .join('\n');

  return `You are an autonomous coding agent executing a task from a PRD.

## Task: ${task.title}

${task.description}

${task.userStory ? `### User Story\n${task.userStory}\n` : ''}

### Acceptance Criteria
${acceptanceCriteria}

${task.files_affected.length > 0 ? `### Files to Modify\n${task.files_affected.join('\n')}\n` : ''}

### Guidelines
- Make minimal, focused changes
- Run validation after changes
- Follow existing code patterns
- Do not over-engineer
${config?.autoCommit ? '- Commit after successful validation' : ''}

${context ? `## Project Context\n\n${context}` : ''}
`;
}

/**
 * Build task prompt
 */
export function buildTaskPrompt(task: PRDTask): string {
  return `Execute the task: ${task.title}

Description: ${task.description}

Please implement this task following the acceptance criteria.`;
}

/**
 * Convert task ID to valid ADK agent name (letters, digits, underscores only)
 */
function toAgentName(taskId: string): string {
  // Replace non-alphanumeric chars with underscore, ensure starts with letter
  const sanitized = taskId.replace(/[^a-zA-Z0-9_]/g, '_');
  return sanitized.match(/^[a-zA-Z_]/) ? sanitized : `task_${sanitized}`;
}

/**
 * Create an LLM agent for a task
 */
export function createTaskAgent(
  task: PRDTask,
  llm: BaseLlm,
  config?: PRD['config'],
  context?: string,
): LlmAgent {
  return new LlmAgent({
    name: toAgentName(task.id),
    model: llm,
    description: task.description,
    instruction: buildSystemPrompt(task, config, context),
    // Use NoOp code executor to prevent Gemini-specific code execution errors for Claude
    codeExecutor: new NoOpBuiltInCodeExecutor(),
  });
}

/**
 * Execute a single task
 */
export async function executeTask(
  task: PRDTask,
  config: TaskExecutorConfig,
  prdConfig?: PRD['config'],
): Promise<TaskExecutionResult> {
  const taskStart = Date.now();

  // Set complexity-based timeout if LLM supports it (ClaudeCliLlm, GeminiCliLlm)
  const timeoutMs = getTimeoutForComplexity(task.complexity);
  if ('setTimeoutMs' in config.llm && typeof config.llm.setTimeoutMs === 'function') {
    (config.llm as { setTimeoutMs: (ms: number) => void }).setTimeoutMs(timeoutMs);
    logger.info(
      `Task timeout: ${formatTimeout(timeoutMs)} (complexity: ${task.complexity ?? 'default'})`,
      {
        taskId: task.id,
      },
    );
  }

  config.emit({ type: 'task_started', timestamp: config.now(), taskId: task.id });

  // Inject smart context
  const { injectContext, formatInjectedContext } = await import('../context/injector.js');
  // Use project root from config
  const projectRoot = config.projectRoot;

  const injectedContext = await injectContext(task, projectRoot, {
    includeSchema: true,
    includeRoutes: true,
    includeMemories: true,
  });

  const contextString = formatInjectedContext(injectedContext);

  // Create agent for this task with injected context
  const taskAgent = createTaskAgent(task, config.llm, prdConfig, contextString);

  // Create session for this task
  const session = await config.sessionService.createSession({
    appName: 'ralph-loop',
    userId: 'system',
    state: {
      taskId: task.id,
      attempt: 1,
    },
  });

  // Create runner with plugins
  const runner = new Runner({
    agent: taskAgent,
    appName: 'ralph-loop',
    sessionService: config.sessionService,
    plugins: config.plugins,
  });

  try {
    // Build message as Content object
    const newMessage: Content = {
      role: 'user',
      parts: [{ text: buildTaskPrompt(task) }],
    };

    logger.info('Starting task execution', { taskId: task.id, sessionId: session.id });

    // Run agent
    let lastEvent: Event | undefined;
    let eventCount = 0;

    const runnerIterator = runner.runAsync({
      userId: 'system',
      sessionId: session.id,
      newMessage,
    });
    logger.debug('Got runner iterator, starting iteration', { taskId: task.id });

    try {
      for await (const event of runnerIterator) {
        eventCount++;
        const contentText =
          event.content?.parts?.[0] && 'text' in event.content.parts[0]
            ? (event.content.parts[0] as { text: string }).text.slice(0, 200)
            : '(no text)';
        logger.debug(`Event ${eventCount}`, {
          taskId: task.id,
          author: event.author,
          hasContent: !!event.content,
          textPreview: contentText,
        });
        lastEvent = event;
        await config.handleEvent(event, task.id);
      }
    } catch (iterErr) {
      logger.error(
        `Iterator error: ${iterErr instanceof Error ? iterErr.message : String(iterErr)}`,
        { taskId: task.id },
      );
      throw iterErr;
    }
    logger.info('Runner completed', { taskId: task.id, eventCount });

    // Check result from validation state
    const validationState = lastEvent?.actions?.stateDelta?.['__validation'] as
      | ValidationState
      | undefined;
    logger.debug('Validation state', { taskId: task.id, validationState });

    // Determine success based on multiple factors:
    // 1. Must have received at least 2 events (user message + model response)
    // 2. Validation state must not explicitly fail
    // 3. Last event must not indicate an error
    let success = true;
    let failureReason: string | undefined;

    // Check 1: No model response (e.g., CLI timeout killed the process)
    // Note: The user message event is appended to session but NOT yielded by Runner.
    // Only agent events (model responses, function calls) are yielded.
    // A successful single response yields exactly 1 event, so we check for 0.
    if (eventCount === 0) {
      success = false;
      failureReason = `No model response received (eventCount=${eventCount})`;
      logger.warn('Task failed: no model response', { taskId: task.id, eventCount });
    }

    // Check 2: Validation state explicitly failed
    if (success && validationState?.passed === false) {
      success = false;
      failureReason = 'Validation failed';
      logger.warn('Task failed: validation', { taskId: task.id, validationState });
    }

    // Check 3: Last event contains error (from LLM error response)
    // ADK Event extends LlmResponse, so errorCode/errorMessage are direct properties
    const lastEventError = lastEvent as { errorCode?: string; errorMessage?: string } | undefined;
    logger.debug('Last event error check', {
      taskId: task.id,
      hasLastEvent: !!lastEvent,
      errorCode: lastEventError?.errorCode,
      errorMessage: lastEventError?.errorMessage,
    });
    if (success && lastEventError?.errorCode) {
      success = false;
      failureReason = lastEventError.errorMessage ?? lastEventError.errorCode;
      logger.warn('Task failed: LLM error', { taskId: task.id, error: failureReason });
    }

    // Check 4: Event has no content (empty response - likely CLI failure)
    // If we got events but last event has no meaningful content, something went wrong
    if (success && eventCount > 0 && lastEvent) {
      const hasContent = lastEvent.content?.parts?.some(
        (p) => ('text' in p && p.text) || 'functionCall' in p,
      );
      if (!hasContent) {
        success = false;
        failureReason = 'Empty response from model (no content or function calls)';
        logger.warn('Task failed: empty response', { taskId: task.id, lastEvent });
      }
    }

    logger.info('Success determination', { taskId: task.id, success, failureReason });

    // Run quality gate after successful validation
    if (success && config.qualityGate) {
      logger.info('Running quality gate', { taskId: task.id, phase: 'validation' });
      const qualityGateStart = Date.now();

      try {
        // Determine project root from config
        const projectRoot = config.projectRoot;
        const qualityGateResult = await runQualityGateWithTimeout(projectRoot, config.qualityGate);

        const qualityGateDuration = Date.now() - qualityGateStart;
        logger.timing('Quality gate', qualityGateDuration, { taskId: task.id });
        logger.info('Quality gate result', {
          taskId: task.id,
          passed: qualityGateResult.passed,
          totalIssues: qualityGateResult.summary.totalIssues,
          critical: qualityGateResult.summary.critical,
          high: qualityGateResult.summary.high,
        });

        // Mark task as failed if failOnIssues=true and issues found
        if (config.qualityGate.failOnIssues && !qualityGateResult.passed) {
          success = false;
          failureReason = `Quality gate failed: ${qualityGateResult.summary.totalIssues} issues`;
          logger.warn('Task marked as failed due to quality gate', { taskId: task.id });
        }
      } catch (error) {
        logger.error(
          `Quality gate execution failed: ${error instanceof Error ? error.message : String(error)}`,
          { taskId: task.id },
        );
        // Don't fail the task if quality gate execution itself fails
      }
    }

    logger.info('Task execution complete', { taskId: task.id, success, failureReason });
    const usage = config.costPlugin.getTotalUsage();

    const taskResult = {
      taskId: task.id,
      success,
      attempts: config.retryPlugin.getAttemptCount(session.id) + 1,
      tokensUsed: usage.tokens.totalTokens,
      costUsd: usage.costUsd,
      duration: Date.now() - taskStart,
      fileChanges: [],
      ...(failureReason && { error: failureReason }),
    };

    if (success) {
      config.emit({
        type: 'task_completed',
        timestamp: config.now(),
        taskId: task.id,
        result: taskResult,
      });
    } else {
      config.emit({
        type: 'task_failed',
        timestamp: config.now(),
        taskId: task.id,
        error: failureReason ?? 'Unknown error',
      });
    }

    return taskResult;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    config.emit({
      type: 'task_failed',
      timestamp: config.now(),
      taskId: task.id,
      error: errorMessage,
    });

    return {
      taskId: task.id,
      success: false,
      attempts: config.retryPlugin.getAttemptCount(session.id) + 1,
      tokensUsed: 0,
      costUsd: 0,
      duration: Date.now() - taskStart,
      fileChanges: [],
      error: errorMessage,
    };
  }
}
