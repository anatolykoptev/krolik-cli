/**
 * @module commands/agent/context
 * @description Context injection for agents
 */

import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { detectLibraries, searchDocs } from '../../lib/@docs-cache';
import type { Memory } from '../../lib/@memory';
import { search, searchByFeatures } from '../../lib/@memory';
import type { AgentContext, AgentOptions, LibraryDocSnippet } from './types';

/**
 * Build agent context from project
 */
export async function buildAgentContext(
  projectRoot: string,
  options: AgentOptions,
): Promise<AgentContext> {
  const context: AgentContext = {
    projectRoot,
  };

  // Include schema if requested or by default for db-related agents
  if (options.includeSchema !== false) {
    const schema = getSchema(projectRoot);
    if (schema) context.schema = schema;
  }

  // Include routes if requested or by default for api-related agents
  if (options.includeRoutes !== false) {
    const routes = getRoutes(projectRoot);
    if (routes) context.routes = routes;
  }

  // Include git info if requested
  if (options.includeGit !== false) {
    const gitStatus = getGitStatus(projectRoot);
    const gitDiff = getGitDiff(projectRoot);
    if (gitStatus) context.gitStatus = gitStatus;
    if (gitDiff) context.gitDiff = gitDiff;
  }

  // Include target file content if specified
  if (options.file) {
    const filePath = path.resolve(projectRoot, options.file);
    if (fs.existsSync(filePath)) {
      context.targetFile = options.file;
      context.targetContent = fs.readFileSync(filePath, 'utf-8');
    }
  }

  // Include feature name if specified
  if (options.feature) {
    context.feature = options.feature;
  }

  // Include library documentation if feature is specified
  if (options.feature) {
    const libraryDocs = enrichWithLibraryDocs(options.feature, projectRoot);
    if (libraryDocs.length > 0) {
      context.libraryDocs = libraryDocs;
    }
  }

  // Include memories if enabled (default: true)
  if (options.includeMemory !== false) {
    const memories = loadAgentMemories(projectRoot, options.feature);
    if (memories.length > 0) {
      context.memories = memories;
    }
  }

  return context;
}

/**
 * Enrich agent context with library documentation
 *
 * Searches cached documentation for relevant snippets based on the task/feature.
 * Uses libraries detected from the project's package.json.
 *
 * @param task - The task or feature name to search for
 * @param projectRoot - Project root directory
 * @returns Array of relevant documentation snippets
 */
function enrichWithLibraryDocs(task: string, projectRoot: string): LibraryDocSnippet[] {
  try {
    const libs = detectLibraries(projectRoot);
    if (libs.length === 0) return [];

    // Search across all detected libraries
    const results = searchDocs({
      query: task,
      limit: 5,
    });

    return results.map((r) => ({
      library: r.libraryName,
      title: r.section.title,
      snippet: r.section.content.slice(0, 300),
    }));
  } catch {
    return [];
  }
}

/**
 * Load relevant memories for agent context
 *
 * Strategy:
 * 1. If feature is provided, search by feature for relevant memories
 * 2. Fallback: get critical/high importance patterns and decisions
 *
 * @param projectRoot - Project root directory (used to derive project name)
 * @param feature - Optional feature/domain to filter memories by
 * @returns Array of relevant Memory objects (max 5 to avoid context bloat)
 */
function loadAgentMemories(projectRoot: string, feature?: string): Memory[] {
  const maxMemories = 5;

  try {
    // Derive project name from directory
    const projectName = path.basename(projectRoot);

    // Strategy 1: If feature provided, search by features
    if (feature) {
      const results = searchByFeatures(projectName, [feature], maxMemories);
      if (results.length > 0) {
        return results.map((r) => r.memory);
      }
    }

    // Strategy 2: Fallback to critical/high importance patterns and decisions
    const criticalResults = search({
      project: projectName,
      importance: 'critical',
      limit: maxMemories,
    });

    if (criticalResults.length >= maxMemories) {
      return criticalResults.map((r) => r.memory);
    }

    // Fill remaining slots with high importance patterns/decisions
    const remaining = maxMemories - criticalResults.length;
    const highResults = search({
      project: projectName,
      importance: 'high',
      limit: remaining,
    });

    const memories = [...criticalResults.map((r) => r.memory), ...highResults.map((r) => r.memory)];

    return memories.slice(0, maxMemories);
  } catch {
    // Handle errors gracefully - return empty array on failure
    return [];
  }
}

