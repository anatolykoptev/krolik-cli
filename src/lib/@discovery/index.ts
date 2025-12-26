/**
 * @module lib/discovery
 * @description Centralized path discovery utilities
 *
 * This is the SINGLE source of truth for all path discovery.
 * All commands should import from here instead of duplicating discovery logic.
 *
 * @example
 * import { findProjectRoot, findSchemaDir, findRoutersDir } from '@/lib/@discovery';
 */

export type { ModuleExport, ModuleInfo, ModuleScanResult } from './modules';
// Module scanning (lib/@* modules)
export { formatModulesMarkdown, getModule, scanLibModules, searchExports } from './modules';
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
