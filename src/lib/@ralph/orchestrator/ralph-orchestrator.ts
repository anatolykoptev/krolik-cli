/**
 * RalphOrchestrator - ADK-based orchestration wrapper
 *
 * High-level wrapper that:
 * - Loads PRD.json and validates it
 * - Creates ADK agents with appropriate plugins
 * - Orchestrates task execution with validation/retry/cost tracking
 * - Emits events for progress monitoring
 *
 * @module @ralph/orchestrator
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import type { BaseLlm, BasePlugin } from '@google/adk';
import { FallbackRouter, getHealthMonitor, getModelRegistry } from '../models/index.js';
import { createComponentLogger } from '../utils/logger.js';

const logger = createComponentLogger('ralph-orchestrator');

import { InMemorySessionService, Runner } from '@google/adk';
import type { Content } from '@google/genai';
import { createAgentHierarchy } from '../agents/agent-factory.js';
import type { AgentFactoryConfig } from '../agents/types.js';
import { type PRD, type PRDTask, validatePRD } from '../schemas/prd.schema.js';
import {
  createSQLiteSessionService,
  type SQLiteSessionService,
} from '../services/sqlite-session.js';
import type {
  RalphLoopEvent,
  RalphLoopEventHandler,
  RalphLoopState,
  TaskExecutionResult,
} from '../types.js';
import { type CheckpointManager, createCheckpointManager } from './checkpoint-manager.js';
import { resolveConfig, resolvePrdPath } from './config-resolver.js';
import { createEmitter, createEventHandler, type EventHandlerConfig } from './event-handler.js';
import {
  executeTasksInParallel,
  filterRunnableTasks,
  groupTasksByLevel,
  processTaskResults,
} from './parallel-executor.js';
import {
  buildPluginList,
  type CorePlugins,
  createCostPlugin,
  createRetryPlugin,
  createValidationPlugin,
} from './plugin-factory.js';
import { runSequential } from './sequential-runner.js';
import {
  cleanup,
  createSignalHandlerState,
  removeSignalHandlers,
  type SignalHandlerState,
  setupSignalHandlers,
} from './signal-handler.js';
import { createInitialState, createResult, determineFinalStatus } from './state-manager.js';
import { executeTask, type TaskExecutorConfig } from './task-executor.js';
import type { OrchestratorResult, RalphOrchestratorConfig, ResolvedConfig } from './types.js';

// Re-export types for public API
export type { OrchestratorResult, RalphOrchestratorConfig } from './types.js';

/**
 * RalphOrchestrator - Main ADK orchestration wrapper
 */
export class RalphOrchestrator {
  private config: ResolvedConfig;
  private llm: BaseLlm | null = null;
  private fallbackRouter: FallbackRouter;
  private sessionService: SQLiteSessionService;
  private corePlugins: CorePlugins;
  private plugins: BasePlugin[];
  private state: RalphLoopState;
  private taskResults: TaskExecutionResult[] = [];
  private startTime = 0;
  private eventHandlers: Set<RalphLoopEventHandler> = new Set();
  private abortController: AbortController | null = null;
  private prd: PRD | null = null;
  private signalState: SignalHandlerState;
  private _checkpointManager: CheckpointManager | null = null;

  constructor(config: RalphOrchestratorConfig) {
    this.config = resolveConfig(config);
    // Initialize FallbackRouter for automatic provider fallback
    const registry = getModelRegistry({ workingDirectory: this.config.projectRoot });
    this.fallbackRouter = new FallbackRouter(registry, getHealthMonitor());
    // Use central krolik.db via factory function
    this.sessionService = createSQLiteSessionService(this.config.projectRoot, {
      autoCleanup: false,
    });
    this.signalState = createSignalHandlerState();

    if (this.config.enableCheckpoints) {
      // Use central krolik.db via factory function
      this._checkpointManager = createCheckpointManager(this.config.projectRoot);
    }

    const pluginDeps = {
      config: this.config,
      emit: (e: RalphLoopEvent) => this.emit(e),
      now: () => this.now(),
    };
    this.corePlugins = {
      costPlugin: createCostPlugin(pluginDeps),
      retryPlugin: createRetryPlugin(this.config),
      validationPlugin: createValidationPlugin(this.config),
    };
    this.plugins = buildPluginList(this.corePlugins, pluginDeps);
    this.state = createInitialState();
  }

  // ==========================================================================
  // PUBLIC METHODS
  // ==========================================================================

  getState(): RalphLoopState {
    return { ...this.state };
  }

