/**
 * FelixOrchestrator - ADK-based orchestration wrapper
 *
 * High-level wrapper that:
 * - Loads PRD.json and validates it
 * - Creates ADK agents with appropriate plugins
 * - Orchestrates task execution with validation/retry/cost tracking
 * - Emits events for progress monitoring
 *
 * @module @felix/orchestrator
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import type { BaseLlm, BasePlugin } from '@google/adk';
import {
  detectProvider,
  FallbackRouter,
  getHealthMonitor,
  getLlmFactory,
  type LlmFactory,
  preloadVibeProxyModels,
} from '../models/index.js';
import type { PRDRoutingPlan } from '../router/router.js';
import { createComponentLogger } from '../utils/logger.js';
import {
  createModelRouterIntegration,
  type ModelRouterIntegration,
} from './model-router-integration.js';

const logger = createComponentLogger('felix-orchestrator');

import { InMemorySessionService, Runner } from '@google/adk';
import type { Content } from '@google/genai';
import { completeAttempt, createAttempt } from '../../@storage/felix/index.js';
import { createAgentHierarchy } from '../agents/agent-factory.js';
import type { AgentFactoryConfig } from '../agents/types.js';
import { type QualityGateConfig, runQualityGate } from '../executor/quality-gate.js';
import { createTaskSignature } from '../router/history.js';
import { type PRD, type PRDTask, validatePRD } from '../schemas/prd.schema.js';
import {
  createSQLiteSessionService,
  type SQLiteSessionService,
} from '../services/sqlite-session.js';
import type {
  FelixLoopEvent,
  FelixLoopEventHandler,
  FelixLoopState,
  TaskExecutionResult,
} from '../types.js';
import { type CheckpointManager, createCheckpointManager } from './checkpoint-manager.js';
import { resolveConfig, resolvePrdPath } from './config-resolver.js';
import { createEmitter, createEventHandler, type EventHandlerConfig } from './event-handler.js';
import { prdTaskToAttributes } from './model-router-integration.js';
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
import type { FelixOrchestratorConfig, OrchestratorResult, ResolvedConfig } from './types.js';

// Re-export types for public API
export type { FelixOrchestratorConfig, OrchestratorResult } from './types.js';

/**
 * FelixOrchestrator - Main ADK orchestration wrapper
 */
export class FelixOrchestrator {
  private config: ResolvedConfig;
  private llm: BaseLlm | null = null;
  private factory: LlmFactory;
  private fallbackRouter: FallbackRouter;
  private modelRouter: ModelRouterIntegration | null = null;
  private sessionService: SQLiteSessionService;
  private corePlugins: CorePlugins;
  private plugins: BasePlugin[];
  private state: FelixLoopState;
  private taskResults: TaskExecutionResult[] = [];
  private startTime = 0;
  private eventHandlers: Set<FelixLoopEventHandler> = new Set();
  private abortController: AbortController | null = null;
  private prd: PRD | null = null;
  private routingPlan: PRDRoutingPlan | null = null;
  private signalState: SignalHandlerState;
  private _checkpointManager: CheckpointManager | null = null;

