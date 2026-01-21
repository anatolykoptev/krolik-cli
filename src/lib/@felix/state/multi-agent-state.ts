/**
 * Multi-Agent State Manager
 *
 * Provides typed helpers for cross-agent state communication
 * using ADK's session state mechanism.
 *
 * @module @felix/state/multi-agent-state
 */

import type { OrchestratorResult, PrdPhase, TaskResult } from '../agents/types.js';
import { STATE_KEYS } from '../agents/types.js';

/**
 * ADK session state interface (subset of what we use)
 */
interface SessionState {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
}

/**
 * Multi-Agent State Manager
 *
 * Wraps ADK session state with typed accessors for Felix
 */
export class MultiAgentState {
  constructor(private readonly state: SessionState) {}

  // ============ Task Results ============

  /**
   * Get result of a specific task
   */
  getTaskResult(taskId: string): TaskResult | undefined {
    return this.state.get(STATE_KEYS.taskResult(taskId)) as TaskResult | undefined;
  }

  /**
   * Set result for a task
   */
  setTaskResult(taskId: string, result: TaskResult): void {
    this.state.set(STATE_KEYS.taskResult(taskId), result);
  }

  /**
   * Get files changed by a task
   */
  getTaskFiles(taskId: string): string[] {
    return (this.state.get(STATE_KEYS.taskFiles(taskId)) as string[]) ?? [];
  }

  /**
   * Set files changed by a task
   */
  setTaskFiles(taskId: string, files: string[]): void {
    this.state.set(STATE_KEYS.taskFiles(taskId), files);
  }

  /**
   * Get task error if any
   */
  getTaskError(taskId: string): string | undefined {
    return this.state.get(STATE_KEYS.taskError(taskId)) as string | undefined;
  }

  /**
   * Set task error
   */
  setTaskError(taskId: string, error: string): void {
    this.state.set(STATE_KEYS.taskError(taskId), error);
  }

  // ============ Level Tracking ============

  /**
   * Get completed task IDs for a level
   */
  getLevelCompleted(level: number): string[] {
    return (this.state.get(STATE_KEYS.levelCompleted(level)) as string[]) ?? [];
  }

  /**
   * Mark a task as completed in its level
   */
  markTaskCompleted(level: number, taskId: string): void {
    const completed = this.getLevelCompleted(level);
    if (!completed.includes(taskId)) {
      completed.push(taskId);
      this.state.set(STATE_KEYS.levelCompleted(level), completed);
    }
  }

  /**
   * Get failed task IDs for a level
   */
  getLevelFailed(level: number): string[] {
    return (this.state.get(STATE_KEYS.levelFailed(level)) as string[]) ?? [];
  }

  /**
   * Mark a task as failed in its level
   */
  markTaskFailed(level: number, taskId: string): void {
    const failed = this.getLevelFailed(level);
    if (!failed.includes(taskId)) {
      failed.push(taskId);
      this.state.set(STATE_KEYS.levelFailed(level), failed);
    }
  }

  // ============ Accumulated Context ============

  /**
   * Get accumulated changes from all previous tasks
   */
  getAccumulatedChanges(): string {
    return (this.state.get(STATE_KEYS.accumulatedChanges) as string) ?? '';
  }

  /**
   * Append to accumulated changes
   */
  appendAccumulatedChanges(taskId: string, summary: string): void {
    const existing = this.getAccumulatedChanges();
    const newContent = `${existing}\n\n### ${taskId}\n${summary}`.trim();
    this.state.set(STATE_KEYS.accumulatedChanges, newContent);
  }

  /**
   * Get accumulated warnings
   */
  getWarnings(): string[] {
    return (this.state.get(STATE_KEYS.warnings) as string[]) ?? [];
  }

  /**
   * Add a warning
   */
  addWarning(warning: string): void {
    const warnings = this.getWarnings();
    warnings.push(warning);
    this.state.set(STATE_KEYS.warnings, warnings);
  }

  /**
   * Get learned patterns
   */
  getLearnedPatterns(): string[] {
    return (this.state.get(STATE_KEYS.learnedPatterns) as string[]) ?? [];
  }

