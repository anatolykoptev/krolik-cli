/**
 * @module commands/agent/orchestrator/formatters
 * @description Output formatters for orchestration results
 *
 * Supports both legacy and smart selection output formats.
 * Smart selection includes score breakdown for transparency.
 */

import { escapeXml } from '../../../lib/@format';
import { buildGenerationPrompt } from '../adhoc';
import { TRUNCATION } from '../constants';
import { formatContextForPrompt } from '../context';
import type { ScoredAgent } from '../selection';
import type { OrchestrationResult } from './types';

/**
 * Format consilium reason as human-readable text
 */
function formatConsiliumReason(reason: string): string {
  switch (reason) {
    case 'no_agents_found':
      return 'No suitable agents found in the database for this task';
    case 'low_confidence':
      return 'Low confidence in existing agents - task may require specialized expertise';
    case 'multi_domain_complex':
      return 'Complex multi-domain task with insufficient agent coverage';
    case 'novel_domain':
      return 'Novel domain not covered by existing agents';
    default:
      return 'Agent generation may improve results';
  }
}

/**
 * Format orchestration result as XML for Claude
 */
export function formatOrchestrationXML(result: OrchestrationResult): string {
  const { analysis, plan, context, consilium, includePrompts, durationMs } = result;

  let xml = `<agent-orchestration>
  <task-analysis>
    <original-task>${escapeXml(analysis.task)}</original-task>
    <detected-type>${analysis.taskType}</detected-type>
    <confidence>${(analysis.confidence * 100).toFixed(0)}%</confidence>
    <categories>${analysis.categories.join(', ')}</categories>
    <keywords>${analysis.keywords.join(', ')}</keywords>
  </task-analysis>

  <execution-plan strategy="${plan.strategy}" total-agents="${plan.totalAgents}">
`;

  for (const phase of plan.phases) {
    xml += `    <phase name="${escapeXml(phase.name)}" parallel="${phase.parallel}">
`;
    for (const rec of phase.agents) {
      xml += `      <agent name="${escapeXml(rec.agent.name)}" priority="${rec.priority}">
        <description>${escapeXml(rec.agent.description)}</description>
        <category>${rec.agent.category}</category>
        <model>${rec.agent.model ?? 'inherit'}</model>
        <reason>${escapeXml(rec.reason)}</reason>
      </agent>
`;
    }
    xml += `    </phase>
`;
  }

  xml += `  </execution-plan>
`;

  // Add agent prompts (without context - context is shared below)
  if (includePrompts && plan.totalAgents > 0) {
    xml += `
  <agent-prompts task="${escapeXml(analysis.task)}">
`;
    for (const phase of plan.phases) {
      for (const rec of phase.agents) {
        // Only agent content, no context duplication
        xml += `    <agent-prompt name="${escapeXml(rec.agent.name)}" model="${rec.agent.model ?? 'sonnet'}">
${escapeXml(rec.agent.content)}
    </agent-prompt>
`;
      }
    }
    xml += `  </agent-prompts>
`;
  }

  // Add Agent Architect prompt when consilium is recommended
  if (consilium?.recommended) {
    // Generate the actual Agent Architect prompt for this task
    const architectPrompt = buildGenerationPrompt({
      task: analysis.task,
      focusAreas: consilium.suggestedFocusAreas,
      maxAgents: 5,
    });

    xml += `
  <agent-architect>
    <reason>${formatConsiliumReason(consilium.reason)}</reason>
    <instructions>
      Execute the prompt below to generate specialized agents.
      Parse the JSON response and run each agent via Task tool (subagent_type="general-purpose").
      Synthesize all results into unified analysis.
    </instructions>
    <generation-prompt>
${escapeXml(architectPrompt)}
    </generation-prompt>
  </agent-architect>
`;
  }

  xml += `
  <instructions>`;

  if (plan.totalAgents > 0 && !consilium?.recommended) {
    // Standard case: agents found
    if (includePrompts) {
      xml += `
    Agent prompts are in <agent-prompts>, shared context is in <project-context> below.
    Execute all agents in parallel using Task tool:
    - subagent_type: "general-purpose"
    - model: use the model attribute from each agent-prompt
    - prompt: combine agent-prompt content + project-context + "Task: {original-task}"
    Synthesize results into unified analysis.`;
    } else {
      xml += `
    Execute agents using krolik_agent name="..." for each agent.
    Or use Task tool with agent prompts.`;
    }
  } else if (consilium?.recommended) {
    // Agent Architect recommended
    xml += `
    RECOMMENDED: Use Agent Architect prompt above to generate specialized agents.
    ${plan.totalAgents > 0 ? `Existing ${plan.totalAgents} agent(s) may supplement the analysis.` : 'No suitable existing agents.'}`;
  }

  xml += `
  </instructions>

  <duration-ms>${durationMs}</duration-ms>
</agent-orchestration>`;

  // Add context if available
  if (context) {
    xml += `\n\n${formatContextForPrompt(context)}`;
  }

  return xml;
}

/**
 * Format orchestration result as text
 */
