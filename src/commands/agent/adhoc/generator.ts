/**
 * @module commands/agent/adhoc/generator
 * @description Generates ad-hoc agents dynamically using Agent Architect
 *
 * This module calls the LLM with Agent Architect prompt to design
 * specialized agents for tasks that don't match existing plugins.
 */

import { randomUUID } from 'node:crypto';
import type {
  AdHocAgent,
  AdHocAgentArchetype,
  AdHocGenerationRequest,
  AdHocGenerationResponse,
} from './types';

/**
 * Prompt template for generating multiple ad-hoc agents
 */
const CONSILIUM_GENERATION_PROMPT = `You are the Agent Architect designing a consilium (council) of specialized AI agents to analyze a task.

## Task to Analyze
<task>
{{TASK}}
</task>

{{CONTEXT}}

## Your Job
Design 2-5 specialized agents that together can thoroughly analyze this task.
Each agent should have a unique perspective and expertise.

## Output Format
Return a JSON object with this exact structure:

\`\`\`json
{
  "agents": [
    {
      "name": "kebab-case-name",
      "description": "One-line description for selection",
      "focus": "Primary area of analysis",
      "expertise": ["domain1", "domain2"],
      "archetype": "specialist|assistant|creator|analyzer|orchestrator",
      "prompt": "Full system prompt for this agent. Be specific and detailed. Include:\\n- Expert role and persona\\n- Key analysis areas\\n- What to look for\\n- Output format expectations\\n- Critical constraints",
      "priority": 1,
      "parallel": true
    }
  ],
  "execution_strategy": "parallel|sequential|mixed",
  "synthesis_prompt": "Prompt for combining all agent outputs into unified analysis",
  "reasoning": "Brief explanation of why these agents were chosen"
}
\`\`\`

## Design Guidelines

1. **Diverse Perspectives**: Each agent should analyze from a different angle
2. **Clear Focus**: One agent = one area of expertise
3. **Actionable Output**: Agents should produce concrete recommendations
4. **No Overlap**: Minimize duplicate analysis between agents
5. **Synthesis-Ready**: Outputs should be easy to combine

## Agent Archetypes

| Archetype | Use When |
|-----------|----------|
| **specialist** | Deep domain knowledge needed (legal, medical, finance) |
| **assistant** | Broad supportive analysis, coordination |
| **creator** | Need to generate artifacts, plans, documents |
| **analyzer** | Data/code analysis, pattern recognition |
| **orchestrator** | Complex workflow coordination |

## Example Agents for Business Analysis

- **market-analyst**: Market research, competitive landscape
- **technical-architect**: Technical feasibility, architecture options
- **financial-strategist**: Unit economics, pricing, revenue models
- **ux-researcher**: User needs, pain points, adoption barriers
- **risk-assessor**: Legal, regulatory, operational risks

Return ONLY the JSON object, no markdown fences or extra text.`;

/**
 * Parse LLM response into structured AdHocGenerationResponse
 */
function parseGenerationResponse(llmResponse: string, durationMs: number): AdHocGenerationResponse {
  // Try to extract JSON from response
  let jsonStr = llmResponse.trim();

  // Remove markdown code fences if present
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch?.[1]) {
    jsonStr = jsonMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(jsonStr);

    // Validate and transform agents
    const agents: AdHocAgent[] = parsed.agents.map(
      (
        a: {
          name: string;
          description: string;
          prompt: string;
          focus: string;
          expertise?: string[];
          archetype?: string;
          priority?: number;
          parallel?: boolean;
          model?: string;
        },
        index: number,
      ) => ({
        id: randomUUID(),
        name: a.name,
        prompt: a.prompt,
        description: a.description,
        focus: a.focus,
        expertise: a.expertise || [],
        archetype: validateArchetype(a.archetype),
        priority: a.priority || index + 1,
        parallel: a.parallel !== false,
        model: a.model as AdHocAgent['model'],
      }),
    );

    return {
      agents,
      executionStrategy: parsed.execution_strategy || 'parallel',
      synthesisPrompt: parsed.synthesis_prompt || 'Synthesize insights from all agents.',
      reasoning: parsed.reasoning || 'Agents selected based on task requirements.',
      durationMs,
    };
  } catch {
    throw new Error(`Failed to parse Agent Architect response: ${llmResponse.slice(0, 200)}...`);
  }
}

