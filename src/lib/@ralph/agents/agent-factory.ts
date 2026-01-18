/**
 * Agent Factory - Converts PRD to ADK agent hierarchy
 *
 * Creates a multi-agent structure using ADK's SequentialAgent and ParallelAgent
 * for coordinated task execution with shared state.
 *
 * @module @ralph/agents/agent-factory
 */

import { type BaseAgent, ParallelAgent, SequentialAgent } from '@google/adk';
import { groupTasksByLevel } from '../orchestrator/parallel-executor.js';
import type { PRD, PRDTask } from '../schemas/prd.schema.js';
import { createOrchestratorAgent } from './orchestrator-agent.js';
import type { AgentFactoryConfig, TaskLevel } from './types.js';
import { createWorkerAgent } from './worker-agent.js';

/**
 * Convert task ID to valid agent name (JS identifier)
 */
export function toAgentName(taskId: string): string {
  return taskId.replace(/[^a-zA-Z0-9_]/g, '_');
}

/**
 * Analyze task levels for parallelization opportunities
 */
export function analyzeTaskLevels(tasks: PRDTask[]): TaskLevel[] {
  const levelGroups = groupTasksByLevel(tasks);

  return levelGroups.map((levelTasks, levelIndex) => {
    // Check if all tasks in this level can run in parallel
    // They can if none depend on each other (only on previous levels)
    const taskIds = new Set(levelTasks.map((t) => t.id));
    const isParallelizable = levelTasks.every((task) =>
      task.dependencies.every((dep) => !taskIds.has(dep)),
    );

    return {
      levelIndex,
      tasks: levelTasks,
      isParallelizable,
    };
  });
}

/**
 * Create agent for a single level of tasks
 */
function createLevelAgent(level: TaskLevel, config: AgentFactoryConfig): BaseAgent {
  const { levelIndex, tasks, isParallelizable } = level;

  // Single task - create worker directly
  if (tasks.length === 1 && tasks[0]) {
    return createWorkerAgent(tasks[0], config, levelIndex);
  }

  // Multiple independent tasks - use ParallelAgent
  if (isParallelizable && config.enableParallel) {
    return new ParallelAgent({
      name: `parallel_level_${levelIndex}`,
      description: `Executes ${tasks.length} independent tasks in parallel`,
      subAgents: tasks.map((task) => createWorkerAgent(task, config, levelIndex)),
    });
  }

  // Multiple dependent tasks - use SequentialAgent
  return new SequentialAgent({
    name: `sequential_level_${levelIndex}`,
    description: `Executes ${tasks.length} tasks sequentially`,
    subAgents: tasks.map((task) => createWorkerAgent(task, config, levelIndex)),
  });
}

/**
 * Create the complete agent hierarchy from PRD
 *
 * Structure:
 * ```
 * OrchestratorAgent (LlmAgent)
 * └── subAgents:
 *     ├── Level0Agent (Sequential/Parallel/Worker)
 *     ├── Level1Agent (Sequential/Parallel/Worker)
 *     └── Level2Agent (Sequential/Parallel/Worker)
 * ```
 */
export function createAgentHierarchy(prd: PRD, config: AgentFactoryConfig): BaseAgent {
  // Analyze and group tasks by dependency level
  const levels = analyzeTaskLevels(prd.tasks);

  if (config.verbose) {
    console.error(`[agent-factory] Creating hierarchy with ${levels.length} levels`);
    for (const level of levels) {
      console.error(
        `  Level ${level.levelIndex}: ${level.tasks.length} tasks, parallelizable=${level.isParallelizable}`,
      );
    }
  }

  // Create level agents
  const levelAgents = levels.map((level) => createLevelAgent(level, config));

  // Wrap in orchestrator agent
  return createOrchestratorAgent(prd, levelAgents, config);
}

/**
 * Create a simple sequential hierarchy (no orchestrator intelligence)
 * For backward compatibility or simpler use cases
 */
export function createSimpleHierarchy(prd: PRD, config: AgentFactoryConfig): BaseAgent {
  const levels = analyzeTaskLevels(prd.tasks);
  const levelAgents = levels.map((level) => createLevelAgent(level, config));

  // Just wrap in SequentialAgent without orchestrator
  return new SequentialAgent({
    name: 'prd_executor',
    description: `Executes PRD: ${prd.project}`,
    subAgents: levelAgents,
  });
}
