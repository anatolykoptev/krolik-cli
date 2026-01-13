/**
 * @module commands/context/sections/parsers
 * @description Parser orchestration for deep context analysis
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { matchesDomain, scanFeaturesDir } from '../collectors/entrypoints';
import {
  COMPONENT_DIRS,
  GENERIC_DOMAINS,
  IMPORT_DIRS,
  IMPORT_GRAPH_DIRS,
  ROUTER_DIRS,
  SCHEMA_DIRS,
  TEST_DIRS,
  TYPE_DIRS,
  ZOD_DIRS,
} from '../constants';
import { DOMAIN_FILE_PATTERNS } from '../helpers';
import {
  buildImportGraph,
  buildImportGraphSwc,
  parseApiContracts,
  parseComponents,
  parseDbRelations,
  parseEnvVars,
  parseTestFiles,
  parseTypesInDir,
  parseZodSchemas,
} from '../parsers';
import type { AiContextData } from '../types';

/**
 * Parse Zod schemas from standard directories
 */
export function parseZodSchemasFromDirs(
  projectRoot: string,
  patterns: string[],
  aiData: AiContextData,
): void {
  for (const dir of ZOD_DIRS) {
    const fullPath = path.join(projectRoot, dir);
    if (fs.existsSync(fullPath)) {
      const schemas = parseZodSchemas(fullPath, patterns);
      if (schemas.length > 0) {
        aiData.ioSchemas = [...(aiData.ioSchemas || []), ...schemas];
      }
    }
  }
}

/**
 * Parse components from standard directories + dynamic feature discovery
 */
export function parseComponentsFromDirs(
  projectRoot: string,
  domains: string[],
  aiData: AiContextData,
): void {
  const componentPatterns = domains.flatMap((d) => {
    const patterns = DOMAIN_FILE_PATTERNS[d.toLowerCase()];
    return patterns ? patterns.components : [d];
  });

  for (const dir of COMPONENT_DIRS) {
    const fullPath = path.join(projectRoot, dir);
    if (fs.existsSync(fullPath)) {
      const components = parseComponents(fullPath, componentPatterns);
      if (components.length > 0) {
        aiData.componentDetails = [...(aiData.componentDetails || []), ...components];
      }
    }
  }

  // Dynamic discovery: feature components via scanFeaturesDir
  const featureFiles = scanFeaturesDir(projectRoot, 'apps/web/features', domains, '', ['.tsx']);
  for (const file of featureFiles) {
    const fullPath = path.join(projectRoot, file);
    const components = parseComponents(path.dirname(fullPath), ['*']);
    if (components.length > 0) {
      const existingNames = new Set(aiData.componentDetails?.map((c) => c.name) || []);
      const newComponents = components.filter((c) => !existingNames.has(c.name));
      aiData.componentDetails = [...(aiData.componentDetails || []), ...newComponents];
    }
  }
}

/**
 * Parse tests from standard directories
 */
export function parseTestsFromDirs(
  projectRoot: string,
  domains: string[],
  aiData: AiContextData,
): void {
  const testPatterns = domains.flatMap((d) => {
    const patterns = DOMAIN_FILE_PATTERNS[d.toLowerCase()];
    return patterns ? patterns.tests : [d.toLowerCase()];
  });

  for (const dir of TEST_DIRS) {
    const fullPath = path.join(projectRoot, dir);
    if (fs.existsSync(fullPath)) {
      const tests = parseTestFiles(fullPath, testPatterns);
      if (tests.length > 0) {
        aiData.testDetails = [...(aiData.testDetails || []), ...tests];
      }
    }
  }
}

/**
 * Discover feature type files dynamically
 */
function discoverFeatureTypeFiles(projectRoot: string, domains: string[]): string[] {
  const featuresDir = path.join(projectRoot, 'apps/web/features');
  if (!fs.existsSync(featuresDir)) return [];

  const typeFiles: string[] = [];
  try {
    const features = fs.readdirSync(featuresDir, { withFileTypes: true });
    for (const feature of features) {
      if (!feature.isDirectory()) continue;
      if (domains.length > 0 && !matchesDomain(feature.name, domains)) continue;

      const typesFile = path.join(featuresDir, feature.name, 'types.ts');
      if (fs.existsSync(typesFile)) {
        typeFiles.push(typesFile);
      }
    }
  } catch {
    // Ignore errors
  }
  return typeFiles;
}

