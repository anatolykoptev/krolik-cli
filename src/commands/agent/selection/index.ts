/**
 * @module commands/agent/selection
 * @description Smart agent selection with three-stage pipeline
 *
 * Pipeline:
 * 1. Load capabilities (cached)
 * 2. Detect project profile (cached 5s)
 * 3. Load success history from memory
 * 4. Score all agents
 * 5. Filter and limit results
 */

import { detectProjectProfile, type ProjectProfile } from '@/lib/@context/project-profile';
import { type AgentCapabilities, loadCapabilitiesIndex } from '../capabilities';
import { getTaskEmbedding } from './embeddings';
import { getAgentSuccessHistory } from './history';
import { filterByMinScore, getTopAgents, type ScoredAgent, scoreAgents } from './scoring';

export { getEmbeddingCacheStats, isSemanticMatchingAvailable } from './embeddings';
// Re-export types for consumers
export type { AgentSuccessHistory } from './history';
export type { ScoreBreakdown, ScoredAgent } from './scoring';

/**
 * Selection options
 */
export interface SelectionOptions {
  /** Current feature for history boosting */
  currentFeature?: string | undefined;
  /** Maximum agents to return (default: 5) */
  maxAgents?: number | undefined;
  /** Minimum score threshold (default: 20) */
  minScore?: number | undefined;
  /** Include debug breakdown in results */
  includeBreakdown?: boolean | undefined;
}

/**
 * Selection result with metadata
 */
export interface SelectionResult {
  /** Selected agents with scores */
  agents: ScoredAgent[];
  /** Project profile used for selection */
  profile: ProjectProfile;
  /** Total candidates considered */
  totalCandidates: number;
  /** Selection duration in ms */
  durationMs: number;
  /** Whether semantic matching was used */
  usedSemanticMatching: boolean;
}

/**
 * Select agents for a task using smart scoring
 *
 * Three-stage pipeline:
 * 1. Keyword pre-filtering (0ms, in-memory)
 * 2. Context boosting (10ms, project detection)
 * 3. History boosting (30ms, memory FTS5)
 *
 * @param task - Task description
 * @param projectRoot - Project root path
 * @param agentsPath - Path to agents repository
 * @param options - Selection options
 * @returns Selection result with scored agents
 */
export async function selectAgents(
  task: string,
  projectRoot: string,
  agentsPath: string,
  options: SelectionOptions = {},
): Promise<SelectionResult> {
  const startTime = Date.now();
  const { currentFeature, maxAgents = 5, minScore = 20 } = options;

  // Stage 1: Load agent capabilities (cached)
  const capabilities = await loadCapabilitiesIndex(agentsPath);

  // Stage 2: Detect project profile (cached 5s)
  const profile = detectProjectProfile(projectRoot);

  // Stage 3: Load success history from memory
  const history = getAgentSuccessHistory(projectRoot, currentFeature);

  // Stage 4: Get task embedding for semantic matching (if available)
  const taskEmbedding = await getTaskEmbedding(task);
  const usedSemanticMatching = taskEmbedding !== null;

  // Stage 5: Score all agents (now async with semantic matching)
  const scored = await scoreAgents(
    task,
    capabilities,
    profile,
    history,
    currentFeature,
    taskEmbedding,
  );

  // Stage 6: Filter, deduplicate by name, and limit
  const filtered = filterByMinScore(scored, minScore);
  const deduplicated = deduplicateByName(filtered);
  const selected = getTopAgents(deduplicated, maxAgents);

  return {
    agents: selected,
    profile,
    totalCandidates: capabilities.length,
    durationMs: Date.now() - startTime,
    usedSemanticMatching,
  };
}

/**
 * Deduplicate agents by name (keep highest scored)
 */
function deduplicateByName(scored: ScoredAgent[]): ScoredAgent[] {
  const seen = new Map<string, ScoredAgent>();

  for (const agent of scored) {
    const existing = seen.get(agent.agent.name);
    if (!existing || agent.score > existing.score) {
      seen.set(agent.agent.name, agent);
    }
  }

  // Return in original score order
  return Array.from(seen.values()).sort((a, b) => b.score - a.score);
}

/**
 * Quick agent selection without full pipeline (for CLI listing)
 */
export async function quickSelect(
  task: string,
  agentsPath: string,
  limit = 10,
): Promise<AgentCapabilities[]> {
  const capabilities = await loadCapabilitiesIndex(agentsPath);
  const normalizedTask = task.toLowerCase();

  // Simple keyword-only scoring
  const scored = capabilities.map((agent) => {
    let score = 0;

    // Check keywords
    for (const kw of agent.keywords) {
      if (normalizedTask.includes(kw.toLowerCase())) {
        score += 10;
      }
    }

    // Check description
    const descWords = agent.description.toLowerCase().split(/\s+/);
    for (const word of descWords) {
      if (word.length > 3 && normalizedTask.includes(word)) {
        score += 2;
      }
    }

    return { agent, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.agent);
}

/**
 * Get selection stats for debugging
 */
export async function getSelectionStats(
  projectRoot: string,
  agentsPath: string,
): Promise<{
  totalAgents: number;
  projectProfile: ProjectProfile;
  historyEntries: number;
  topHistoryAgents: string[];
}> {
  const capabilities = await loadCapabilitiesIndex(agentsPath);
  const profile = detectProjectProfile(projectRoot);
  const history = getAgentSuccessHistory(projectRoot);

  const topHistoryAgents = Array.from(history.values())
    .sort((a, b) => b.successScore - a.successScore)
    .slice(0, 5)
    .map((h) => h.agentName);

  return {
    totalAgents: capabilities.length,
    projectProfile: profile,
    historyEntries: history.size,
    topHistoryAgents,
  };
}
