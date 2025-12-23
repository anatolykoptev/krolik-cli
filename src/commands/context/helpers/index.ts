/**
 * @module commands/context/helpers
 * @description File discovery and directory helpers for context generation
 */

// Re-export patterns
export { DOMAIN_FILE_PATTERNS, getDomainPatterns } from "./patterns";
export type { DomainPatterns } from "./patterns";

// Re-export path finders
export { findSchemaDir, findRoutersDir } from "./paths";

// Re-export file utilities
export { findFilesMatching } from "./files";

// Re-export discovery
export { discoverFiles } from "./discovery";

// Re-export tree generation
export { generateProjectTree } from "./tree";
