/**
 * @module lib/discovery
 * @description Centralized path discovery utilities
 *
 * This is the SINGLE source of truth for all path discovery.
 * All commands should import from here instead of duplicating discovery logic.
 *
 * @example
 * import { findProjectRoot, findSchemaDir, findRoutersDir } from '@/lib/discovery';
 */

// Project discovery
export {
  findProjectRoot,
  findPackageJson,
  findGitRoot,
  detectMonorepo,
  getProjectInfo,
} from './project';
export type { MonorepoInfo, ProjectInfo } from './project';

// Schema discovery (Prisma, Zod)
export {
  findSchemaDir,
  findPrismaSchema,
  findPrismaSchemaFiles,
  findZodSchemasDir,
  findZodSchemas,
  discoverSchemas,
} from './schema';
export type { SchemaInfo } from './schema';

// Route discovery (tRPC, Next.js, Express)
export {
  findRoutersDir,
  findTrpcRouters,
  findNextjsApiDir,
  findNextjsApiRoutes,
  findExpressRoutesDir,
  findExpressRoutes,
  discoverApiRoutes,
} from './routes';
export type { ApiType, ApiRoutesInfo } from './routes';
