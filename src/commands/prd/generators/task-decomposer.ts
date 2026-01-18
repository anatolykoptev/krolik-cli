/**
 * Task Decomposer - AI-powered task decomposition
 *
 * @module commands/prd/generators/task-decomposer
 */

import { DECOMPOSITION_SYSTEM_PROMPT, PRD_LIMITS } from '../constants';
import type {
  GeneratedTask,
  ParsedIssue,
  PrdContext,
  PrdModel,
  TaskComplexity,
  TaskPriority,
} from '../types';
import { formatIssueForPrompt } from './issue-analyzer';
import { splitLargeTasks } from './task-splitter';

/**
 * Options for task decomposition
 */
export interface DecomposeOptions {
  model?: PrdModel | undefined;
  maxTasks?: number | undefined;
  projectRoot: string;
}

/**
 * Decompose issue into tasks using AI
 */
export async function decomposeIntoTasks(
  parsedIssue: ParsedIssue,
  context: PrdContext,
  options: DecomposeOptions,
): Promise<GeneratedTask[]> {
  const { model = 'sonnet', maxTasks = 10, projectRoot } = options;

  // Build the user prompt
  const userPrompt = buildUserPrompt(parsedIssue, context, maxTasks);

  // Call the LLM
  const response = await callLlm(userPrompt, model, projectRoot);

  // Parse and validate the response
  const rawTasks = parseAiResponse(response, parsedIssue);

  // Split large tasks that affect too many files into atomic tasks
  const { tasks: splitTasks } = splitLargeTasks(rawTasks);

  // Limit tasks
  return splitTasks.slice(0, Math.min(maxTasks, PRD_LIMITS.maxTasks));
}

/**
 * Build user prompt for task decomposition
 */
function buildUserPrompt(issue: ParsedIssue, context: PrdContext, maxTasks: number): string {
  const lines: string[] = [];

  lines.push('## GitHub Issue');
  lines.push(formatIssueForPrompt(issue));
  lines.push('');

  lines.push('## Project Context');

  if (context.schemaModels?.length) {
    lines.push('### Database Models');
    lines.push(context.schemaModels.join(', '));
    lines.push('');
  }

  if (context.routes?.length) {
    lines.push('### API Routes');
    lines.push(context.routes.slice(0, 20).join(', '));
    lines.push('');
  }

  if (context.memories?.length) {
    lines.push('### Related Decisions');
    for (const mem of context.memories.slice(0, 5)) {
      lines.push(`- ${mem.title}: ${mem.description.slice(0, 100)}...`);
    }
    lines.push('');
  }

  if (context.relatedFiles?.length) {
    lines.push('### Related Files');
    for (const file of context.relatedFiles.slice(0, 10)) {
      lines.push(`- ${file}`);
    }
    lines.push('');
  }

  lines.push(`## Instructions`);
  lines.push(`Decompose the issue into ${maxTasks} or fewer atomic tasks.`);
  lines.push(`Output ONLY a valid JSON array.`);

  return lines.join('\n');
}

/**
 * Call LLM for task decomposition (non-blocking using spawn)
 */
async function callLlm(prompt: string, model: string, projectRoot: string): Promise<string> {
  const { spawn } = await import('node:child_process');

  // Build full prompt with system instruction
  const fullPrompt = `${DECOMPOSITION_SYSTEM_PROMPT}\n\n---\n\n${prompt}`;

  // Map model aliases to actual CLI models
  const isGemini = model.startsWith('gemini-') || model === 'flash' || model === 'pro';

  return new Promise((resolve, reject) => {
    let executable: string;
    let args: string[];

    if (isGemini) {
      // Use Gemini CLI
      const geminiModel =
        model === 'flash' || model === 'gemini-flash'
          ? 'gemini-2.0-flash'
          : model === 'pro' || model === 'gemini-pro'
            ? 'gemini-2.0-pro'
            : model;

      executable = 'gemini';
      args = ['-m', geminiModel];
    } else {
      // Use Claude CLI - it accepts aliases directly (haiku, sonnet, opus)
      executable = 'claude';
      args = ['--model', model, '--print'];
    }

    const proc = spawn(executable, args, {
      cwd: projectRoot,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 300000, // 5 min
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code: number | null) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`CLI exited with code ${code}: ${stderr}`));
      }
    });

    proc.on('error', (error: Error) => {
      reject(error);
    });

    // Write prompt to stdin and close
    proc.stdin.write(fullPrompt);
    proc.stdin.end();
  });
}

