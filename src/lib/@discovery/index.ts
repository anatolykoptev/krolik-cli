/**
 * @module lib/@discovery
 * @description Centralized project discovery utilities
 *
 * This is the SINGLE source of truth for all discovery operations:
 * - Project root and monorepo detection
 * - Schema discovery (Prisma, Zod)
 * - Route discovery (tRPC, Next.js, Express)
 * - Module scanning (lib/@* modules)
 * - Architecture pattern detection
 * - Dynamic path resolution (tsconfig.json aliases)
 *
 * @example
 * import {
 *   findProjectRoot,
 *   findSchemaDir,
 *   findRoutersDir,
 *   createPathResolver,
 *   collectArchitecturePatterns
 * } from '@/lib/@discovery';
 */

// Architecture pattern detection
export * from './architecture';
// Simple regex-based code extraction (for reporting)
export { extractCodeStructure, extractExportNames, extractImportPaths } from './code-extraction';
export type { ModuleExport, ModuleInfo, ModuleScanResult } from './modules';
// Module scanning (lib/@* modules)
export { formatModulesMarkdown, getModule, scanLibModules, searchExports } from './modules';
// Dynamic path resolution (tsconfig.json aliases)
export type { PathResolver, TsConfigPaths } from './paths';
export {
  aliasToRelative,
  createPathResolver,
  getAliasPatterns,
  normalizeImportPath,
  parseTsConfig,
  relativeToAlias,
} from './paths';
export type { MonorepoInfo, ProjectInfo } from './project';
// Project discovery
export {
  clearPackageJsonCache,
  detectMonorepo,
  findGitRoot,
  findPackageJson,
  findProjectRoot,
  getProjectInfo,
  readPackageJson,
} from './project';
export type { ApiRoutesInfo, ApiType } from './routes';
// Route discovery (tRPC, Next.js, Express)
export {
  discoverApiRoutes,
  findExpressRoutes,
  findExpressRoutesDir,
  findNextjsApiDir,
  findNextjsApiRoutes,
  findRoutersDir,
  findTrpcRouters,
} from './routes';
export type { PackageJson, PackageType, SchemaInfo, SubDocInfo } from './schema';
// Schema discovery (Prisma, Zod, Sub-docs)
// Package type detection
export {
  detectPackageType,
  discoverSchemas,
  findPrismaSchema,
  findPrismaSchemaFiles,
  findSchemaDir,
  findSubDocs,
  findZodSchemas,
  findZodSchemasDir,
  getPackageTypeLabel,
} from './schema';
// Source file analysis
export {
  analyzeSourceFile,
  type ExportedMember,
  type ExportKind,
  type MethodInfo,
  type ParamInfo,
  type SourceAnalysisResult,
} from './source-analyzer';
