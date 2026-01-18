/**
 * PRD Generator Command
 *
 * Generates PRD.json for Ralph Loop from GitHub issues.
 *
 * @module commands/prd
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type PRD, type PRDTask, validatePRD } from '@/lib/@felix/schemas/prd.schema';
import { sanitizeIssueNumber } from '@/lib/@security';
import { getIssue, isGhAuthenticated, isGhAvailable } from '@/lib/@vcs';
import { PRD_DEFAULTS } from './constants';
import { formatResultJson } from './formatters/json';
import { formatResultXml } from './formatters/xml';
import { analyzeIssue } from './generators/issue-analyzer';
import { decomposeIntoTasks } from './generators/task-decomposer';
import type { GeneratedTask, PrdContext, PrdGenerationResult, PrdGeneratorOptions } from './types';

/** PRD output directory relative to project root */
const PRD_OUTPUT_DIR = '.krolik/felix/prd';

/**
 * Generate PRD from GitHub issue
 */
export async function generatePrd(
  projectRoot: string,
  options: PrdGeneratorOptions,
): Promise<PrdGenerationResult> {
  const startTime = Date.now();
  const meta = {
    issueNumber: options.issue,
    tasksGenerated: 0,
    model: options.model ?? PRD_DEFAULTS.model,
    durationMs: 0,
  };

  try {
    // Validate issue number
    const issueNumber = sanitizeIssueNumber(options.issue);
    if (issueNumber === null) {
      return {
        success: false,
        errors: [`Invalid issue number: ${options.issue}`],
        meta: { ...meta, durationMs: Date.now() - startTime },
      };
    }

    // Check gh CLI
    if (!isGhAvailable()) {
      return {
        success: false,
        errors: ['GitHub CLI (gh) is not installed. Install from: https://cli.github.com/'],
        meta: { ...meta, durationMs: Date.now() - startTime },
      };
    }

    if (!isGhAuthenticated()) {
      return {
        success: false,
        errors: ['Not authenticated with GitHub. Run: gh auth login'],
        meta: { ...meta, durationMs: Date.now() - startTime },
      };
    }

    // Fetch issue
    const issue = getIssue(issueNumber, projectRoot);
    if (!issue) {
      return {
        success: false,
        errors: [`Could not fetch issue #${issueNumber}`],
        meta: { ...meta, durationMs: Date.now() - startTime },
      };
    }

    // Analyze issue
    const parsedIssue = analyzeIssue(issue);

    // Gather project context
    const context = await gatherContext(projectRoot, options.includeContext !== false);

    // Decompose into tasks
    const generatedTasks = await decomposeIntoTasks(parsedIssue, context, {
      model: options.model,
      maxTasks: options.maxTasks,
      projectRoot,
    });

    // Convert to PRD format
    const prd = buildPrd(projectRoot, issueNumber, issue.title, generatedTasks);

    // Validate PRD
    const validation = validatePRD(prd);
    if (!validation.success) {
      return {
        success: false,
        errors: validation.errors,
        meta: { ...meta, durationMs: Date.now() - startTime },
      };
    }

    meta.tasksGenerated = prd.tasks.length;
    meta.durationMs = Date.now() - startTime;

    // Save PRD to file
    const savedPath = savePrdToFile(projectRoot, issueNumber, validation.data);

    // Format output
    const format = options.format ?? PRD_DEFAULTS.format;
    const result: PrdGenerationResult = {
      success: true,
      prd: validation.data,
      meta: { ...meta, savedPath },
    };

    if (format === 'json') {
      result.json = formatResultJson(result);
    } else {
      result.xml = formatResultXml(result);
    }

    return result;
  } catch (error) {
    return {
      success: false,
      errors: [error instanceof Error ? error.message : String(error)],
      meta: { ...meta, durationMs: Date.now() - startTime },
    };
  }
}

/**
 * Lightweight PRD generation for MCP tool
 */
