/**
 * @module lib/@context
 * @description Project context detection and cached context access
 *
 * Provides:
 * - Project profile detection
 * - Cached Prisma schema access
 * - Cached tRPC routes access
 */

// Project profile
export {
  clearProfileCache,
  detectProjectProfile,
  getCachedProfile,
  type ProjectProfile,
} from './project-profile';
// tRPC routes (cached with mtime invalidation)
export {
  clearRoutesCache,
  findRoutesLocation,
  getRouterNames,
  getTrpcRoutes,
  hasTrpcRoutes,
} from './routes';
// Prisma schema (cached with mtime invalidation)
export {
  clearSchemaCache,
  findSchemaLocation,
  getPrismaSchema,
  hasPrismaSchema,
} from './schema';