/**
 * Parse TypeScript types and import graph
 */
export function parseTypesAndImports(
  projectRoot: string,
  domains: string[],
  aiData: AiContextData,
): void {
  const typePatterns = domains
    .map((d) => d.toLowerCase())
    .filter((d) => !GENERIC_DOMAINS.some((g) => d.includes(g)));

  for (const dir of TYPE_DIRS) {
    const fullPath = path.join(projectRoot, dir);
    if (fs.existsSync(fullPath)) {
      const types = parseTypesInDir(fullPath, typePatterns);
      if (types.length > 0) {
        aiData.types = [...(aiData.types || []), ...types];
      }
    }
  }

  // Dynamic discovery: feature type files
  const featureTypeFiles = discoverFeatureTypeFiles(projectRoot, domains);
  for (const typeFile of featureTypeFiles) {
    const types = parseTypesInDir(path.dirname(typeFile), ['types']);
    if (types.length > 0) {
      aiData.types = [...(aiData.types || []), ...types];
    }
  }

  // Build import graph for domain-related files
  for (const dir of IMPORT_DIRS) {
    const fullPath = path.join(projectRoot, dir);
    if (fs.existsSync(fullPath)) {
      const imports = buildImportGraph(fullPath, typePatterns);
      if (imports.length > 0) {
        aiData.imports = [...(aiData.imports || []), ...imports];
      }
    }
  }
}

/**
 * Build advanced import graph with circular dependency detection
 */
export function buildAdvancedImportGraph(
  projectRoot: string,
  _domains: string[],
  aiData: AiContextData,
): void {
  for (const dir of IMPORT_GRAPH_DIRS) {
    const fullPath = path.join(projectRoot, dir);
    if (fs.existsSync(fullPath)) {
      try {
        const graph = buildImportGraphSwc(fullPath, []);
        if (graph.nodes.length > 0) {
          aiData.importGraph = graph;
          break;
        }
      } catch (error) {
        if (process.env.DEBUG) {
          console.error('[context] Import graph building failed:', error);
        }
      }
    }
  }
}

/**
 * Parse database relations from Prisma schema
 */
export function parseDbRelationsFromSchema(projectRoot: string, aiData: AiContextData): void {
  for (const schemaDir of SCHEMA_DIRS) {
    const fullPath = path.join(projectRoot, schemaDir);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
      try {
        const relations = parseDbRelations(fullPath);
        if (relations.models.length > 0 || relations.relations.length > 0) {
          aiData.dbRelations = relations;
          break;
        }
      } catch (error) {
        if (process.env.DEBUG) {
          console.error('[context] DB relations parsing failed:', error);
        }
      }
    }
  }
}

/**
 * Parse API contracts from tRPC routers
 */
export function parseApiContractsFromRouters(
  projectRoot: string,
  domains: string[],
  aiData: AiContextData,
): void {
  const patterns = domains.map((d) => d.toLowerCase());

  for (const dir of ROUTER_DIRS) {
    const fullPath = path.join(projectRoot, dir);
    if (fs.existsSync(fullPath)) {
      try {
        const contracts = parseApiContracts(fullPath, patterns);
        if (contracts.length > 0) {
          aiData.apiContracts = [...(aiData.apiContracts || []), ...contracts];
        }
      } catch (error) {
        if (process.env.DEBUG) {
          console.error('[context] API contracts parsing failed:', error);
        }
      }
    }
  }
}

/**
 * Parse environment variables from project
 */
export function parseEnvVarsFromProject(projectRoot: string, aiData: AiContextData): void {
  try {
    const envReport = parseEnvVars(projectRoot);
    if (
      envReport.usages.length > 0 ||
      envReport.definitions.length > 0 ||
      envReport.missing.length > 0
    ) {
      aiData.envVars = envReport;
    }
  } catch (error) {
    if (process.env.DEBUG) {
      console.error('[context] Environment variables parsing failed:', error);
    }
  }
}
