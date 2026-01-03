/**
 * @module commands/agent/output
 * @description Output formatters for agent command
 *
 * Provides formatters for different output formats:
 * - Text: Human-readable console output
 * - AI: XML output optimized for AI agents
 */

import type { AgentCategory, AgentDefinition } from '../types';

// ============================================================================
// EXPORTS
// ============================================================================

// List formatters
export { formatAgentListAI, formatAgentListText } from './list';

// Result formatters
export { formatResultAI, formatResultText } from './result';

// ============================================================================
// SHARED HELPERS
// ============================================================================

/**
 * Group agents by category
 */
export function groupAgentsByCategory(
  agents: AgentDefinition[],
): Map<AgentCategory, AgentDefinition[]> {
  const byCategory = new Map<AgentCategory, AgentDefinition[]>();
  for (const agent of agents) {
    const list = byCategory.get(agent.category) || [];
    list.push(agent);
    byCategory.set(agent.category, list);
  }
  return byCategory;
}
