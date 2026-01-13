/**
 * @module commands/context/modes/minimal
 * @description Minimal mode - ultra-compact context (~1500 tokens)
 *
 * Includes: git, memory, repo-map, schema, routes (all compressed)
 */

import { analyzeRoutes } from '@/commands/routes';
import { analyzeSchema } from '@/commands/schema';
import { findRoutersDir, findSchemaDir } from '../helpers';
import { generateContextHints } from '../parsers';
import { loadRelevantMemory } from '../sections';
import type { AiContextData, ContextResult } from '../types';

/**
 * Build minimal context sections
 */
export function buildMinimalSections(
  aiData: AiContextData,
  result: ContextResult,
  projectRoot: string,
): void {
  // Memory is critical
  aiData.memories = loadRelevantMemory(projectRoot, result.domains);
  aiData.hints = generateContextHints(result.domains);

  // Schema - critical for understanding data model
  const schemaDir = findSchemaDir(projectRoot);
  if (schemaDir) {
    try {
      aiData.schema = analyzeSchema(schemaDir);
    } catch {
      // Schema analysis failed, continue without
    }
  }

  // Routes - critical for understanding API
  const routerDir = findRoutersDir(projectRoot);
  if (routerDir) {
    try {
      aiData.routes = analyzeRoutes(routerDir);
    } catch {
      // Routes analysis failed, continue without
    }
  }
}
