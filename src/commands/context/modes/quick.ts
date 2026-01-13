/**
 * @module commands/context/modes/quick
 * @description Quick mode - compact context (~3500 tokens)
 *
 * Includes: architecture, git, tree, schema, routes, repo-map
 */

import { analyzeRoutes } from '@/commands/routes';
import { analyzeSchema } from '@/commands/schema';
import { extractTodos } from '@/commands/status/todos';
import { filterGeneratedFindings } from '@/lib/@detectors/noise-filter';
import { detectEntryPoints, generateDataFlows } from '../collectors';
import {
  collectArchitecturePatterns,
  collectLibModules,
  findRoutersDir,
  findSchemaDir,
  generateProjectTree,
} from '../helpers';
import { generateContextHints } from '../parsers';
import { loadGitHubIssues, loadLibraryDocs, loadRelevantMemory } from '../sections';
import type { AiContextData, ContextOptions, ContextResult } from '../types';

/**
 * Build quick mode sections
 */
export async function buildQuickSections(
  aiData: AiContextData,
  result: ContextResult,
  projectRoot: string,
  options: ContextOptions,
): Promise<void> {
  // Schema analysis
  const schemaDir = findSchemaDir(projectRoot);
  if (schemaDir) {
    try {
      aiData.schema = analyzeSchema(schemaDir);
    } catch (error) {
      if (process.env.DEBUG) {
        console.error('[context] Schema analysis failed:', error);
      }
    }
  }

  // Routes analysis
  const routersDir = findRoutersDir(projectRoot);
  if (routersDir) {
    try {
      aiData.routes = analyzeRoutes(routersDir);
    } catch (error) {
      if (process.env.DEBUG) {
        console.error('[context] Routes analysis failed:', error);
      }
    }
  }

  // Project tree
  aiData.tree = generateProjectTree(projectRoot);

  // Architecture patterns (default: ON, unless --no-architecture)
  if (options.architecture !== false) {
    aiData.architecture = collectArchitecturePatterns(projectRoot);
  }

  // Extract TODO comments from codebase
  const rawTodos = extractTodos(projectRoot);
  const { passed: filteredTodos } = filterGeneratedFindings(rawTodos);
  aiData.todos = filteredTodos;

  // Entry points and data flow
  try {
    const entryPoints = await detectEntryPoints(projectRoot, result.domains);
    if (entryPoints.length > 0) {
      aiData.entryPoints = entryPoints;
      const dataFlows = result.domains.flatMap((domain) => {
        const domainEntryPoints = entryPoints.filter((ep) =>
          ep.file.toLowerCase().includes(domain.toLowerCase()),
        );
        return generateDataFlows(domain, domainEntryPoints);
      });
      if (dataFlows.length > 0) {
        aiData.dataFlows = dataFlows;
      }
    }
  } catch (error) {
    if (process.env.DEBUG) {
      console.error('[context] Entry points detection failed:', error);
    }
  }

  // Lib modules from src/lib/@*
  const libModules = collectLibModules(projectRoot);
  if (libModules) {
    aiData.libModules = libModules;
  }

  // Load GitHub issues (--with-issues)
  if (options.withIssues) {
    const issues = loadGitHubIssues(projectRoot);
    if (issues) {
      aiData.githubIssues = issues;
    }
  }

  // Memory & library docs
  aiData.memories = loadRelevantMemory(projectRoot, result.domains);
  aiData.libraryDocs = await loadLibraryDocs(projectRoot, result.domains);
  aiData.hints = generateContextHints(result.domains);
}
