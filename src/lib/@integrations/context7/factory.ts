/**
 * @module lib/@integrations/context7/factory
 * @description Factory for creating Context7 infrastructure with storage wiring.
 *
 * This is the ONLY place in the context7 module that imports from the storage
 * layer, maintaining proper architectural boundaries. All other context7 files
 * receive their dependencies via injection.
 *
 * Usage:
 * - Call initializeContext7() once at application startup
 * - Use getDefaultRepository() to get the library repository
 * - The registry database is automatically configured
 */

// Storage imports - this factory is the boundary between layers
import {
  clearExpired,
  deleteLibrary,
  getDatabase,
  getLibrary,
  getLibraryByName,
  listLibraries,
  saveLibrary,
  saveSection,
  searchDocs,
} from '@/lib/@storage';

import type { LibraryStorageFunctions } from './adapters/sqlite-library-repository';
import { SqliteLibraryRepository } from './adapters/sqlite-library-repository';
import { configureRegistryDatabase } from './adapters/sqlite-registry-repository';

// Singleton instance
let defaultRepository: SqliteLibraryRepository | null = null;
let isInitialized = false;

/**
 * Create storage functions object for dependency injection.
 * Maps storage module exports to the interface expected by SqliteLibraryRepository.
 */
function createStorageFunctions(): LibraryStorageFunctions {
  return {
    getLibrary,
    getLibraryByName,
    saveLibrary,
    saveSection,
    searchDocs,
    listLibraries,
    deleteLibrary,
    clearExpired,
  };
}

/**
 * Initialize the Context7 infrastructure.
 *
 * This configures the registry database and prepares the repository factory.
 * Should be called once at application startup.
 *
 * @example
 * ```ts
 * import { initializeContext7 } from '@/lib/@integrations/context7/factory';
 *
 * // In application bootstrap
 * initializeContext7();
 * ```
 */
export function initializeContext7(): void {
  if (isInitialized) {
    return;
  }

  // Configure registry to use storage database
  configureRegistryDatabase(getDatabase);

  isInitialized = true;
}

/**
 * Create a new library repository instance.
 *
 * Automatically initializes Context7 if not already done.
 * Use getDefaultRepository() for the singleton instance.
 *
 * @returns New SqliteLibraryRepository instance
 *
 * @example
 * ```ts
 * const repo = createLibraryRepository();
 * const lib = repo.getLibrary('/vercel/next.js');
 * ```
 */
export function createLibraryRepository(): SqliteLibraryRepository {
  // Auto-initialize if needed
  if (!isInitialized) {
    initializeContext7();
  }

  return new SqliteLibraryRepository(createStorageFunctions());
}

/**
 * Get the default SQLite library repository instance.
 *
 * Uses singleton pattern for efficiency. Automatically initializes
 * Context7 infrastructure if not already done.
 *
 * @returns SQLite library repository instance
 *
 * @example
 * ```ts
 * const repo = getDefaultRepository();
 * const lib = repo.getLibrary('/vercel/next.js');
 * ```
 */
export function getDefaultRepository(): SqliteLibraryRepository {
  if (!defaultRepository) {
    defaultRepository = createLibraryRepository();
  }
  return defaultRepository;
}

/**
 * Reset the default repository and initialization state.
 * Useful for testing.
 */
export function resetContext7(): void {
  defaultRepository = null;
  isInitialized = false;
}
