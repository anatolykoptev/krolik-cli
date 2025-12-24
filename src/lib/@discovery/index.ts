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

export type { MonorepoInfo, ProjectInfo } from './project';
// Project discovery
export {
  detectMonorepo,
  findGitRoot,
  findPackageJson,
  findProjectRoot,
  getProjectInfo,
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
export type { SchemaInfo } from './schema';
// Schema discovery (Prisma, Zod)
export {
  discoverSchemas,
  findPrismaSchema,
  findPrismaSchemaFiles,
  findSchemaDir,
  findZodSchemas,
  findZodSchemasDir,
} from './schema';
