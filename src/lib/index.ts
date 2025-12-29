/**
 * @module lib
 * @description Core library exports
 *
 * Module structure (layered architecture):
 *
 * Layer 1 - Core (no deps):
 * - @core/ (logger, time, utils, shell, fs)
 *
 * Layer 2 - Format/Security/Cache:
 * - @format/ - XML, JSON, Markdown, Text, Frontmatter
 * - @security/ - Input sanitization
 * - @cache/ - File caching
 *
 * Layer 3 - AST/Detectors:
 * - @ast/swc/ - SWC AST parser (fast)
 * - @ast/ts-morph/ - ts-morph AST (full types)
 * - @detectors/ - Lint, hardcoded, complexity detectors
 * - @git/ - Git and GitHub operations
 *
 * Layer 4 - Discovery/Storage:
 * - @discovery/ - Project root, schemas, routes
 * - @storage/ - SQLite database (memory, docs)
 *
 * Layer 5 - Integrations/Analysis/Claude:
 * - @integrations/context7/ - Context7 API
 * - @claude/ - CLAUDE.md generation and sync
 * - @discovery/reusables/ - Reusable code detection
 *
 * Active modules (all prefixed with @):
 * - @ast - ts-morph utilities
 * - @agents - Agent marketplace
 * - @ranking - PageRank algorithms for code ranking
 * - @tokens - Token counting for LLM context
 */

// Agents marketplace utilities
export * from './@agents';
// AST utilities (centralized ts-morph)
export * from './@ast';
// Cache utilities (file cache)
export * from './@cache';
// Claude documentation injection
export type {
  CreateSubDocResult,
  DiscoveredPackage,
  SubDocCandidate,
  SubDocType,
  SyncOptions,
  SyncResult,
} from './@claude';
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
} from './@claude';
// Core utilities (Layer 0) - logger, time, utils, shell, fs
export * from './@core';
// Detectors (lint, hardcoded, complexity) - single source of truth
export * from './@detectors';
// Context (file type detection, skip logic)
export * from './@detectors/file-context';
// Discovery (project root, schemas, routes, architecture)
export * from './@discovery';
// Formatting utilities (XML, JSON, Markdown, Text, Frontmatter, Constants)
export * from './@format';
// Git and GitHub (using barrel export from @git)
export * from './@git';
// Context7 documentation cache
export type {
  CachedLibrary,
  DetectedLibrary,
  DocSection,
  FetchDocsResult,
  LibraryMapping,
  ResolutionResult,
} from './@integrations/context7';
export {
  detectLibraries,
  fetchAndCacheDocs,
  fetchLibraryWithTopics,
  getSuggestions,
  getTopicsForLibrary,
  hasContext7ApiKey,
  resolveLibraryId,
} from './@integrations/context7';
// PageRank ranking algorithms
export * from './@ranking';
// Input sanitization and validation
export * from './@security';
// Storage - docs
export {
  getLibraryByName,
  getSectionsByLibrary,
  listLibraries,
  searchDocs,
} from './@storage/docs';
// Token counting and budget fitting for LLM context management
export * from './@tokens';
