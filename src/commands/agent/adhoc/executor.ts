/**
 * @module commands/agent/adhoc/executor
 * @description Executes ad-hoc agents and collects results
 *
 * Handles:
 * - Single ad-hoc agent execution
 * - Consilium (multi-agent) execution
 * - Result synthesis
 * - Quality scoring for persistence decisions
 */

import type { AgentContext } from '../types';
import type {
  AdHocAgent,
  AdHocAgentResult,
  AdHocConsiliumResult,
  AdHocGenerationResponse,
} from './types';

/**
 * Options for executing ad-hoc agents
 */
export interface AdHocExecutionOptions {
  /** Task being analyzed */
  task: string;
  /** Agent context (project info, git, etc.) */
  context?: AgentContext;
  /** Format output for specific use */
  format?: 'xml' | 'text' | 'json';
  /** Include full prompts in output */
  verbose?: boolean;
  /** Dry run - only show plan */
  dryRun?: boolean;
}

/**
 * Format a single ad-hoc agent for execution by Claude
 */
export function formatSingleAdHocExecution(
  agent: AdHocAgent,
  options: AdHocExecutionOptions,
): string {
  const contextXml = options.context ? formatContextXml(options.context) : '';

  return `<adhoc-agent-task>
  <agent id="${agent.id}" name="${agent.name}" archetype="${agent.archetype}">
    <description>${escapeXml(agent.description)}</description>
    <focus>${escapeXml(agent.focus)}</focus>
    <expertise>${escapeXml(agent.expertise.join(', '))}</expertise>
  </agent>
  <task>${escapeXml(options.task)}</task>
  ${contextXml}
  <instructions>
    Execute the following agent prompt and return your analysis.
    Be thorough and actionable. Structure your response clearly.
  </instructions>
  <prompt>
${escapeXml(agent.prompt)}
  </prompt>
</adhoc-agent-task>`;
}

/**
 * Format consilium (multi-agent) execution plan for Claude
 *
 * This outputs a structured plan that Claude should follow:
 * 1. Execute each agent (respecting parallel/sequential)
 * 2. Collect results
 * 3. Synthesize final output
 */
export function formatConsiliumExecution(
  response: AdHocGenerationResponse,
  options: AdHocExecutionOptions,
): string {
  const { agents, executionStrategy, synthesisPrompt, reasoning } = response;
  const contextXml = options.context ? formatContextXml(options.context) : '';

  // Group agents by execution order
  const parallelAgents = agents.filter((a) => a.parallel);
  const sequentialAgents = agents.filter((a) => !a.parallel);

  let agentPrompts = '';

  // Format parallel phase
  if (parallelAgents.length > 0) {
    agentPrompts += `  <phase name="parallel-analysis" parallel="true">
    <description>These agents analyze independently - execute all in parallel</description>
`;
    for (const agent of parallelAgents) {
      agentPrompts += formatAgentBlock(agent, options.verbose);
    }
    agentPrompts += '  </phase>\n';
  }

  // Format sequential phase
  if (sequentialAgents.length > 0) {
    agentPrompts += `  <phase name="sequential-analysis" parallel="false">
    <description>These agents build on previous results - execute in order</description>
`;
    for (const agent of sequentialAgents) {
      agentPrompts += formatAgentBlock(agent, options.verbose);
    }
    agentPrompts += '  </phase>\n';
  }

  return `<consilium strategy="${executionStrategy}" total-agents="${agents.length}">
  <task>${escapeXml(options.task)}</task>
  <reasoning>${escapeXml(reasoning)}</reasoning>
  ${contextXml}
  <execution-plan>
${agentPrompts}  </execution-plan>
  <synthesis>
    <instructions>
      After all agents complete, synthesize their findings:
      - Identify key themes across all analyses
      - Note agreements and disagreements
      - Prioritize recommendations
      - Produce unified action plan
    </instructions>
    <prompt>${escapeXml(synthesisPrompt)}</prompt>
  </synthesis>
  <output-format>
    For each agent, produce:
    &lt;agent-result name="agent-name"&gt;
      &lt;findings&gt;Key observations&lt;/findings&gt;
      &lt;recommendations&gt;Actionable suggestions&lt;/recommendations&gt;
      &lt;quality-score&gt;0-100 self-assessment&lt;/quality-score&gt;
    &lt;/agent-result&gt;

    Then produce final synthesis:
    &lt;synthesis-result&gt;
      &lt;summary&gt;Unified conclusions&lt;/summary&gt;
      &lt;action-plan&gt;Prioritized recommendations&lt;/action-plan&gt;
      &lt;high-performers&gt;Agents worth saving (score >= 80)&lt;/high-performers&gt;
    &lt;/synthesis-result&gt;
  </output-format>
</consilium>`;
}