  on(handler: RalphLoopEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  async start(): Promise<void> {
    if (this.state.status === 'running') {
      throw new Error('Orchestrator is already running');
    }

    this.abortController = new AbortController();
    this.state.status = 'running';
    this.state.startedAt = this.now();
    this.state.sessionId = `ralph-${Date.now()}`;

    // Initialize LLM with automatic fallback
    logger.info(`Initializing LLM with fallback: ${this.config.model} (${this.config.backend})`);
    this.llm = await this.fallbackRouter.getLlmWithFallback(this.config.model, {
      primary: {
        provider: this.config.backend === 'cli' ? 'anthropic' : 'anthropic',
        backend: this.config.backend,
      },
    });
    logger.info(`LLM initialized successfully`);

    setupSignalHandlers(this.signalState, this.createSignalHandlerConfig());

    const prdPath = resolvePrdPath(this.config);
    if (!existsSync(prdPath)) {
      throw new Error(`PRD file not found: ${prdPath}`);
    }

    const content = readFileSync(prdPath, 'utf-8');
    const validation = validatePRD(JSON.parse(content));

    if (!validation.success) {
      throw new Error(`Invalid PRD: ${validation.errors.join('; ')}`);
    }

    this.prd = validation.data;
    await this.run(this.prd);
  }

  pause(): void {
    if (this.state.status !== 'running') return;
    this.state.status = 'paused';
  }

  async resume(): Promise<void> {
    if (this.state.status !== 'paused') {
      throw new Error('Orchestrator is not paused');
    }
    this.state.status = 'running';
    if (this.prd) await this.run(this.prd);
  }

  cancel(): void {
    this.abortController?.abort();
    this.state.status = 'cancelled';
    this.state.completedAt = this.now();
  }

  async run(prd: PRD): Promise<OrchestratorResult> {
    this.startTime = Date.now();
    this.state.status = 'running';
    this.state.startedAt = this.now();

    this.emit({ type: 'loop_started', timestamp: this.now() });

    if (this.config.verbose) {
      logger.info(`Starting run with ${prd.tasks.length} tasks`);
    }

    try {
      // Choose execution mode
      if (this.config.useMultiAgentMode) {
        // True multi-agent mode with ADK SequentialAgent/ParallelAgent
        if (this.config.verbose) {
          logger.info('Running multi-agent execution mode');
        }
        await this.runMultiAgent(prd);
      } else if (this.config.enableParallelExecution) {
        await this.runParallel(prd);
      } else {
        if (this.config.verbose) {
          logger.info('Running sequential execution');
        }
        const results = await runSequential(
          prd,
          this.state,
          (task, cfg) => this.executeTaskInternal(task, cfg),
          {
            continueOnFailure: this.config.continueOnFailure,
            isAborted: () => this.abortController?.signal.aborted ?? false,
            isRunning: () => this.state.status === 'running',
          },
        );
        if (this.config.verbose) {
          logger.info(`Sequential results: ${results.length} tasks`);
        }
        this.taskResults.push(...results);
      }

      // Run final validation (typecheck) after all tasks complete
      const validationResult = await this.runFinalValidation(prd);
      if (validationResult) {
        this.taskResults.push(validationResult);
      }

      const finalStatus = determineFinalStatus(this.state, this.abortController);
      this.state.status = finalStatus;
      this.state.completedAt = this.now();

      this.emit({ type: 'loop_completed', timestamp: this.now(), state: this.state });
      return createResult(
        finalStatus === 'completed',
        this.state,
        this.taskResults,
        this.corePlugins.costPlugin,
        this.startTime,
      );
    } catch (error) {
      this.state.status = 'failed';
      this.state.completedAt = this.now();
      this.emit({
        type: 'loop_failed',
        timestamp: this.now(),
        error: error instanceof Error ? error.message : String(error),
      });
      return createResult(
        false,
        this.state,
        this.taskResults,
        this.corePlugins.costPlugin,
        this.startTime,
      );
    } finally {
      await cleanup(this.signalState, this.sessionService);
    }
  }

  getCostSummary(): {
    tokens: { inputTokens: number; outputTokens: number; totalTokens: number };
    costUsd: number;
  } {
    return this.corePlugins.costPlugin.getTotalUsage();
  }

  getCheckpointManager(): CheckpointManager | null {
    return this._checkpointManager;
  }

  reset(): void {
    removeSignalHandlers(this.signalState);
    this.state = createInitialState();
    this.taskResults = [];
    this.corePlugins.costPlugin.reset();
    this.prd = null;
    this.abortController = null;
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  private async runParallel(prd: PRD): Promise<void> {
    const levels = groupTasksByLevel(prd.tasks);

    for (const level of levels) {
      if (this.abortController?.signal.aborted) break;
      if (this.state.status !== 'running') break;

      const { runnableTasks, skippedTasks } = filterRunnableTasks(level, this.state);
      this.state.skippedTasks.push(...skippedTasks);

      if (runnableTasks.length === 0) continue;

      const results = await executeTasksInParallel(
        runnableTasks,
        (task) => this.executeTaskInternal(task, prd.config),
        {
          maxParallelTasks: this.config.maxParallelTasks,
          continueOnFailure: this.config.continueOnFailure,
          isAborted: () => this.abortController?.signal.aborted ?? false,
          isRunning: () => this.state.status === 'running',
        },
      );

      this.taskResults.push(...results);
      const { shouldBreak } = processTaskResults(
        results,
        this.state,
        this.config.continueOnFailure,
      );
      if (shouldBreak) break;
    }
  }

  /**
   * Run using true multi-agent architecture with ADK SequentialAgent/ParallelAgent
   *
   * Creates a hierarchical agent structure where:
   * - OrchestratorAgent coordinates execution
   * - Level agents (Sequential/Parallel) handle dependency groups
   * - Worker agents execute individual tasks
   * - State is shared via outputKey mechanism
   */
  private async runMultiAgent(prd: PRD): Promise<void> {
    if (!this.llm) {
      throw new Error('LLM not initialized');
    }

    logger.info('Running multi-agent execution mode');

    // Build agent factory config
    const factoryConfig: AgentFactoryConfig = {
      llm: this.llm,
      projectRoot: this.config.projectRoot,
      tools: [], // Worker agents use CLI tools via LLM
      enableParallel: this.config.enableParallelExecution,
      maxParallelTasks: this.config.maxParallelTasks,
      verbose: this.config.verbose,
    };

    // Create agent hierarchy from PRD
    const orchestratorAgent = createAgentHierarchy(prd, factoryConfig);

    if (this.config.verbose) {
      logger.info('Agent hierarchy created', {
        rootAgent: orchestratorAgent.name,
        taskCount: prd.tasks.length,
      });
    }

    // Create in-memory session for multi-agent execution
    const multiAgentSessionService = new InMemorySessionService();

    // Create runner with orchestrator agent
    const runner = new Runner({
      agent: orchestratorAgent,
      appName: 'ralph-multi-agent',
      sessionService: multiAgentSessionService,
      plugins: this.plugins,
    });

    // Create session
    const session = await multiAgentSessionService.createSession({
      appName: 'ralph-multi-agent',
      userId: 'system',
    });

    // Initial message to start orchestration
    const startMessage: Content = {
      role: 'user',
      parts: [
        {
          text: `Execute PRD "${prd.project}" with ${prd.tasks.length} tasks.
Coordinate the worker agents to complete all tasks in dependency order.
Report progress and handle any failures appropriately.`,
        },
      ],
    };

    try {
      // Run the multi-agent hierarchy
      let eventCount = 0;

      for await (const event of runner.runAsync({
        userId: 'system',
        sessionId: session.id,
        newMessage: startMessage,
      })) {
        eventCount++;

        if (this.config.verbose) {
          logger.debug('Multi-agent event', {
            eventNum: eventCount,
            author: event.author,
            hasContent: !!event.content,
          });
        }

        // Track task completions from state delta
        if (event.actions?.stateDelta) {
          for (const [key, value] of Object.entries(event.actions.stateDelta)) {
            if (key.startsWith('task:') && key.endsWith(':result')) {
              const taskResult = value as { success: boolean; taskId: string };
              if (taskResult.success) {
                this.state.completedTasks.push(taskResult.taskId);
              } else {
                this.state.failedTasks.push(taskResult.taskId);
              }
            }
          }
        }

        // Check for abort
        if (this.abortController?.signal.aborted) {
          logger.info('Multi-agent execution aborted');
          break;
        }
      }

      logger.info('Multi-agent execution completed', { eventCount });

      // Log final stats from tracked state
      if (this.config.verbose) {
        logger.info('Multi-agent final stats', {
          completed: this.state.completedTasks.length,
          failed: this.state.failedTasks.length,
        });
      }
    } catch (error) {
      logger.error('Multi-agent execution failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async executeTaskInternal(
    task: PRDTask,
    prdConfig?: PRD['config'],
  ): Promise<TaskExecutionResult> {
    return executeTask(task, this.createTaskExecutorConfig(), prdConfig);
  }

  private now(): string {
    return new Date().toISOString();
  }

  private emit(event: RalphLoopEvent): void {
    this.config.onEvent(event);
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (error) {
        // Security: Log handler errors instead of silently swallowing them
        logger.error(
          `Event handler failed for ${event.type}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  private createTaskExecutorConfig(): TaskExecutorConfig {
    if (!this.llm) {
      throw new Error('LLM not initialized. Call start() first.');
    }
    const eventConfig: EventHandlerConfig = {
      onEvent: this.config.onEvent,
      eventHandlers: this.eventHandlers,
      now: () => this.now(),
    };
    return {
      llm: this.llm,
      sessionService: this.sessionService,
      plugins: this.plugins,
      retryPlugin: this.corePlugins.retryPlugin,
      costPlugin: this.corePlugins.costPlugin,
      emit: createEmitter(eventConfig),
      handleEvent: createEventHandler(eventConfig),
      now: () => this.now(),
      projectRoot: this.config.projectRoot,
    };
  }

  private createSignalHandlerConfig() {
    return {
      getState: () => this.state,
      setState: (status: RalphLoopState['status']) => {
        this.state.status = status;
      },
      cancel: () => this.cancel(),
      emit: (event: RalphLoopEvent) => this.emit(event),
      now: () => this.now(),
    };
  }

  /**
   * Run final validation (typecheck) after all tasks complete.
   * If validation fails, creates and executes a fix task.
   */
  private async runFinalValidation(prd: PRD): Promise<TaskExecutionResult | null> {
    if (this.abortController?.signal.aborted) return null;
    if (this.state.status !== 'running') return null;

    logger.info('Running final validation (typecheck)');

    // Run typecheck
    const typecheckResult = this.runTypecheck();

    if (typecheckResult.success) {
      logger.info('Final validation passed');
      return null;
    }

    // Typecheck failed - create and run fix task
    logger.warn('Final validation failed, creating fix task', {
      errorCount: typecheckResult.errors.split('\n').length,
    });

    const fixTask: PRDTask = {
      id: 'fix-typecheck-errors',
      title: 'Fix TypeScript errors from previous tasks',
      description: `The previous tasks introduced TypeScript errors. Fix all the following errors:\n\n${typecheckResult.errors}`,
      complexity: 'moderate',
      priority: 'high',
      acceptance_criteria: [
        'All TypeScript errors must be fixed',
        'Run pnpm typecheck and verify it passes with 0 errors',
        'Do not break existing functionality',
      ],
      files_affected: this.extractFilesFromErrors(typecheckResult.errors),
      dependencies: [],
      tags: ['auto-fix', 'typecheck'],
      labels: ['bugfix'],
      relatedFiles: [],
    };

    // Execute the fix task
    const fixResult = await this.executeTaskInternal(fixTask, prd.config);

    // Update state
    if (fixResult.success) {
      this.state.completedTasks.push(fixTask.id);
    } else {
      this.state.failedTasks.push(fixTask.id);
    }

    return fixResult;
  }

  /**
   * Run typecheck and return result
   */
  private runTypecheck(): { success: boolean; errors: string } {
    try {
      execSync('pnpm typecheck', {
        cwd: this.config.projectRoot,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 5 * 60 * 1000, // 5 minutes
      });
      return { success: true, errors: '' };
    } catch (error) {
      const execError = error as { stdout?: string; stderr?: string; message?: string };
      const errors = execError.stdout || execError.stderr || execError.message || 'Unknown error';
      return { success: false, errors };
    }
  }

  /**
   * Extract file paths from typecheck error output
   */
  private extractFilesFromErrors(errors: string): string[] {
    // Match patterns like "file.ts(10,5):" or "file.tsx:10:5"
    const filePattern = /([^\s]+\.tsx?)\(?[\d,]+\)?:/g;
    const files = new Set<string>();
    let match;
    while ((match = filePattern.exec(errors)) !== null) {
      if (match[1]) {
        files.add(match[1]);
      }
    }
    return [...files].slice(0, 10); // Limit to 10 files
  }
}

/**
 * Create orchestrator from PRD file
 */
export async function createOrchestrator(
  prdPath: string,
  config: Omit<RalphOrchestratorConfig, 'projectRoot'> & { projectRoot?: string },
): Promise<{ orchestrator: RalphOrchestrator; prd: PRD }> {
  const { readFile } = await import('node:fs/promises');
  const { dirname, resolve } = await import('node:path');

  const content = await readFile(prdPath, 'utf-8');
  const validation = validatePRD(JSON.parse(content));

  if (!validation.success) {
    throw new Error(`Invalid PRD: ${validation.errors.join('; ')}`);
  }

  const projectRoot = config.projectRoot ?? dirname(resolve(prdPath));
  const orchestrator = new RalphOrchestrator({ ...config, projectRoot });

  return { orchestrator, prd: validation.data };
}
