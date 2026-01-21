/**
 * @module commands/agent/context/enrichers
 * @description Context enrichment functions for agents
 *
 * Uses shared cached modules:
 * - @/lib/@vcs for git operations (cached with 5s TTL)
 * - @/lib/@context for schema/routes (mtime-based invalidation)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { clearRoutesCache, clearSchemaCache, getPrismaSchema, getTrpcRoutes } from '@/lib/@context';
import { loadContextMemories } from '@/lib/@context/memory';
import { logger } from '@/lib/@core/logger/logger';
import { detectLibraries } from '@/lib/@integrations/context7';
import { searchDocs } from '@/lib/@storage/docs';
import { getGuardrailsByProject } from '@/lib/@storage/felix';
import { clearGitCache, getDiff, getStatus, isGitRepo } from '@/lib/@vcs';
import { LIMITS, TRUNCATION } from '../constants';
import type { AgentContext, LibraryDocSnippet } from '../types';

/**
 * Clear all caches (useful for testing)
 */
export function clearContextCache(): void {
  clearSchemaCache();
  clearRoutesCache();
  clearGitCache();
  logger.debug('[agent/context] All caches cleared');
}

// ============================================================================
// ENRICHMENT FUNCTIONS
// ============================================================================

/**
 * Enrich context with schema if enabled
 * Uses @/lib/@context/schema (cached with mtime invalidation)
 */
export function enrichWithSchema(
  context: AgentContext,
  projectRoot: string,
  include: boolean,
): void {
  if (include === false) return;
  const schema = getPrismaSchema(projectRoot);
  if (schema) context.schema = schema;
}

/**
 * Enrich context with routes if enabled
 * Uses @/lib/@context/routes (cached with mtime invalidation)
 */
export function enrichWithRoutes(
  context: AgentContext,
  projectRoot: string,
  include: boolean,
): void {
  if (include === false) return;
  const routes = getTrpcRoutes(projectRoot);
  if (routes) context.routes = routes;
}

/**
 * Enrich context with git info if enabled
 * Uses @/lib/@vcs which has built-in 5s TTL caching
 */
export function enrichWithGitInfo(
  context: AgentContext,
  projectRoot: string,
  include: boolean,
): void {
  if (include === false) return;
  if (!isGitRepo(projectRoot)) return;

  // Get status from @/lib/@vcs (cached)
  const status = getStatus(projectRoot);
  if (status.hasChanges) {
    const lines: string[] = [];
    for (const file of status.staged) lines.push(`A  ${file}`);
    for (const file of status.modified) lines.push(` M ${file}`);
    for (const file of status.untracked) lines.push(`?? ${file}`);
    context.gitStatus = lines.join('\n');
  }

  // Get diff from @/lib/@vcs (cached)
  const diff = getDiff({ cwd: projectRoot });
  if (diff) {
    context.gitDiff =
      diff.length > TRUNCATION.GIT_DIFF
        ? `${diff.slice(0, TRUNCATION.GIT_DIFF)}\n... (truncated)`
        : diff;
  }
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