/**
 * Validate archetype value
 */
function validateArchetype(value?: string): AdHocAgentArchetype {
  const valid: AdHocAgentArchetype[] = [
    'specialist',
    'assistant',
    'creator',
    'analyzer',
    'orchestrator',
  ];
  if (value && valid.includes(value as AdHocAgentArchetype)) {
    return value as AdHocAgentArchetype;
  }
  return 'analyzer'; // Default
}

/**
 * Build the generation prompt from request
 */
export function buildGenerationPrompt(request: AdHocGenerationRequest): string {
  let prompt = CONSILIUM_GENERATION_PROMPT.replace('{{TASK}}', request.task);

  // Add context if provided
  if (request.context) {
    prompt = prompt.replace(
      '{{CONTEXT}}',
      `\n## Additional Context\n<context>\n${request.context}\n</context>\n`,
    );
  } else {
    prompt = prompt.replace('{{CONTEXT}}', '');
  }

  // Add focus areas if specified
  if (request.focusAreas && request.focusAreas.length > 0) {
    prompt += `\n\n## Focus Areas (prioritize these)\n${request.focusAreas.map((f) => `- ${f}`).join('\n')}`;
  }

  // Add max agents constraint
  if (request.maxAgents) {
    prompt += `\n\n## Constraint: Generate maximum ${request.maxAgents} agents.`;
  }

  return prompt;
}

/**
 * Generate ad-hoc agents using Agent Architect
 *
 * This function builds the prompt and returns it for the LLM to process.
 * The actual LLM call is handled by the caller (CLI or MCP).
 */
export function prepareAdHocGeneration(request: AdHocGenerationRequest): {
  prompt: string;
  parseResponse: (response: string, durationMs: number) => AdHocGenerationResponse;
} {
  const prompt = buildGenerationPrompt(request);

  return {
    prompt,
    parseResponse: parseGenerationResponse,
  };
}

/**
 * Format ad-hoc agent as XML for execution
 */
export function formatAdHocAgentXML(agent: AdHocAgent, task: string): string {
  const expertise = agent.expertise.length > 0 ? agent.expertise.join(', ') : 'general';

  return `<adhoc-agent-execution id="${agent.id}" name="${agent.name}" archetype="${agent.archetype}">
  <description>${escapeXml(agent.description)}</description>
  <focus>${escapeXml(agent.focus)}</focus>
  <expertise>${escapeXml(expertise)}</expertise>
  <task>${escapeXml(task)}</task>
  <prompt>
${escapeXml(agent.prompt)}
  </prompt>
</adhoc-agent-execution>`;
}

/**
 * Format consilium plan as XML
 */
export function formatConsiliumPlanXML(response: AdHocGenerationResponse, task: string): string {
  const agentsXml = response.agents
    .map(
      (
        a,
      ) => `    <agent name="${a.name}" archetype="${a.archetype}" priority="${a.priority}" parallel="${a.parallel}">
      <description>${escapeXml(a.description)}</description>
      <focus>${escapeXml(a.focus)}</focus>
    </agent>`,
    )
    .join('\n');

  return `<consilium-plan strategy="${response.executionStrategy}" agent-count="${response.agents.length}">
  <task>${escapeXml(task)}</task>
  <reasoning>${escapeXml(response.reasoning)}</reasoning>
  <agents>
${agentsXml}
  </agents>
  <synthesis-prompt>${escapeXml(response.synthesisPrompt)}</synthesis-prompt>
  <generation-time-ms>${response.durationMs}</generation-time-ms>
</consilium-plan>`;
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
