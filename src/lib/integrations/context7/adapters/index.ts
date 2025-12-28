/**
 * @module lib/integrations/context7/adapters
 * @description Infrastructure adapters for the Context7 integration
 *
 * This module contains implementations of the port interfaces defined
 * in the core module. Adapters bridge between the domain layer and
 * external infrastructure (database, HTTP clients, etc.).
 */

export {
  getDefaultRepository,
  resetDefaultRepository,
  SqliteLibraryRepository,
} from './sqlite-library-repository';

export { getRegistryDatabase } from './sqlite-registry-repository';
