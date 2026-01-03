/**
 * @module commands/agent/memory
 * @description Memory utilities for agent command
 *
 * Handles:
 * - Git context retrieval for memory storage
 * - Agent execution persistence to memory
 */

import * as path from 'node:path';
import { logger } from '../../lib/@core/logger/logger';
import {
  type MemoryContext,
  type MemorySaveOptions,
  save as saveMemory,
} from '../../lib/@storage/memory';
import { getCurrentBranch, getRecentCommits, isGitRepo } from '../../lib/@vcs';
import { TRUNCATION } from './constants';

/**
 * Git context for memory storage
 */
export interface GitContext {
  branch?: string | undefined;
  commit?: string | undefined;
}

/**
 * Get git context for memory storage
 */
export function getGitContext(projectRoot: string): GitContext {
  if (!isGitRepo(projectRoot)) {
    return {};
  }

  const branch = getCurrentBranch(projectRoot) ?? undefined;
  const commits = getRecentCommits(1, projectRoot);
  const commit = commits[0]?.hash;

  return { branch, commit };
}

/**
 * Save agent execution to memory for future context
 *
 * Stores:
 * - Agent name and category
 * - Task/feature context
 * - Execution timestamp
 *
 * This enables learning from past agent recommendations
 */
export function saveAgentExecution(
  projectRoot: string,
  agentName: string,
  category: string,
  feature?: string,
  task?: string,
): void {
  try {
    const projectName = path.basename(projectRoot);
    const gitContext = getGitContext(projectRoot);

    const title = task
      ? `Agent ${agentName}: ${task.slice(0, TRUNCATION.TASK_TITLE)}${task.length > TRUNCATION.TASK_TITLE ? '...' : ''}`
      : `Agent ${agentName} executed`;

    const description = [
      `Category: ${category}`,
      feature ? `Feature: ${feature}` : null,
      task ? `Task: ${task}` : null,
      `Executed at: ${new Date().toISOString()}`,
    ]
      .filter(Boolean)
      .join('\n');

    const saveOptions: MemorySaveOptions = {
      type: 'decision',
      title,
      description,
      importance: 'medium',
      tags: ['agent', agentName, category],
      features: feature ? [feature] : undefined,
    };

    const context: MemoryContext = {
      project: projectName,
      branch: gitContext.branch,
      commit: gitContext.commit,
    };

    saveMemory(saveOptions, context);
    logger.debug(`[agent] Saved execution to memory: ${agentName}`);
  } catch (error) {
    // Don't fail agent execution if memory save fails
    logger.debug(
      `[agent] Failed to save execution to memory: ${error instanceof Error ? error.message : 'unknown'}`,
    );
  }
}
