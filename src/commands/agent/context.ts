/**
 * @module commands/agent/context
 * @description Context injection for agents
 */

import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { AgentContext, AgentOptions } from './types';

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

  return context;
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

  return `<project-context>
${sections.join('\n\n')}
</project-context>`;
}