export async function runLightweightPrd(
  projectRoot: string,
  options: Partial<PrdGeneratorOptions>,
): Promise<string> {
  if (!options.issue) {
    return '<prd-error>Issue number is required</prd-error>';
  }

  const result = await generatePrd(projectRoot, {
    issue: options.issue,
    model: options.model,
    maxTasks: options.maxTasks ?? PRD_DEFAULTS.maxTasks,
    format: 'xml',
    includeContext: true,
  });

  return formatResultXml(result);
}

/**
 * Gather project context for PRD generation
 */
async function gatherContext(projectRoot: string, includeContext: boolean): Promise<PrdContext> {
  if (!includeContext) {
    return {};
  }

  const context: PrdContext = {};

  try {
    // Get schema models
    const { analyzeSchema } = await import('@/commands/schema');
    const { findSchemaDir } = await import('@/lib/@discovery/schema');
    const schemaDir = findSchemaDir(projectRoot);
    if (schemaDir) {
      const schema = analyzeSchema(schemaDir);
      context.schemaModels = schema.models.map((m) => m.name);
    }
  } catch {
    // Schema not available
  }

  try {
    // Get routes
    const { analyzeRoutes } = await import('@/commands/routes');
    const { findRoutersDir } = await import('@/lib/@discovery/routes');
    const routersDir = findRoutersDir(projectRoot);
    if (routersDir) {
      const routes = analyzeRoutes(routersDir);
      context.routes = routes.routers.flatMap((r) =>
        r.procedures.map((p) => `${r.name}.${p.name}`),
      );
    }
  } catch {
    // Routes not available
  }

  try {
    // Get relevant memories
    const { hybridSearch } = await import('@/lib/@storage/memory');
    const memories = await hybridSearch('recent decisions', { project: projectRoot, limit: 5 });
    context.memories = memories.map((m) => ({
      title: m.memory.title,
      description: m.memory.description,
    }));
  } catch {
    // Memory not available
  }

  return context;
}

/**
 * Build PRD from generated tasks
 */
function buildPrd(
  projectRoot: string,
  issueNumber: number,
  issueTitle: string,
  generatedTasks: GeneratedTask[],
): PRD {
  // Extract project name from path
  const projectName = projectRoot.split('/').pop() ?? 'project';

  // Convert generated tasks to PRDTask format
  const tasks: PRDTask[] = generatedTasks.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    acceptance_criteria: t.acceptanceCriteria,
    files_affected: t.filesAffected,
    priority: t.priority,
    dependencies: t.dependencies,
    complexity: t.complexity,
    tags: t.tags,
    labels: [],
    relatedFiles: [],
    githubIssue: issueNumber,
  }));

  return {
    version: '1.0',
    project: projectName,
    title: issueTitle,
    description: `Generated from GitHub issue #${issueNumber}`,
    createdAt: new Date().toISOString(),
    config: {
      maxAttempts: 3,
      continueOnFailure: false,
      autoCommit: true,
      autoGuardrails: true,
      retryDelayMs: 2000,
      temperature: 0.7,
      model: 'sonnet',
    },
    tasks,
    metadata: {
      author: 'krolik_prd',
      tags: ['auto-generated'],
      notes: `Generated from issue #${issueNumber}`,
    },
  };
}

/**
 * Save PRD to file in .krolik/ralph/prd directory
 */
function savePrdToFile(projectRoot: string, issueNumber: number, prd: PRD): string {
  const prdDir = join(projectRoot, PRD_OUTPUT_DIR);

  // Create directory if it doesn't exist
  if (!existsSync(prdDir)) {
    mkdirSync(prdDir, { recursive: true });
  }

  // Generate filename: issue-{number}.json
  const filename = `issue-${issueNumber}.json`;
  const filepath = join(prdDir, filename);

  // Write PRD as formatted JSON
  writeFileSync(filepath, JSON.stringify(prd, null, 2), 'utf-8');

  return filepath;
}

export type { PrdGenerationResult, PrdGeneratorOptions } from './types';
