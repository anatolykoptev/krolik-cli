/**
 * @module commands/context/helpers
 * @description File discovery and directory helpers for context generation
 */

export type { ArchitecturePatterns, DetectedPattern } from './architecture';
// Re-export architecture patterns
export { collectArchitecturePatterns } from './architecture';

// Re-export discovery
export { discoverFiles } from './discovery';
// Re-export file utilities
export { findFilesMatching } from './files';
// Re-export lib modules collection
export { collectLibModules } from './lib-modules';
// Re-export path finders
export { findRoutersDir, findSchemaDir } from './paths';
export type { DomainPatterns } from './patterns';
// Re-export patterns
export { DOMAIN_FILE_PATTERNS, getDomainPatterns } from './patterns';
// Re-export tree generation
export { generateProjectTree } from './tree';