/**
 * Parse AI response into tasks
 */
function parseAiResponse(response: string, issue: ParsedIssue): GeneratedTask[] {
  // Try to extract JSON from response
  let jsonStr = response.trim();

  // Remove markdown code blocks if present
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1]?.trim() ?? jsonStr;
  }

  // Find JSON array
  const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    jsonStr = arrayMatch[0];
  }

  try {
    const parsed = JSON.parse(jsonStr);

    if (!Array.isArray(parsed)) {
      return generateFallbackTasks(issue);
    }

    return parsed.map((item, index) => normalizeTask(item, index, issue));
  } catch {
    // If parsing fails, create fallback tasks from checklists
    return generateFallbackTasks(issue);
  }
}

/**
 * Normalize a task from AI response
 */
function normalizeTask(raw: unknown, index: number, issue: ParsedIssue): GeneratedTask {
  const item = raw as Record<string, unknown>;
  const id = String(item.id ?? `task-${index + 1}`);

  return {
    id: id.slice(0, 50),
    title: String(item.title ?? `Task ${index + 1}`).slice(0, 200),
    description: escapeAdkTemplateVars(String(item.description ?? issue.title).slice(0, 1000)),
    acceptanceCriteria: normalizeAcceptanceCriteria(item.acceptanceCriteria).slice(
      0,
      PRD_LIMITS.maxAcceptanceCriteria,
    ),
    filesAffected: normalizeArray(item.filesAffected).slice(0, PRD_LIMITS.maxFilesAffected),
    complexity: normalizeComplexity(item.complexity),
    priority: normalizePriority(item.priority, issue.inferredPriority),
    dependencies: normalizeArray(item.dependencies).slice(0, PRD_LIMITS.maxDependencies),
    tags: [...new Set([...issue.tags, ...normalizeArray(item.tags)])].slice(0, PRD_LIMITS.maxTags),
  };
}

/**
 * Generate fallback tasks from issue checklists
 */
function generateFallbackTasks(issue: ParsedIssue): GeneratedTask[] {
  if (issue.checklists.length === 0) {
    // Single task for the entire issue
    return [
      {
        id: `implement-${issue.number}`,
        title: issue.title,
        description: escapeAdkTemplateVars(issue.body.slice(0, 500)),
        acceptanceCriteria: ['Implementation matches issue requirements'],
        filesAffected: issue.mentionedFiles,
        complexity: 'moderate',
        priority: issue.inferredPriority,
        dependencies: [],
        tags: issue.tags,
      },
    ];
  }

  // Create task for each checklist item
  return issue.checklists.map((item, index) => ({
    id: `task-${index + 1}`,
    title: item.text.slice(0, 100),
    description: escapeAdkTemplateVars(item.text),
    acceptanceCriteria: [escapeAdkTemplateVars(item.text)],
    filesAffected: issue.mentionedFiles,
    complexity: 'simple' as TaskComplexity,
    priority: issue.inferredPriority,
    dependencies: index > 0 ? [`task-${index}`] : [],
    tags: issue.tags,
  }));
}

function normalizeArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v) => typeof v === 'string').map((v) => String(v));
  }
  return [];
}

/**
 * Escape curly braces in text to prevent ADK template interpretation.
 * ADK interprets {variable} as template variables - replace with [variable].
 */
function escapeAdkTemplateVars(text: string): string {
  // Replace {var} with [var] to avoid ADK template interpretation
  return text.replace(/\{([^{}]+)\}/g, '[$1]');
}

/**
 * Normalize acceptance criteria with ADK template escaping
 */
function normalizeAcceptanceCriteria(value: unknown): string[] {
  return normalizeArray(value).map(escapeAdkTemplateVars);
}

function normalizeComplexity(value: unknown): TaskComplexity {
  const valid: TaskComplexity[] = ['trivial', 'simple', 'moderate', 'complex', 'epic'];
  const str = String(value ?? 'moderate').toLowerCase();
  return valid.includes(str as TaskComplexity) ? (str as TaskComplexity) : 'moderate';
}

function normalizePriority(value: unknown, fallback: TaskPriority): TaskPriority {
  const valid: TaskPriority[] = ['critical', 'high', 'medium', 'low'];
  const str = String(value ?? fallback).toLowerCase();
  return valid.includes(str as TaskPriority) ? (str as TaskPriority) : fallback;
}