export function formatOrchestrationText(result: OrchestrationResult): string {
  const { analysis, plan, durationMs } = result;

  let text = `=== Agent Orchestration ===

Task: ${analysis.task}
Type: ${analysis.taskType} (${(analysis.confidence * 100).toFixed(0)}% confidence)
Categories: ${analysis.categories.join(', ')}
Strategy: ${plan.strategy}

Execution Plan (${plan.totalAgents} agents):
`;

  for (const phase of plan.phases) {
    text += `\n${phase.name} ${phase.parallel ? '[PARALLEL]' : '[SEQUENTIAL]'}:\n`;
    for (const rec of phase.agents) {
      text += `  ${rec.priority}. ${rec.agent.name} (${rec.agent.category})\n`;
      text += `     ${rec.agent.description.slice(0, TRUNCATION.DESCRIPTION_SHORT)}...\n`;
    }
  }

  text += `\nAnalysis time: ${durationMs}ms`;

  return text;
}

/**
 * Format orchestration result as JSON
 */
export function formatOrchestrationJSON(result: OrchestrationResult): string {
  return JSON.stringify(
    {
      analysis: {
        task: result.analysis.task,
        taskType: result.analysis.taskType,
        confidence: result.analysis.confidence,
        categories: result.analysis.categories,
        keywords: result.analysis.keywords,
      },
      plan: {
        strategy: result.plan.strategy,
        totalAgents: result.plan.totalAgents,
        phases: result.plan.phases.map((phase) => ({
          name: phase.name,
          parallel: phase.parallel,
          agents: phase.agents.map((rec) => ({
            name: rec.agent.name,
            category: rec.agent.category,
            priority: rec.priority,
            reason: rec.reason,
          })),
        })),
      },
      durationMs: result.durationMs,
    },
    null,
    2,
  );
}

/**
 * Format smart selection reasoning as XML (for --debug-selection flag)
 */
export function formatSmartSelectionXML(
  scoredAgents: ScoredAgent[],
  task: string,
  durationMs: number,
): string {
  let xml = `<smart-agent-selection>
  <task>${escapeXml(task)}</task>
  <selection-time-ms>${durationMs}</selection-time-ms>
  <candidates total="${scoredAgents.length}">
`;

  for (const scored of scoredAgents) {
    const { agent, score, breakdown } = scored;

    xml += `    <agent-recommendation name="${escapeXml(agent.name)}" score="${score}">
      <category>${agent.category}</category>
      <description>${escapeXml(agent.description.slice(0, TRUNCATION.DESCRIPTION_SHORT))}</description>
      <reasoning>
        <keyword-match score="${breakdown.keywordMatch}">${
          breakdown.matchedKeywords.length > 0
            ? `Matched: ${breakdown.matchedKeywords.join(', ')}`
            : 'No keyword matches'
        }</keyword-match>
        <context-boost score="${breakdown.contextBoost}">${
          breakdown.matchedTechStack.length > 0
            ? `Tech stack: ${breakdown.matchedTechStack.join(', ')}`
            : 'No tech stack matches'
        }</context-boost>
        <history-boost score="${breakdown.historyBoost}">${
          breakdown.historyBoost > 0 ? 'Used successfully in similar tasks' : 'No history'
        }</history-boost>
        <freshness-bonus score="${breakdown.freshnessBonus}">${
          breakdown.freshnessBonus > 0 ? 'Recently used' : 'Not recently used'
        }</freshness-bonus>
      </reasoning>
    </agent-recommendation>
`;
  }

  xml += `  </candidates>
</smart-agent-selection>`;

  return xml;
}

/**
 * Format smart selection as text (for CLI output)
 */
export function formatSmartSelectionText(
  scoredAgents: ScoredAgent[],
  task: string,
  durationMs: number,
): string {
  let text = `=== Smart Agent Selection ===

Task: ${task}
Selection time: ${durationMs}ms
Total candidates: ${scoredAgents.length}

Recommended Agents:
`;

  for (const scored of scoredAgents) {
    const { agent, score, breakdown } = scored;

    text += `
${score}pts  ${agent.name} (${agent.category})
       ${agent.description.slice(0, TRUNCATION.DESCRIPTION_SHORT)}...
       Score breakdown:
         - Keywords (${breakdown.keywordMatch}): ${breakdown.matchedKeywords.join(', ') || 'none'}
         - Context  (${breakdown.contextBoost}): ${breakdown.matchedTechStack.join(', ') || 'none'}
         - History  (${breakdown.historyBoost}): ${breakdown.historyBoost > 0 ? 'yes' : 'no'}
         - Fresh    (${breakdown.freshnessBonus}): ${breakdown.freshnessBonus > 0 ? 'yes' : 'no'}
`;
  }

  return text;
}

/**
 * Format smart selection as JSON (for programmatic use)
 */
export function formatSmartSelectionJSON(
  scoredAgents: ScoredAgent[],
  task: string,
  durationMs: number,
): string {
  return JSON.stringify(
    {
      task,
      durationMs,
      candidates: scoredAgents.map((scored) => ({
        name: scored.agent.name,
        category: scored.agent.category,
        description: scored.agent.description,
        score: scored.score,
        breakdown: {
          keywordMatch: scored.breakdown.keywordMatch,
          contextBoost: scored.breakdown.contextBoost,
          historyBoost: scored.breakdown.historyBoost,
          freshnessBonus: scored.breakdown.freshnessBonus,
          matchedKeywords: scored.breakdown.matchedKeywords,
          matchedTechStack: scored.breakdown.matchedTechStack,
        },
      })),
    },
    null,
    2,
  );
}
