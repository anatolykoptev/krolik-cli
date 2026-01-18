/**
 * @module commands/agent/context/enrichers
 * @description Context enrichment functions for agents
 */

import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadContextMemories } from '@/lib/@context/memory';
import { logger } from '@/lib/@core/logger/logger';
import { detectLibraries } from '@/lib/@integrations/context7';
import { searchDocs } from '@/lib/@storage/docs';
import { getGuardrailsByProject } from '@/lib/@storage/felix';
import { LIMITS, TIMEOUTS, TRUNCATION } from '../constants';
import type { AgentContext, LibraryDocSnippet } from '../types';

// ============================================================================
// ENRICHMENT FUNCTIONS
// ============================================================================

/**
 * Enrich context with schema if enabled
 */
export function enrichWithSchema(
  context: AgentContext,
  projectRoot: string,
  include: boolean,
): void {
  if (include === false) return;
  const schema = getSchema(projectRoot);
  if (schema) context.schema = schema;
}

/**
 * Enrich context with routes if enabled
 */
export function enrichWithRoutes(
  context: AgentContext,
  projectRoot: string,
  include: boolean,
): void {
  if (include === false) return;
  const routes = getRoutes(projectRoot);
  if (routes) context.routes = routes;
}

/**
 * Enrich context with git info if enabled
 */
export function enrichWithGitInfo(
  context: AgentContext,
  projectRoot: string,
  include: boolean,
): void {
  if (include === false) return;
  const gitStatus = getGitStatus(projectRoot);
  const gitDiff = getGitDiff(projectRoot);
  if (gitStatus) context.gitStatus = gitStatus;
  if (gitDiff) context.gitDiff = gitDiff;
}

/**
 * Enrich context with target file content
 */
export function enrichWithTargetFile(
  context: AgentContext,
  projectRoot: string,
  file?: string,
): void {
  if (!file) return;
  const filePath = path.resolve(projectRoot, file);
  if (fs.existsSync(filePath)) {
    context.targetFile = file;
    context.targetContent = fs.readFileSync(filePath, 'utf-8');
  }
}

/**
 * Enrich context with feature and library docs
 */
export function enrichWithFeature(
  context: AgentContext,
  projectRoot: string,
  feature?: string,
): void {
  if (!feature) return;
  context.feature = feature;
  const libraryDocs = enrichWithLibraryDocs(feature, projectRoot);
  if (libraryDocs.length > 0) {
    context.libraryDocs = libraryDocs;
  }
}

/**
 * Enrich context with memories if enabled
 */
export function enrichWithMemories(
  context: AgentContext,
  projectRoot: string,
  feature?: string,
  include?: boolean,
): void {
  if (include === false) return;
  const memories = loadContextMemories(projectRoot, undefined, feature);
  if (memories.length > 0) {
    context.memories = memories;
  }
}

/**
 * Enrich context with skills if enabled
 */
export function enrichWithSkills(
  context: AgentContext,
  projectRoot: string,
  include: boolean,
): void {
  if (include === false) return;

  try {
    const projectName = path.basename(projectRoot);
    const skills = getGuardrailsByProject(projectName);

    if (skills.length > 0) {
      context.skills = skills;
      logger.debug(`[agent/context] Enriched with ${skills.length} skills`);
    }
  } catch (error) {
    logger.debug(
      `[agent/context] Skills enrichment failed: ${error instanceof Error ? error.message : 'unknown'}`,
    );
  }
}

// ============================================================================
// DATA FETCHERS
// ============================================================================

/**
 * Enrich agent context with library documentation
 */
function enrichWithLibraryDocs(task: string, projectRoot: string): LibraryDocSnippet[] {
  try {
    const libs = detectLibraries(projectRoot);
    if (libs.length === 0) return [];

    const results = searchDocs({
      query: task,
      limit: LIMITS.LIBRARY_DOCS,
    });

    logger.debug(`[agent/context] Enriched with ${results.length} library docs for "${task}"`);
    return results.map((r) => ({
      library: r.libraryName,
      title: r.section.title,
      snippet: r.section.content.slice(0, TRUNCATION.DOC_SNIPPET),
    }));
  } catch (error) {
    logger.debug(
      `[agent/context] Library docs enrichment failed: ${error instanceof Error ? error.message : 'unknown'}`,
    );
    return [];
  }
}

/**
 * Get Prisma schema summary
 */
function getSchema(projectRoot: string): string | undefined {
  const candidates = [
    path.join(projectRoot, 'packages', 'db', 'prisma'),
    path.join(projectRoot, 'prisma'),
  ];

  for (const schemaDir of candidates) {
    const schemaFile = path.join(schemaDir, 'schema.prisma');
    if (fs.existsSync(schemaFile)) {
      return fs.readFileSync(schemaFile, 'utf-8');
    }

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
      timeout: TIMEOUTS.GIT_STATUS,
    }).trim();
  } catch (error) {
    logger.debug(
      `[agent/context] Git status failed: ${error instanceof Error ? error.message : 'unknown'}`,
    );
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
      timeout: TIMEOUTS.GIT_DIFF,
    }).trim();

    if (diff.length > TRUNCATION.GIT_DIFF) {
      return `${diff.slice(0, TRUNCATION.GIT_DIFF)}\n... (truncated)`;
    }

    return diff;
  } catch (error) {
    logger.debug(
      `[agent/context] Git diff failed: ${error instanceof Error ? error.message : 'unknown'}`,
    );
    return undefined;
  }
}