  /**
   * Add a learned pattern
   */
  addLearnedPattern(pattern: string): void {
    const patterns = this.getLearnedPatterns();
    if (!patterns.includes(pattern)) {
      patterns.push(pattern);
      this.state.set(STATE_KEYS.learnedPatterns, patterns);
    }
  }

  // ============ PRD Metadata ============

  /**
   * Get current PRD phase
   */
  getPrdPhase(): PrdPhase {
    return (this.state.get(STATE_KEYS.prdCurrentPhase) as PrdPhase) ?? 'planning';
  }

  /**
   * Set current PRD phase
   */
  setPrdPhase(phase: PrdPhase): void {
    this.state.set(STATE_KEYS.prdCurrentPhase, phase);
  }

  /**
   * Initialize PRD metadata
   */
  initializePrd(version: string, totalTasks: number): void {
    this.state.set(STATE_KEYS.prdVersion, version);
    this.state.set(STATE_KEYS.prdTotalTasks, totalTasks);
    this.setPrdPhase('planning');
  }

  // ============ Orchestrator Result ============

  /**
   * Get orchestrator result
   */
  getOrchestratorResult(): OrchestratorResult | undefined {
    return this.state.get(STATE_KEYS.orchestratorResult) as OrchestratorResult | undefined;
  }

  /**
   * Set orchestrator result
   */
  setOrchestratorResult(result: OrchestratorResult): void {
    this.state.set(STATE_KEYS.orchestratorResult, result);
  }

  // ============ Aggregate Helpers ============

  /**
   * Get results from all tasks in previous levels
   *
   * @param currentLevel - Current level index (0-based)
   * @param taskIds - All task IDs organized by level
   */
  getPreviousLevelResults(
    currentLevel: number,
    taskIdsByLevel: string[][],
  ): Map<string, TaskResult> {
    const results = new Map<string, TaskResult>();

    for (let level = 0; level < currentLevel; level++) {
      const levelTaskIds = taskIdsByLevel[level] ?? [];
      for (const taskId of levelTaskIds) {
        const result = this.getTaskResult(taskId);
        if (result) {
          results.set(taskId, result);
        }
      }
    }

    return results;
  }

  /**
   * Get all files changed so far
   */
  getAllFilesChanged(taskIds: string[]): string[] {
    const allFiles: string[] = [];
    for (const taskId of taskIds) {
      const files = this.getTaskFiles(taskId);
      for (const file of files) {
        if (!allFiles.includes(file)) {
          allFiles.push(file);
        }
      }
    }
    return allFiles;
  }

  /**
   * Build context summary for injection into prompts
   */
  buildContextSummary(): string {
    const parts: string[] = [];

    const accumulated = this.getAccumulatedChanges();
    if (accumulated) {
      parts.push('## Changes Made So Far');
      parts.push(accumulated);
    }

    const warnings = this.getWarnings();
    if (warnings.length > 0) {
      parts.push('## Warnings');
      parts.push(warnings.map((w) => `- ${w}`).join('\n'));
    }

    const patterns = this.getLearnedPatterns();
    if (patterns.length > 0) {
      parts.push('## Learned Patterns');
      parts.push(patterns.map((p) => `- ${p}`).join('\n'));
    }

    return parts.join('\n\n');
  }

  /**
   * Calculate aggregate statistics
   */
  calculateStats(taskIds: string[]): {
    completed: number;
    failed: number;
    totalTokens: number;
    totalCostUsd: number;
  } {
    let completed = 0;
    let failed = 0;
    let totalTokens = 0;
    let totalCostUsd = 0;

    for (const taskId of taskIds) {
      const result = this.getTaskResult(taskId);
      if (result) {
        if (result.success) {
          completed++;
        } else {
          failed++;
        }
        totalTokens += result.tokensUsed;
        totalCostUsd += result.costUsd;
      }
    }

    return { completed, failed, totalTokens, totalCostUsd };
  }
}

/**
 * Create a MultiAgentState wrapper from raw session state
 */
export function createMultiAgentState(state: SessionState): MultiAgentState {
  return new MultiAgentState(state);
}
