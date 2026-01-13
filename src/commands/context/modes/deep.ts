/**
 * @module commands/context/modes/deep
 * @description Deep mode - full context with all sections
 *
 * Includes everything from quick + imports, types, env, contracts
 */

import { DOMAIN_FILE_PATTERNS, discoverFiles } from '../helpers';
import { generateContextHints } from '../parsers';
import {
  addQualityIssues,
  buildAdvancedImportGraph,
  parseApiContractsFromRouters,
  parseComponentsFromDirs,
  parseDbRelationsFromSchema,
  parseEnvVarsFromProject,
  parseTestsFromDirs,
  parseTypesAndImports,
  parseZodSchemasFromDirs,
} from '../sections';
import type { AiContextData, ContextOptions, ContextResult } from '../types';

/**
 * Build deep mode sections (runs after quick sections)
 */
export async function buildDeepSections(
  aiData: AiContextData,
  result: ContextResult,
  projectRoot: string,
  options: ContextOptions,
): Promise<void> {
  // Discover related files
  aiData.files = discoverFiles(projectRoot, result.domains);

  // Collect domain patterns
  const domainPatterns = result.domains.flatMap((d) => {
    const patterns = DOMAIN_FILE_PATTERNS[d.toLowerCase()];
    return patterns ? patterns.zod : [d.toLowerCase()];
  });

  // Parse Zod schemas
  parseZodSchemasFromDirs(projectRoot, domainPatterns, aiData);

  // Parse components
  parseComponentsFromDirs(projectRoot, result.domains, aiData);

  // Parse tests
  parseTestsFromDirs(projectRoot, result.domains, aiData);

  // Parse TypeScript types and imports
  parseTypesAndImports(projectRoot, result.domains, aiData);

  // Build advanced import graph with circular dependency detection
  buildAdvancedImportGraph(projectRoot, result.domains, aiData);

  // Parse database relations from Prisma schema
  parseDbRelationsFromSchema(projectRoot, aiData);

  // Parse API contracts from tRPC routers
  parseApiContractsFromRouters(projectRoot, result.domains, aiData);

  // Parse environment variables
  parseEnvVarsFromProject(projectRoot, aiData);

  // Generate hints
  aiData.hints = generateContextHints(result.domains);

  // Quality issues (--with-audit)
  if (options.withAudit) {
    await addQualityIssues(projectRoot, result.relatedFiles, aiData);
  }
}
