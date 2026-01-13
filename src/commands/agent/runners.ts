/**
 * @module commands/agent/runners
 * @description Agent execution runners
 *
 * Handles:
 * - Single agent execution
 * - Orchestration (multi-agent) execution
 */

import { measureTime } from '../../lib/@core/time';
import { escapeXml } from '../../lib/@format';
import { LIMITS } from './constants';
import { buildAgentContext, formatContextForPrompt } from './context';
import { saveAgentExecution } from './memory';
import {
  formatOrchestrationJSON,
  formatOrchestrationText,
  formatOrchestrationXML,
  type OrchestrateOptions,
  orchestrate,
} from './orchestrator';
import { formatResultText } from './output';
import type { AgentDefinition, AgentOptions, AgentResult } from './types';

/**
 * Extended options for orchestration command
 */
export interface OrchestrationCommandOptions extends AgentOptions {
  maxAgents?: number;
  preferParallel?: boolean;
}

/**
 * Run a single agent
 */
export async function runSingleAgent(
  agent: AgentDefinition,
  projectRoot: string,
  options: AgentOptions,
  nested = false,
): Promise<void> {
  const { result: context, durationMs: contextDurationMs } = measureTime(() =>
    buildAgentContext(projectRoot, options),
  );

  const awaitedContext = await context;
  const contextPrompt = formatContextForPrompt(awaitedContext);

  // Build full prompt
  const fullPrompt = `${agent.content}

${contextPrompt}

Please analyze the project and provide your findings.`;

  // Create result
  const result: AgentResult = {
    agent: agent.name,
    category: agent.category,
    success: true,
    output: '', // Will be filled by Claude
    durationMs: contextDurationMs,
  };

  const format = options.format ?? 'ai';
  const indent = nested ? '  ' : '';

  // Output agent prompt for Claude to execute
  if (format === 'text') {
    console.log(`${indent}${formatResultText(result)}`);
    console.log(`${indent}--- Agent Prompt ---`);
    console.log(fullPrompt);
  } else {
    console.log(`${indent}<agent-execution name="${agent.name}" category="${agent.category}">`);
    console.log(`${indent}  <description>${escapeXml(agent.description)}</description>`);
    if (agent.model) {
      console.log(`${indent}  <model>${agent.model}</model>`);
    }
    console.log(`${indent}  <prompt>`);
    console.log(escapeXml(fullPrompt));
    console.log(`${indent}  </prompt>`);
    console.log(`${indent}  <context-duration-ms>${contextDurationMs}</context-duration-ms>`);
    console.log(`${indent}</agent-execution>`);
  }

  // Save execution to memory for future context
  saveAgentExecution(projectRoot, agent.name, agent.category, options.feature);
}

/**
 * Run orchestration mode - analyze task and coordinate multiple agents
 */
export async function runOrchestration(
  projectRoot: string,
  task: string,
  options: OrchestrationCommandOptions,
): Promise<void> {
  const orchestrateOptions: OrchestrateOptions = {
    maxAgents: options.maxAgents,
    preferParallel: options.preferParallel,
    // Context not needed for orchestration plan - agents will load their own context
    includeContext: false,
    file: options.file,
    feature: options.feature,
    dryRun: options.dryRun,
    format: options.format === 'text' ? 'text' : options.format === 'json' ? 'json' : 'xml',
  };

  try {
    const result = await orchestrate(task, projectRoot, orchestrateOptions);

    // Output based on format
    const format = options.format ?? 'ai';

    if (format === 'text') {
      console.log(formatOrchestrationText(result));
    } else if (format === 'json') {
      console.log(formatOrchestrationJSON(result));
    } else {
      // Default: AI-friendly XML
      console.log(formatOrchestrationXML(result));
    }

    // Save orchestration to memory
    const agentNames = result.plan.phases
      .flatMap((p) => p.agents.map((a) => a.agent.name))
      .slice(0, LIMITS.ORCHESTRATION_AGENTS_SAVE);
    saveAgentExecution(
      projectRoot,
      `orchestrator:${result.analysis.taskType}`,
      'orchestration',
      options.feature,
      `${task} → agents: ${agentNames.join(', ')}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Orchestration failed: ${message}`);
    process.exit(1);
  }
}
