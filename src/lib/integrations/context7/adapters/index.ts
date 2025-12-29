/**
 * @module lib/integrations/context7/adapters
 * @description Infrastructure adapters for the Context7 integration
 *
 * This module contains implementations of the port interfaces defined
 * in the core module. Adapters bridge between the domain layer and
 * external infrastructure (database, HTTP clients, etc.).
 *
 * Note: getDefaultRepository and resetDefaultRepository are now in factory.ts
 * to maintain proper layer separation.
 */

// Re-export factory functions for convenience
export {
  createLibraryRepository,
  getDefaultRepository,
  initializeContext7,
  resetContext7,
} from '../factory';
export {
  type LibraryStorageFunctions,
  SqliteLibraryRepository,
} from './sqlite-library-repository';
export {
  configureRegistryDatabase,
  type DatabaseGetter,
  getRegistryDatabase,
  resetRegistryDatabase,
} from './sqlite-registry-repository';
