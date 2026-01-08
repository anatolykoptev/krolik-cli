/**
 * @module commands/agent/selection/history
 * @description Query memory for past successful agent executions
 */

import * as path from 'node:path';
import { search } from '@/lib/@storage/memory';

/**
 * Agent success history for scoring
 */
export interface AgentSuccessHistory {
  /** Agent name */
  agentName: string;
  /** Total execution count */
  executionCount: number;
  /** Executions in last 30 days */
  recentUses: number;
  /** Features this agent was used for */
  features: string[];
  /** Success score (0-100) based on frequency + recency */
  successScore: number;
}

/**
 * Time constants
 */
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Get agent success history from memory
 *
 * @param projectRoot - Project root path
 * @param feature - Optional feature to filter by
 * @returns Map of agent name to success history
 */
export function getAgentSuccessHistory(
  projectRoot: string,
  feature?: string,
): Map<string, AgentSuccessHistory> {
  const projectName = path.basename(projectRoot);
  const historyMap = new Map<string, AgentSuccessHistory>();

  try {
    // Search memory for agent-related entries
    const memories = search({
      project: projectName,
      tags: ['agent'],
      limit: 1000,
    });

    const thirtyDaysAgo = Date.now() - THIRTY_DAYS_MS;

    for (const { memory } of memories) {
      // Find agent name from tags (tag that isn't 'agent')
      const agentTag = memory.tags.find((t) => t !== 'agent' && !t.startsWith('category:'));

      if (!agentTag) continue;

      const existing = historyMap.get(agentTag) ?? {
        agentName: agentTag,
        executionCount: 0,
        recentUses: 0,
        features: [],
        successScore: 0,
      };

      existing.executionCount++;

      // Check if recent
      const createdAt = new Date(memory.createdAt).getTime();
      if (createdAt > thirtyDaysAgo) {
        existing.recentUses++;
      }

      // Track features
      if (memory.features) {
        for (const f of memory.features) {
          if (!existing.features.includes(f)) {
            existing.features.push(f);
          }
        }
      }

      historyMap.set(agentTag, existing);
    }

    // Calculate success scores
    for (const [_name, hist] of historyMap) {
      // Score = recency (60%) + frequency (40%)
      // Recency: 10 uses in 30 days = max score
      const recencyScore = Math.min(hist.recentUses / 10, 1) * 60;
      // Frequency: 20 total uses = max score
      const frequencyScore = Math.min(hist.executionCount / 20, 1) * 40;
      hist.successScore = Math.round(recencyScore + frequencyScore);
    }

    // If feature specified, boost agents that match
    if (feature) {
      for (const [_name, hist] of historyMap) {
        if (hist.features.some((f) => f.toLowerCase().includes(feature.toLowerCase()))) {
          // Boost score by 10% for feature match
          hist.successScore = Math.min(hist.successScore * 1.1, 100);
        }
      }
    }

    return historyMap;
  } catch {
    // Memory might not be initialized, return empty map
    return new Map();
  }
}

/**
 * Record agent execution in memory (for future history tracking)
 *
 * This should be called after successful agent execution
 * to build up history for future recommendations.
 */
export function recordAgentExecution(
  _projectRoot: string,
  _agentName: string,
  _feature?: string,
  _success = true,
): void {
  // Implementation note: This would save to memory
  // but we don't want to add this dependency here.
  // The orchestrator should handle this after execution.
  // This is a placeholder for the interface.
}

/**
 * Get top agents by success score
 */
export function getTopAgentsBySuccess(projectRoot: string, limit = 10): AgentSuccessHistory[] {
  const history = getAgentSuccessHistory(projectRoot);

  return Array.from(history.values())
    .sort((a, b) => b.successScore - a.successScore)
    .slice(0, limit);
}

/**
 * Get agents used for a specific feature
 */
export function getAgentsForFeature(projectRoot: string, feature: string): AgentSuccessHistory[] {
  const history = getAgentSuccessHistory(projectRoot);
  const normalizedFeature = feature.toLowerCase();

  return Array.from(history.values()).filter((h) =>
    h.features.some((f) => f.toLowerCase().includes(normalizedFeature)),
  );
}
