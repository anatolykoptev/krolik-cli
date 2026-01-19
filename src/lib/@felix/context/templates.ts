/**
 * @module lib/@felix/context/templates
 * @description Prompt templates for Krolik Felix
 *
 * System and user prompt templates that force krolik tool usage
 * and provide structure for AI execution.
 */

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Base system prompt for Krolik Felix
 *
 * This prompt:
 * 1. Explains the context is pre-injected
 * 2. Lists krolik tools for additional context
 * 3. Sets constraints and expectations
 */
export const FELIX_SYSTEM_PROMPT = `You are executing a task from a PRD (Product Requirements Document) as part of Krolik Felix - an automated task execution system.

## IMPORTANT: Context is Pre-Injected

The context below has been automatically collected for you. DO NOT search for it manually.
This includes:
- Database schema (Prisma models)
- API routes (tRPC procedures)
- Relevant memories from previous sessions

## Additional Context Tools

If you need MORE context during execution, use these krolik tools:
- \`krolik_context\` - Full project architecture and structure
- \`krolik_schema\` - Detailed database schema
- \`krolik_routes\` - Detailed API routes
- \`krolik_mem_search\` - Search past decisions and bugfixes
- \`krolik_modules\` - Check existing utilities before creating new ones
- \`krolik_audit\` - Run code quality checks

## Constraints

DO NOT:
- Search for code manually (grep, find, etc.) - use krolik tools instead
- Create utilities without checking \`krolik_modules\` first
- Ignore the pre-injected context above
- Make changes outside the scope of the current task

DO:
- Use the provided context to understand the codebase
- Follow existing patterns and conventions
- Add appropriate tests for your changes
- Complete all acceptance criteria

## Task Execution

Your goal is to complete the task and pass ALL acceptance criteria.
After completing the task, the system will run verification tests.
If tests fail, you may be asked to fix issues and try again.`;

/**
 * System prompt for retry attempts
 */
export const RALPH_RETRY_SYSTEM_PROMPT = `You are retrying a task that previously failed.

## Previous Attempt Information

The previous attempt failed for the following reason:
{FAILURE_REASON}

## Guardrails

Based on previous failures, avoid these patterns:
{GUARDRAILS}

## Important

- Carefully analyze WHY the previous attempt failed
- Address the root cause, not just the symptoms
- Do not repeat the same mistakes
- The context has been refreshed with the latest state

${FELIX_SYSTEM_PROMPT}`;

// ============================================================================
// USER PROMPT TEMPLATES
// ============================================================================

/**
 * Template for task execution prompt
 */
export const TASK_PROMPT_TEMPLATE = `# Task: {TASK_TITLE}

## Description
{TASK_DESCRIPTION}

## Type
{TASK_TYPE}

## Priority
{TASK_PRIORITY}

## Complexity
{TASK_COMPLEXITY}

## Acceptance Criteria

{ACCEPTANCE_CRITERIA}

## Context Files
{CONTEXT_FILES}

## Hints
{HINTS}

---

## Pre-Injected Context

{INJECTED_CONTEXT}

---

Please complete this task. Make sure all acceptance criteria are met.
After you're done, the system will verify your changes automatically.`;

/**
 * Template for retry prompt
 */
export const RETRY_PROMPT_TEMPLATE = `# Retry: {TASK_TITLE}

## Attempt {ATTEMPT_NUMBER} of {MAX_ATTEMPTS}

## Previous Failure

{FAILURE_REASON}

{FAILURE_OUTPUT}

## What to Fix

{WHAT_TO_FIX}

---

${TASK_PROMPT_TEMPLATE}`;

// ============================================================================
// TEMPLATE HELPERS
// ============================================================================

/**
 * Replace template placeholders with values
 */
export function fillTemplate(template: string, values: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(values)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return result;
}

/**
 * Format acceptance criteria for prompt
 */
export function formatAcceptanceCriteria(
  criteria: Array<{ id: string; description: string; testCommand?: string }>,
): string {
  return criteria
    .map((c, i) => {
      const test = c.testCommand ? ` (test: \`${c.testCommand}\`)` : '';
      return `${i + 1}. ${c.description}${test}`;
    })
    .join('\n');
}

/**
 * Format context files for prompt
 */
export function formatContextFiles(files?: string[]): string {
  if (!files || files.length === 0) {
    return '_No specific files provided_';
  }
  return files.map((f) => `- \`${f}\``).join('\n');
}

/**
 * Format hints for prompt
 */
export function formatHints(hints?: string[]): string {
  if (!hints || hints.length === 0) {
    return '_No specific hints_';
  }
  return hints.map((h) => `- ${h}`).join('\n');
}

/**
 * Format guardrails for prompt
 */
export function formatGuardrails(guardrails: Array<{ problem: string; solution: string }>): string {
  if (guardrails.length === 0) {
    return '_No guardrails from previous failures_';
  }
  return guardrails
    .map((g) => `- **Problem:** ${g.problem}\n  **Solution:** ${g.solution}`)
    .join('\n\n');
}