/**
 * Format agent block for consilium
 */
function formatAgentBlock(agent: AdHocAgent, verbose = false): string {
  const promptSection = verbose
    ? `      <prompt>${escapeXml(agent.prompt)}</prompt>\n`
    : `      <prompt-length>${agent.prompt.length} chars</prompt-length>\n`;

  return `    <agent id="${agent.id}" name="${agent.name}" priority="${agent.priority}">
      <archetype>${agent.archetype}</archetype>
      <description>${escapeXml(agent.description)}</description>
      <focus>${escapeXml(agent.focus)}</focus>
${promptSection}    </agent>
`;
}

/**
 * Format context for XML output
 */
function formatContextXml(context: AgentContext): string {
  const sections: string[] = [];

  if (context.targetFile && context.targetContent) {
    sections.push(
      `<target-file path="${escapeXml(context.targetFile)}">${escapeXml(context.targetContent.slice(0, 2000))}</target-file>`,
    );
  }

  if (context.schema) {
    sections.push(`<schema>${escapeXml(context.schema.slice(0, 1500))}</schema>`);
  }

  if (context.routes) {
    sections.push(`<routes>${escapeXml(context.routes.slice(0, 1000))}</routes>`);
  }

  if (context.gitStatus) {
    sections.push(`<git-status>${escapeXml(context.gitStatus)}</git-status>`);
  }

  if (context.feature) {
    sections.push(`<feature>${escapeXml(context.feature)}</feature>`);
  }

  if (sections.length === 0) {
    return '';
  }

  return `<context>\n    ${sections.join('\n    ')}\n  </context>`;
}

/**
 * Format consilium as text (human-readable)
 */
export function formatConsiliumText(
  response: AdHocGenerationResponse,
  options: AdHocExecutionOptions,
): string {
  const lines: string[] = [
    '═══════════════════════════════════════════════════════════════',
    '                     CONSILIUM (Agent Council)',
    '═══════════════════════════════════════════════════════════════',
    '',
    `Task: ${options.task}`,
    `Strategy: ${response.executionStrategy}`,
    `Agents: ${response.agents.length}`,
    '',
    'Reasoning:',
    `  ${response.reasoning}`,
    '',
    '───────────────────────────────────────────────────────────────',
    '                         AGENTS',
    '───────────────────────────────────────────────────────────────',
  ];

  for (const agent of response.agents) {
    lines.push('');
    lines.push(`[${agent.priority}] ${agent.name} (${agent.archetype})`);
    lines.push(`    Focus: ${agent.focus}`);
    lines.push(`    Parallel: ${agent.parallel}`);
    if (agent.expertise.length > 0) {
      lines.push(`    Expertise: ${agent.expertise.join(', ')}`);
    }
  }

  lines.push('');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push('                       SYNTHESIS');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push('');
  lines.push(response.synthesisPrompt);
  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════');

  return lines.join('\n');
}

/**
 * Format consilium as JSON
 */
export function formatConsiliumJSON(
  response: AdHocGenerationResponse,
  options: AdHocExecutionOptions,
): string {
  return JSON.stringify(
    {
      type: 'consilium',
      task: options.task,
      strategy: response.executionStrategy,
      reasoning: response.reasoning,
      agents: response.agents.map((a) => ({
        id: a.id,
        name: a.name,
        archetype: a.archetype,
        focus: a.focus,
        expertise: a.expertise,
        priority: a.priority,
        parallel: a.parallel,
        promptLength: a.prompt.length,
      })),
      synthesisPrompt: response.synthesisPrompt,
      generationDurationMs: response.durationMs,
    },
    null,
    2,
  );
}

/**
 * Create mock result for dry run
 */
export function createDryRunResult(
  response: AdHocGenerationResponse,
  task: string,
): AdHocConsiliumResult {
  const agentResults: AdHocAgentResult[] = response.agents.map((agent) => ({
    agent: agent.name,
    category: 'other',
    success: true,
    output: `[DRY RUN] Would execute agent: ${agent.name}\nFocus: ${agent.focus}`,
    durationMs: 0,
    adHocAgent: agent,
    recommendSave: false,
  }));

  return {
    task,
    agentResults,
    synthesis: '[DRY RUN] Would synthesize results from all agents',
    highPerformers: [],
    totalDurationMs: response.durationMs,
    strategy: response.executionStrategy,
  };
}

/**
 * Helper to escape XML special characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
