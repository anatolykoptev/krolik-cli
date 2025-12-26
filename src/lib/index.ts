/**
 * @module lib
 * @description Core library exports
 *
 * Flat namespace structure optimized for AI navigation:
 * - @agents - Agent marketplace utilities
 * - @ast - AST utilities (centralized ts-morph)
 * - @cache - Caching utilities (file cache)
 * - @context - File type detection, skip logic
 * - @discovery - Project root, schemas, routes
 * - @docs - CLAUDE.md injection and sync
 * - @docs-cache - Context7 API documentation cache
 * - @formatters - XML, JSON, Markdown, Text
 * - @fs - File system operations
 * - @git - Git and GitHub operationsLf
 * - @log - Logging utilities
 * - @markdown - Markdown utilities (frontmatter)
 * - @memory - SQLite-based persistent memory
 * - @patterns - Lint, hardcoded, complexity patterns
 * - @sanitize - Input sanitization and validation
 * - @shell - Shell execution
 * - @time - Timing utilities
 */

// Agents marketplace utilities
export * from './@agents';
// AST utilities (centralized ts-morph)
export * from './@ast';
// Cache utilities (file cache)
export * from './@cache';
// Context (file type detection, skip logic)
export * from './@context';
// Discovery (project root, schemas, routes)
export * from './@discovery';
export type {
  CreateSubDocResult,
  DiscoveredPackage,
  SubDocCandidate,
  SubDocType,
  SyncOptions,
  SyncResult,
} from './@docs';
// Documentation injection
export {
  createMissingSubDocs,
  createSubDoc,
  DOCS_VERSION,
  discoverPackages,
  generateKrolikDocs,
  getAvailablePackages,
  getMissingSubDocs,
  getSyncStatus,
  needsSync,
  SUB_DOC_CANDIDATES,
  syncClaudeMd,
} from './@docs';
export type {
  CachedLibrary,
  DetectedLibrary,
  DocSection,
  FetchDocsResult,
  LibraryMapping,
  ResolutionResult,
} from './@docs-cache';
// Context7 documentation cache
export {
  detectLibraries,
  fetchAndCacheDocs,
  fetchLibraryWithTopics,
  getLibraryByName,
  getSectionsByLibrary,
  getSuggestions,
  getTopicsForLibrary,
  hasContext7ApiKey,
  listLibraries,
  resolveLibraryId,
  searchDocs,
} from './@docs-cache';
// Formatters (XML, JSON, Markdown, Text)
export * from './@formatters';
// File system
export * from './@fs';
// Git and GitHub (using barrel export from @git)
export * from './@git';
// Logger
export * from './@log';
// Markdown utilities (frontmatter parsing)
export * from './@markdown';
// Patterns (lint, hardcoded, complexity) - single source of truth
export * from './@patterns';
// Input sanitization and validation
export * from './@sanitize';
// Shell execution
export * from './@shell';
// Timing utilities
export * from './@time';
