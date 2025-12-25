/**
 * @module lib/@docs
 * @description Documentation management utilities
 *
 * Provides automatic CLAUDE.md sync functionality to ensure
 * AI assistants always have up-to-date krolik documentation.
 */

export {
  getSyncStatus,
  needsSync,
  type SyncOptions,
  type SyncResult,
  syncClaudeMd,
} from './inject';
export {
  type CreateSubDocResult,
  createMissingSubDocs,
  createSubDoc,
  type DiscoveredPackage,
  discoverPackages,
  getAvailablePackages,
  getMissingSubDocs,
  SUB_DOC_CANDIDATES,
  type SubDocCandidate,
  type SubDocType,
} from './subdocs';
export {
  DOCS_VERSION,
  generateKrolikDocs,
  generateMinimalClaudeMd,
  KROLIK_SECTION_END,
  KROLIK_SECTION_START,
} from './template';
