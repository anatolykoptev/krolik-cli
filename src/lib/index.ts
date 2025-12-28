/**
 * @module lib
 * @description Core library exports
 *
 * Module structure (layered architecture):
 *
 * Layer 1 - Core (no deps):
 * - core/ (logger, time, utils, shell, fs)
 *
 * Layer 2 - Format/Security/Cache:
 * - format/ - XML, JSON, Markdown, Text, Frontmatter
 * - security/ - Input sanitization
 * - cache/ - File caching
 *
 * Layer 3 - Parsing/Patterns:
 * - parsing/swc/ - SWC AST parser
 * - @patterns/ - Lint, hardcoded, complexity patterns
 * - @git/ - Git and GitHub operations
 *
 * Layer 4 - Discovery/Storage:
 * - discovery/ - Project root, schemas, routes
 * - storage/ - SQLite database (memory, docs)
 *
 * Layer 5 - Integrations/Analysis/Claude:
 * - integrations/context7/ - Context7 API
 * - analysis/ - AST source analysis
 * - claude/ - CLAUDE.md generation and sync
 * - modules/ - Reusable code detection
 *
 * Active modules (prefixed with @):
 * - @ast - ts-morph utilities
 * - @agents - Agent marketplace
 * - @ranking - PageRank algorithms for code ranking
 */

// Agents marketplace utilities
export * from './@agents';
// AST utilities (centralized ts-morph)
export * from './@ast';
// Git and GitHub (using barrel export from @git)
export * from './@git';
// Patterns (lint, hardcoded, complexity) - single source of truth
export * from './@patterns';
// Context (file type detection, skip logic) - migrated to @patterns/file-context
export * from './@patterns/file-context';
// PageRank ranking algorithms
export * from './@ranking';
// Token counting and budget fitting for LLM context management
export * from './@tokens';
// Cache utilities (file cache)
export * from './cache';
export type {
  CreateSubDocResult,
  DiscoveredPackage,
  SubDocCandidate,
  SubDocType,
  SyncOptions,
  SyncResult,
} from './claude';
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
} from './claude';
// Core utilities (Layer 0) - logger, time, utils, shell, fs
export * from './core';
// Discovery (project root, schemas, routes, architecture)
export * from './discovery';
// Formatting utilities (XML, JSON, Markdown, Text, Frontmatter, Constants)
// Includes XML minification and output optimization utilities
export * from './format';
export type {
  CachedLibrary,
  DetectedLibrary,
  DocSection,
  FetchDocsResult,
  LibraryMapping,
  ResolutionResult,
} from './integrations/context7';
// Context7 documentation cache
export {
  detectLibraries,
  fetchAndCacheDocs,
  fetchLibraryWithTopics,
  getSuggestions,
  getTopicsForLibrary,
  hasContext7ApiKey,
  resolveLibraryId,
} from './integrations/context7';
// Input sanitization and validation
export * from './security';
// Storage - docs
export {
  getLibraryByName,
  getSectionsByLibrary,
  listLibraries,
  searchDocs,
} from './storage/docs';