/**
 * Get Prisma schema summary
 */
function getSchema(projectRoot: string): string | undefined {
  // Check common prisma locations
  const candidates = [
    path.join(projectRoot, 'packages', 'db', 'prisma'),
    path.join(projectRoot, 'prisma'),
  ];

  for (const schemaDir of candidates) {
    const schemaFile = path.join(schemaDir, 'schema.prisma');
    if (fs.existsSync(schemaFile)) {
      return fs.readFileSync(schemaFile, 'utf-8');
    }

    // Try multi-file schema
    const modelsDir = path.join(schemaDir, 'models');
    if (fs.existsSync(modelsDir)) {
      const files = fs.readdirSync(modelsDir).filter((f) => f.endsWith('.prisma'));
      const contents = files.map((f) => fs.readFileSync(path.join(modelsDir, f), 'utf-8'));
      return contents.join('\n\n');
    }
  }

  return undefined;
}

/**
 * Get tRPC routes summary
 */
function getRoutes(projectRoot: string): string | undefined {
  // Check common router locations
  const candidates = [
    path.join(projectRoot, 'packages', 'api', 'src', 'routers'),
    path.join(projectRoot, 'src', 'server', 'routers'),
    path.join(projectRoot, 'src', 'routers'),
  ];

  for (const routersDir of candidates) {
    if (fs.existsSync(routersDir)) {
      const files = fs.readdirSync(routersDir).filter((f) => f.endsWith('.ts'));
      if (files.length > 0) {
        return `Available routers:\n${files.map((f) => `- ${f.replace('.ts', '')}`).join('\n')}`;
      }
    }
  }

  return undefined;
}

/**
 * Get git status
 */
function getGitStatus(projectRoot: string): string | undefined {
  try {
    return execSync('git status --short', {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();
  } catch {
    return undefined;
  }
}

/**
 * Get git diff
 */
function getGitDiff(projectRoot: string): string | undefined {
  try {
    const diff = execSync('git diff --stat HEAD~5..HEAD', {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout: 10000,
    }).trim();

    // Limit diff size
    if (diff.length > 5000) {
      return `${diff.slice(0, 5000)}\n... (truncated)`;
    }

    return diff;
  } catch {
    return undefined;
  }
}

/**
 * Format context for agent prompt
 */
export function formatContextForPrompt(context: AgentContext): string {
  const sections: string[] = [];

  sections.push(`<project-root>${context.projectRoot}</project-root>`);

  if (context.feature) {
    sections.push(`<feature>${context.feature}</feature>`);
  }

  if (context.targetFile && context.targetContent) {
    sections.push(`<target-file path="${context.targetFile}">
${context.targetContent}
</target-file>`);
  }

  if (context.schema) {
    sections.push(`<database-schema>
${context.schema}
</database-schema>`);
  }

  if (context.routes) {
    sections.push(`<api-routes>
${context.routes}
</api-routes>`);
  }

  if (context.gitStatus) {
    sections.push(`<git-status>
${context.gitStatus}
</git-status>`);
  }

  if (context.gitDiff) {
    sections.push(`<git-diff>
${context.gitDiff}
</git-diff>`);
  }

  if (context.libraryDocs && context.libraryDocs.length > 0) {
    const docsContent = context.libraryDocs
      .map(
        (doc) => `<doc library="${doc.library}" title="${doc.title}">
${doc.snippet}
</doc>`,
      )
      .join('\n');
    sections.push(`<library-docs>
${docsContent}
</library-docs>`);
  }

  if (context.memories && context.memories.length > 0) {
    const memoriesContent = context.memories
      .map(
        (mem) => `<memory type="${mem.type}" importance="${mem.importance}">
  <title>${mem.title}</title>
  <description>${mem.description}</description>${mem.tags.length > 0 ? `\n  <tags>${mem.tags.join(', ')}</tags>` : ''}${mem.features && mem.features.length > 0 ? `\n  <features>${mem.features.join(', ')}</features>` : ''}
</memory>`,
      )
      .join('\n');
    sections.push(`<memories>
${memoriesContent}
</memories>`);
  }

  return `<project-context>
${sections.join('\n\n')}
</project-context>`;
}
