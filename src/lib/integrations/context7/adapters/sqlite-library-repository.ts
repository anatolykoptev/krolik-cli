/**
 * @module lib/integrations/context7/adapters/sqlite-library-repository
 * @description SQLite-based implementation of ILibraryRepository
 *
 * This adapter implements the ILibraryRepository interface using injected
 * storage functions. It serves as the bridge between the domain layer
 * (context7/core) and the infrastructure layer (storage).
 *
 * Following the Ports & Adapters (Hexagonal) architecture pattern.
 * Storage functions are injected via constructor to avoid direct imports
 * from infrastructure layer - the factory.ts handles the wiring.
 */

import type { ILibraryRepository } from '../core/ports/library-repository.interface';
import type { CachedLibrary, DocSearchResult, DocSection, DocsSearchOptions } from '../types';

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
