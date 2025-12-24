/**
 * @module lib
 * @description Core library exports
 *
 * Flat namespace structure optimized for AI navigation:
 * - @agents - Agent marketplace utilities
 * - @ast - AST utilities (centralized ts-morph)
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

// AST utilities (centralized ts-morph)
export * from './@ast';

// Formatters (XML, JSON, Markdown, Text)
export * from './@formatters';

// Discovery (project root, schemas, routes)
export * from './@discovery';

// Patterns (lint, hardcoded, complexity) - single source of truth
export * from './@patterns';

// Context (file type detection, skip logic)
export * from './@context';

// Agents marketplace utilities
export * from './@agents';

// Markdown utilities (frontmatter parsing)
export * from './@markdown';

// Input sanitization and validation
export * from './@sanitize';

// Logger
export * from './@log';

// Shell execution
export * from './@shell';

// File system
export * from './@fs';

// Git and GitHub (using barrel export from @git)
export * from './@git';

// Timing utilities
export * from './@time';

// Documentation injection
export {
  syncClaudeMd,
  needsSync,
  getSyncStatus,
  DOCS_VERSION,
  generateKrolikDocs,
} from './@docs';
export type { SyncResult, SyncOptions } from './@docs';
