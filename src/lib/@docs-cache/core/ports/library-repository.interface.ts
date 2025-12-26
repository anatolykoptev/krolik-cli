/**
 * @module lib/@docs-cache/core/ports/library-repository.interface
 * @description Repository interface for library documentation storage
 *
 * Following Clean Architecture principles, this interface defines
 * the contract for persisting and retrieving cached documentation.
 * Implementations can use SQLite, PostgreSQL, or any other storage.
 */

import type { CachedLibrary, DocSearchResult, DocSection, DocsSearchOptions } from '../../types';

/**
 * Repository interface for library documentation storage.
 *
 * Abstracts storage operations to enable:
 * - Dependency injection and testing
 * - Multiple storage implementations
 * - Clear separation between domain and infrastructure
 *
 * @example
 * ```ts
 * class SqliteLibraryRepository implements ILibraryRepository {
 *   getLibrary(id: string): CachedLibrary | null {
 *     // SQLite implementation
 *   }
 * }
 * ```
 */
export interface ILibraryRepository {
  /**
   * Get a cached library by its Context7 ID.
   *
   * @param libraryId - Context7 library ID (e.g., '/vercel/next.js')
   * @returns Cached library with metadata, or null if not found
   */
  getLibrary(libraryId: string): CachedLibrary | null;

  /**
   * Get a cached library by its display name.
   *
   * @param name - Library display name (e.g., 'next.js')
   * @returns Cached library with metadata, or null if not found
   */
  getLibraryByName(name: string): CachedLibrary | null;

  /**
   * Save or update a library entry in the cache.
   *
   * Creates a new entry if the library doesn't exist,
   * or updates the existing entry with a new expiration time.
   *
   * @param libraryId - Context7 library ID
   * @param name - Display name
   * @param version - Optional version string
   * @returns The saved library entry
   */
  saveLibrary(libraryId: string, name: string, version?: string): CachedLibrary;

  /**
   * Save a documentation section for a library.
   *
   * Sections can be from different topics and pages.
   * Duplicate sections (same library, title, page) are updated.
   *
   * @param libraryId - Context7 library ID
   * @param topic - Optional topic category
   * @param title - Section title
   * @param content - Section content (markdown)
   * @param codeSnippets - Extracted code snippets
   * @param pageNumber - Page number from API pagination
   * @returns The saved section
   */
  saveSection(
    libraryId: string,
    topic: string | undefined,
    title: string,
    content: string,
    codeSnippets: string[],
    pageNumber: number,
  ): DocSection;

  /**
   * Search cached documentation using full-text search.
   *
   * Uses FTS5 for efficient searching with fallback to LIKE.
   *
   * @param options - Search options including query and filters
   * @returns Array of search results with relevance scores
   */
  searchDocs(options: DocsSearchOptions): DocSearchResult[];

  /**
   * Get all cached libraries.
   *
   * @returns Array of all cached libraries with their metadata
   */
  listLibraries(): CachedLibrary[];

  /**
   * Delete a library and all its sections from the cache.
   *
   * @param libraryId - Context7 library ID to delete
   * @returns True if library was deleted, false if not found
   */
  deleteLibrary(libraryId: string): boolean;

  /**
   * Clear expired library caches.
   *
   * @returns Number of libraries cleared
   */
  clearExpired(): number;
}
