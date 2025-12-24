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
 * - @formatters - XML, JSON, Markdown, Text
 * - @fs - File system operations
 * - @git - Git and GitHub operations
 * - @log - Logging utilities
 * - @markdown - Markdown utilities (frontmatter)
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
export type { SyncOptions, SyncResult } from './@docs';
// Documentation injection
export {
  DOCS_VERSION,
  generateKrolikDocs,
  getSyncStatus,
  needsSync,
  syncClaudeMd,
} from './@docs';
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
