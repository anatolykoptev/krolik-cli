/**
 * @module lib/@integrations/context7/factory
 * @description Factory for creating Context7 infrastructure with storage wiring.
 *
 * This is the ONLY place in the context7 module that imports from the storage
 * layer, maintaining proper architectural boundaries. All other context7 files
 * receive their dependencies via injection.
 *
 * This file now also contains:
 * - SqliteLibraryRepository class (merged from adapters/)
 * - Registry database configuration (merged from adapters/)
 *
 * Usage:
 * - Call initializeContext7() once at application startup
 * - Use getDefaultRepository() to get the library repository
 * - The registry database is automatically configured
 */

import type { Database } from 'better-sqlite3';

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

import type {
  CachedLibrary,
  DocSearchResult,
  DocSection,
  DocsSearchOptions,
  ILibraryRepository,
} from './types';

// ============================================================================
// Registry Database Configuration (merged from adapters/sqlite-registry-repository)
// ============================================================================

/**
 * Database getter function type for dependency injection.
 */
export type DatabaseGetter = () => Database;

// Injected database getter - set via configureRegistryDatabase()
let databaseGetter: DatabaseGetter | null = null;

/**
 * Configure the database getter for the registry.
 * Must be called before using getRegistryDatabase().
 *
 * @param getter - Function that returns the database instance
 *
 * @example
 * ```ts
 * import { getDatabase } from '@/lib/@storage';
 * configureRegistryDatabase(getDatabase);
 * ```
 */
export function configureRegistryDatabase(getter: DatabaseGetter): void {
  databaseGetter = getter;
}

/**
 * Get the shared SQLite database instance.
 *
 * This function provides access to the application's shared database
 * for registry operations. Auto-initializes Context7 if not already done.
 *
 * @returns SQLite database instance
 *
 * @example
 * ```ts
 * const db = getRegistryDatabase();
 * db.exec('CREATE TABLE IF NOT EXISTS ...');
 * ```
 */
export function getRegistryDatabase(): Database {
  if (!databaseGetter) {
    // Auto-initialize Context7 infrastructure
    initializeContext7();
  }
  return databaseGetter!();
}

/**
 * Reset the database configuration (useful for testing).
 */
export function resetRegistryDatabase(): void {
  databaseGetter = null;
}

// ============================================================================
// Library Storage Functions Interface
// ============================================================================

/**
 * Storage functions interface for dependency injection.
 * This defines the contract that the storage layer must fulfill.
 */
export interface LibraryStorageFunctions {
  getLibrary: (libraryId: string) => CachedLibrary | null;
  getLibraryByName: (name: string) => CachedLibrary | null;
  saveLibrary: (libraryId: string, name: string, version?: string) => CachedLibrary;
  saveSection: (
    libraryId: string,
    topic: string | undefined,
    title: string,
    content: string,
    codeSnippets: string[],
    pageNumber: number,
  ) => DocSection;
  searchDocs: (options: DocsSearchOptions) => DocSearchResult[];
  listLibraries: () => CachedLibrary[];
  deleteLibrary: (libraryId: string) => boolean;
  clearExpired: () => { librariesDeleted: number };
}

// ============================================================================
// SqliteLibraryRepository Class (merged from adapters/sqlite-library-repository)
// ============================================================================

/**
 * SQLite-based implementation of ILibraryRepository.
 *
 * Uses injected storage functions for all database operations.
 * This class follows the Repository pattern and provides a clean
 * interface for the domain layer.
 *
 * @example
 * ```ts
 * // Via factory (recommended)
 * import { createLibraryRepository } from './factory';
 * const repository = createLibraryRepository();
 *
 * // Direct instantiation (for testing)
 * const repository = new SqliteLibraryRepository(mockStorageFunctions);
 * const library = repository.getLibrary('/vercel/next.js');
 * ```
 */
export class SqliteLibraryRepository implements ILibraryRepository {
  private readonly storage: LibraryStorageFunctions;

  constructor(storage: LibraryStorageFunctions) {
    this.storage = storage;
  }

  getLibrary(libraryId: string): CachedLibrary | null {
    return this.storage.getLibrary(libraryId);
  }

  getLibraryByName(name: string): CachedLibrary | null {
    return this.storage.getLibraryByName(name);
  }

  saveLibrary(libraryId: string, name: string, version?: string): CachedLibrary {
    return this.storage.saveLibrary(libraryId, name, version);
  }

  saveSection(
    libraryId: string,
    topic: string | undefined,
    title: string,
    content: string,
    codeSnippets: string[],
    pageNumber: number,
  ): DocSection {
    return this.storage.saveSection(libraryId, topic, title, content, codeSnippets, pageNumber);
  }

  searchDocs(options: DocsSearchOptions): DocSearchResult[] {
    return this.storage.searchDocs(options);
  }

  listLibraries(): CachedLibrary[] {
    return this.storage.listLibraries();
  }

  deleteLibrary(libraryId: string): boolean {
    return this.storage.deleteLibrary(libraryId);
  }

  clearExpired(): number {
    const result = this.storage.clearExpired();
    return result.librariesDeleted;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

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
