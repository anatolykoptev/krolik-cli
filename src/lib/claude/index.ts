/**
 * @module lib/claude
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
// Re-export section system types
export type {
  SectionContext,
  SectionId,
  SectionPriorityValue,
  SectionProvider,
  SectionRegistrationOptions,
  SectionRegistry,
  SectionRenderContext,
  SectionResult,
} from './sections';
export { SectionPriority } from './sections';
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
  generateKrolikDocsAsync,
  generateMinimalClaudeMd,
  generateMinimalClaudeMdAsync,
  KROLIK_SECTION_END,
  KROLIK_SECTION_START,
  registerSection,
  TEMPLATE_VERSION,
} from './template';
