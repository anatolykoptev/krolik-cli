/**
 * @module lib/@docs
 * @description Documentation management utilities
 *
 * Provides automatic CLAUDE.md sync functionality to ensure
 * AI assistants always have up-to-date krolik documentation.
 */

export {
  syncClaudeMd,
  needsSync,
  getSyncStatus,
  type SyncResult,
  type SyncOptions,
} from './inject';

export {
  DOCS_VERSION,
  KROLIK_SECTION_START,
  KROLIK_SECTION_END,
  generateKrolikDocs,
  generateMinimalClaudeMd,
} from './template';
