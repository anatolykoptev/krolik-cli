/**
 * @module lib/integrations/context7/adapters/sqlite-library-repository
 * @description SQLite-based implementation of ILibraryRepository
 *
 * This adapter implements the ILibraryRepository interface using the
 * storage/docs module for persistence. It serves as the bridge between
 * the domain layer (context7/core) and the infrastructure layer (storage).
 *
 * Following the Ports & Adapters (Hexagonal) architecture pattern.
 */

// Import storage functions - this adapter is the ONLY place that should
// import directly from storage, breaking the layer boundary intentionally
// to provide an abstraction for the rest of context7 module
import {
  clearExpired as storageClearExpired,
  deleteLibrary as storageDeleteLibrary,
  getLibrary as storageGetLibrary,
  getLibraryByName as storageGetLibraryByName,
  listLibraries as storageListLibraries,
  saveLibrary as storageSaveLibrary,
  saveSection as storageSaveSection,
  searchDocs as storageSearchDocs,
} from '@/lib/storage/docs';
import type { ILibraryRepository } from '../core/ports/library-repository.interface';
import type { CachedLibrary, DocSearchResult, DocSection, DocsSearchOptions } from '../types';

/**
 * SQLite-based implementation of ILibraryRepository.
 *
 * Uses the storage/docs module for all database operations.
 * This class follows the Repository pattern and provides a clean
 * interface for the domain layer.
 *
 * @example
 * ```ts
 * const repository = new SqliteLibraryRepository();
 * const library = repository.getLibrary('/vercel/next.js');
 * ```
 */
export class SqliteLibraryRepository implements ILibraryRepository {
  getLibrary(libraryId: string): CachedLibrary | null {
    return storageGetLibrary(libraryId);
  }

  getLibraryByName(name: string): CachedLibrary | null {
    return storageGetLibraryByName(name);
  }

  saveLibrary(libraryId: string, name: string, version?: string): CachedLibrary {
    return storageSaveLibrary(libraryId, name, version);
  }

  saveSection(
    libraryId: string,
    topic: string | undefined,
    title: string,
    content: string,
    codeSnippets: string[],
    pageNumber: number,
  ): DocSection {
    return storageSaveSection(libraryId, topic, title, content, codeSnippets, pageNumber);
  }

  searchDocs(options: DocsSearchOptions): DocSearchResult[] {
    return storageSearchDocs(options);
  }

  listLibraries(): CachedLibrary[] {
    return storageListLibraries();
  }

  deleteLibrary(libraryId: string): boolean {
    return storageDeleteLibrary(libraryId);
  }

  clearExpired(): number {
    const result = storageClearExpired();
    return result.librariesDeleted;
  }
}

// Singleton instance for convenience
let defaultRepository: SqliteLibraryRepository | null = null;

/**
 * Get the default SQLite library repository instance.
 *
 * Uses singleton pattern for efficiency.
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
    defaultRepository = new SqliteLibraryRepository();
  }
  return defaultRepository;
}

/**
 * Reset the default repository (useful for testing).
 */
export function resetDefaultRepository(): void {
  defaultRepository = null;
}