  constructor(config: FelixOrchestratorConfig) {
    this.config = resolveConfig(config);
    // Initialize LLM Factory and FallbackRouter for automatic provider fallback
    this.factory = getLlmFactory({ workingDirectory: this.config.projectRoot });
    this.fallbackRouter = new FallbackRouter(this.factory, getHealthMonitor());

    // Initialize Model Router for per-task model selection
    this.modelRouter = createModelRouterIntegration({
      factory: this.factory,
      projectPath: this.config.projectRoot,
      backend: this.config.backend,
      enableCascade: true,
      verbose: this.config.verbose,
    });
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
      emit: (e: FelixLoopEvent) => this.emit(e),
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

  getState(): FelixLoopState {
    return { ...this.state };
  }

  on(handler: FelixLoopEventHandler): () => void {
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
    this.state.sessionId = `felix-${Date.now()}`;

    // Initialize LLM with automatic fallback
    // Use model router's default provider detection, with VibeProxy as ultimate fallback
    const modelProvider = this.modelRouter
      ? 'vibeproxy' // Model router handles per-task routing, use free VibeProxy for orchestrator
      : (detectProvider(this.config.model) ?? 'vibeproxy');

    logger.info(
      `Initializing LLM with fallback: ${this.config.model} (${this.config.backend}, provider: ${modelProvider})`,
    );
    this.llm = await this.fallbackRouter.getLlmWithFallback(this.config.model, {
      primary: {
        provider: modelProvider,
        backend: modelProvider === 'vibeproxy' ? 'api' : this.config.backend,
      },
      fallbacks: [
        // Try VibeProxy (free, always available if server running)
        { provider: 'vibeproxy', backend: 'api' },
        // Try Google CLI
        { provider: 'google', backend: 'cli' },
        // Try Anthropic API
        { provider: 'anthropic', backend: 'api' },
        // Try Google API
        { provider: 'google', backend: 'api' },
      ],
      maxRetries: 4,
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

    // Preload VibeProxy model cache for dynamic alias resolution
    try {
      await preloadVibeProxyModels();
      if (this.config.verbose) {
        logger.info('VibeProxy model cache preloaded');
      }
    } catch {
      // Non-fatal: static aliases will be used as fallback
      if (this.config.verbose) {
        logger.warn('Failed to preload VibeProxy models, using static aliases');
      }
    }

    try {
      // =====================================================================
      // STEP 1: Route PRD through Model Router to determine execution mode
      // =====================================================================
      if (this.modelRouter) {
        this.routingPlan = this.modelRouter.routePRD(prd);

        logger.info(
          `Router decision: ${this.routingPlan.overallMode} mode - ${this.routingPlan.overallPlan.reason}`,
        );
      }

      // Determine execution mode from Router decision (not from config)
      const useMultiAgent = this.routingPlan?.overallMode === 'multi';
      const useParallel =
        this.routingPlan?.overallPlan.parallelizable ?? this.config.enableParallelExecution;

      // =====================================================================
      // STEP 2: Execute based on Router's decision
      // =====================================================================
      if (useMultiAgent) {
        // Multi-agent mode with ADK SequentialAgent/ParallelAgent
        if (this.config.verbose) {
          logger.info('Running multi-agent execution mode (Router decision)');
        }
        await this.runMultiAgent(prd);
      } else if (useParallel) {
        // Parallel execution within single agent
        await this.runParallel(prd);
      } else {
        // Sequential execution
        if (this.config.verbose) {
          logger.info('Running sequential execution (Router decision)');
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

      // Run quality gate at the END of PRD execution (not after each task)
      if (this.config.qualityGateMode) {
        const qualityGateResult = await this.runFinalQualityGate();
        if (!qualityGateResult.passed) {
          logger.warn('Quality gate failed', {
            totalIssues: qualityGateResult.summary.totalIssues,
            critical: qualityGateResult.summary.critical,
            high: qualityGateResult.summary.high,
          });
          // Don't fail the entire PRD, just log the issues
          this.emit({
            type: 'quality_gate_failed',
            timestamp: this.now(),
            issues: qualityGateResult.issues,
            summary: qualityGateResult.summary,
          } as FelixLoopEvent);
        } else {
          logger.info('Quality gate passed', {
            duration: qualityGateResult.summary.duration,
          });
        }
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
    this.routingPlan = null;
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

    logger.info('Running multi-agent execution mode with Model Router');

    // Build agent factory config with Model Router for per-task model selection
    const factoryConfig: AgentFactoryConfig = {
      llm: this.llm, // Fallback LLM
      projectRoot: this.config.projectRoot,
      tools: [], // Worker agents use CLI tools via LLM
      enableParallel: this.config.enableParallelExecution,
      maxParallelTasks: this.config.maxParallelTasks,
      verbose: this.config.verbose,
      // Only include getLlmForTask if modelRouter is available
      ...(this.modelRouter && {
        getLlmForTask: (task: PRDTask) => this.modelRouter!.getLlmForTask(task),
      }),
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
      appName: 'felix-multi-agent',
      sessionService: multiAgentSessionService,
      plugins: this.plugins,
    });

    // Create session
    const session = await multiAgentSessionService.createSession({
      appName: 'felix-multi-agent',
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
    // Generate signature hash for history tracking
    const taskAttrs = prdTaskToAttributes(task);
    const signature = createTaskSignature(taskAttrs);

    // Use Model Router for per-task model selection
    if (this.modelRouter) {
      // Try to find pre-computed decision from routing plan
      const precomputedDecision = this.routingPlan?.taskDecisions.find((d) => d.taskId === task.id);

      let decision = precomputedDecision;
      let taskLlm: BaseLlm;

      if (decision) {
        // Use pre-computed decision
        taskLlm = this.modelRouter.getLlmForDecision(decision);
        logger.info(`[Router] Task ${task.id} → ${decision.selectedModel} (pre-computed)`, {
          taskId: task.id,
          model: decision.selectedModel,
          tier: decision.tier,
          source: decision.source,
          score: decision.score,
          executionMode: decision.execution.mode,
        });
      } else {
        // Compute decision on-the-fly (for dynamically added tasks like fix-typecheck)
        const result = this.modelRouter.getLlmForTask(task);
        taskLlm = result.llm;
        decision = result.decision;

        logger.info(`[Router] Task ${task.id} → ${decision.selectedModel} (computed)`, {
          taskId: task.id,
          model: decision.selectedModel,
          tier: decision.tier,
          source: decision.source,
          score: decision.score,
          executionMode: decision.execution.mode,
        });
      }

      // Create attempt record BEFORE execution
      let attemptId: number | undefined;
      try {
        // Use a simple hash of the prdTaskId as the numeric taskId
        const numericTaskId = Math.abs(task.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0));
        attemptId = createAttempt({
          taskId: numericTaskId,
          prdTaskId: task.id,
          attemptNumber: 1, // First attempt (escalation would create new attempts)
          model: decision.selectedModel,
          signatureHash: signature.hash,
          projectPath: this.config.projectRoot,
        });
        logger.debug('Created attempt record', {
          attemptId,
          taskId: task.id,
          model: decision.selectedModel,
        });
      } catch (err) {
        logger.warn(`Failed to create attempt record: ${err}`);
      }

      // Create config with task-specific LLM
      const taskConfig = this.createTaskExecutorConfigWithLlm(taskLlm);
      const result = await executeTask(task, taskConfig, prdConfig);

      // Complete attempt record AFTER execution
      if (attemptId !== undefined) {
        try {
          completeAttempt(attemptId, {
            success: result.success,
            inputTokens: result.tokensUsed, // Total tokens (we don't split in/out here)
            outputTokens: 0,
            costUsd: result.costUsd,
            filesModified: result.fileChanges.map((fc) => fc.path),
            validationPassed: result.success,
            ...(result.error && { errorMessage: result.error }),
            projectPath: this.config.projectRoot,
          });
          logger.debug('Completed attempt record', { attemptId, success: result.success });
        } catch (err) {
          logger.warn(`Failed to complete attempt record: ${err}`);
        }
      }

      // Record result for routing patterns (history learning)
      this.modelRouter.recordAttempt(decision, result.success, result.costUsd);

      return result;
    }

    // Fallback to default LLM (without model router)
    // Still track attempt for history
    let attemptId: number | undefined;
    try {
      const numericTaskId = Math.abs(task.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0));
      attemptId = createAttempt({
        taskId: numericTaskId,
        prdTaskId: task.id,
        attemptNumber: 1,
        model: this.config.model,
        signatureHash: signature.hash,
        projectPath: this.config.projectRoot,
      });
    } catch (err) {
      logger.warn(`Failed to create attempt record: ${err}`);
    }

    const result = await executeTask(task, this.createTaskExecutorConfig(), prdConfig);

    if (attemptId !== undefined) {
      try {
        completeAttempt(attemptId, {
          success: result.success,
          inputTokens: result.tokensUsed,
          outputTokens: 0,
          costUsd: result.costUsd,
          filesModified: result.fileChanges.map((fc) => fc.path),
          validationPassed: result.success,
          ...(result.error && { errorMessage: result.error }),
          projectPath: this.config.projectRoot,
        });
      } catch (err) {
        logger.warn(`Failed to complete attempt record: ${err}`);
      }
    }

    return result;
  }

  private createTaskExecutorConfigWithLlm(llm: BaseLlm): TaskExecutorConfig {
    const eventConfig: EventHandlerConfig = {
      onEvent: this.config.onEvent,
      eventHandlers: this.eventHandlers,
      now: () => this.now(),
    };
    return {
      llm,
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

  private now(): string {
    return new Date().toISOString();
  }

  private emit(event: FelixLoopEvent): void {
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
      setState: (status: FelixLoopState['status']) => {
        this.state.status = status;
      },
      cancel: () => this.cancel(),
      emit: (event: FelixLoopEvent) => this.emit(event),
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
   * Run quality gate at the end of PRD execution
   */
  private async runFinalQualityGate() {
    logger.info('Running quality gate');

    const config: QualityGateConfig = {
      enabled: true,
      auditMode: this.config.qualityGateMode ?? 'pre-commit',
      failOnIssues: true,
    };

    return runQualityGate(this.config.projectRoot, config);
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
  config: Omit<FelixOrchestratorConfig, 'projectRoot'> & { projectRoot?: string },
): Promise<{ orchestrator: FelixOrchestrator; prd: PRD }> {
  const { readFile } = await import('node:fs/promises');
  const { dirname, resolve } = await import('node:path');

  const content = await readFile(prdPath, 'utf-8');
  const validation = validatePRD(JSON.parse(content));

  if (!validation.success) {
    throw new Error(`Invalid PRD: ${validation.errors.join('; ')}`);
  }

  const projectRoot = config.projectRoot ?? dirname(resolve(prdPath));
  const orchestrator = new FelixOrchestrator({ ...config, projectRoot });

  return { orchestrator, prd: validation.data };
}
