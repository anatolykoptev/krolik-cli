/**
 * @module commands/agent/orchestrator/formatters
 * @description Output formatters for orchestration results
 */

import { escapeXml } from '../../../lib/@format';
import { TRUNCATION } from '../constants';
import { formatContextForPrompt } from '../context';
import type { OrchestrationResult } from './types';

/**
 * Format orchestration result as XML for Claude
 */
export function formatOrchestrationXML(result: OrchestrationResult): string {
  const { analysis, plan, context, durationMs } = result;

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

  <instructions>
    Execute agents according to the plan above:
    1. For parallel phases, use Task tool with multiple agents simultaneously
    2. For sequential phases, run agents one by one
    3. Aggregate results and present unified findings
    4. Prioritize critical issues across all agent outputs
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
