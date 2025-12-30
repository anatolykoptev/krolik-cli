/**
 * @module lib
 * @description Core library minimal barrel exports
 *
 * ============================================================================
 * IMPORTANT: PREFER DIRECT MODULE IMPORTS
 * ============================================================================
 *
 * For better performance and clearer dependencies, import directly from modules:
 *
 * @example
 * // PREFERRED - Direct imports (tree-shakeable, explicit)
 * import { fileCache } from '@/lib/@cache';
 * import { escapeXml } from '@/lib/@format';
 * import { withSourceFile } from '@/lib/@ast';
 * import { validatePathWithinProject } from '@/lib/@security';
 * import { createBackupWithCommit } from '@/lib/@vcs';
 * import { findProjectRoot } from '@/lib/@discovery';
 * import { countTokens } from '@/lib/@tokens';
 *
 * // AVOID - Barrel imports (200+ exports, slower bundling)
 * import { fileCache, escapeXml, withSourceFile } from '@/lib';
 *
 * ============================================================================
 * MODULE REFERENCE
 * ============================================================================
 *
 * Layer 0 - Core (no deps):
 *   @core/     - logger, time, utils, shell, fs
 *
 * Layer 1 - Format/Security/Cache:
 *   @format/   - XML, JSON, Markdown, Text, Frontmatter
 *   @security/ - Input sanitization, path validation
 *   @cache/    - File caching
 *
 * Layer 2 - AST/Detectors:
 *   @ast/      - ts-morph (default), swc (fast parsing via @ast/swc)
 *   @detectors/- Lint, hardcoded, complexity detection patterns
 *   @vcs/      - Git/GitHub operations
 *   @tokens/   - LLM token counting
 *   @ranking/  - PageRank algorithms
 *
 * Layer 3 - Discovery/Storage:
 *   @discovery/- Project root, schemas, routes
 *   @storage/  - SQLite database (memory, docs)
 *
 * Layer 4 - Integrations:
 *   @integrations/context7/ - Context7 API
 *   @claude/   - CLAUDE.md generation
 *   @agents/   - Agent marketplace
 *
 * ============================================================================
 * BARREL EXPORTS (ESSENTIAL ONLY)
 * ============================================================================
 * Only the most commonly used exports are re-exported here.
 * Everything else: import from @/lib/@module directly.
 */

// ============================================================================
// AST - Core analysis utilities
// ============================================================================
export {
  type CreateProjectOptions,
  // Legacy API (deprecated, use withSourceFile instead)
  createProject,
  getProject,
  releaseProject,
  // Pool-managed API (RECOMMENDED)
  withSourceFile,
} from './@ast';
// ============================================================================
// CACHE - Most commonly used across commands
// ============================================================================
export {
  FileCache,
  type FileCacheOptions,
  type FileCacheStats,
  fileCache,
  formatCacheStats,
} from './@cache';
// ============================================================================
// DISCOVERY - Project/schema/route discovery
// ============================================================================
export {
  findPrismaSchema,
  findProjectRoot,
  findRoutersDir,
  findSchemaDir,
} from './@discovery';
// ============================================================================
// FORMAT - XML escaping (frequently used in output)
// ============================================================================
export { escapeXml, unescapeXml } from './@format';

// ============================================================================
// SECURITY - Path validation
// ============================================================================
export {
  type PathValidationResult,
  validatePathWithinProject,
} from './@security';
// ============================================================================
// VCS - Git backup operations
// ============================================================================
export {
  type BackupWithCommitResult,
  createBackupWithCommit,
  isGitRepoForBackup,
} from './@vcs';

// ============================================================================
// FOR ALL OTHER EXPORTS - Import from specific modules:
// ============================================================================
//
// @agents:       import { ... } from '@/lib/@agents'
// @ast:          import { ... } from '@/lib/@ast'
// @ast/swc:      import { ... } from '@/lib/@ast/swc'
// @cache:        import { ... } from '@/lib/@cache'
// @claude:       import { ... } from '@/lib/@claude'
// @core:         import { ... } from '@/lib/@core'
// @detectors:    import { ... } from '@/lib/@detectors'
// @discovery:    import { ... } from '@/lib/@discovery'
// @format:       import { ... } from '@/lib/@format'
// @integrations: import { ... } from '@/lib/@integrations/context7'
// @ranking:      import { ... } from '@/lib/@ranking'
// @security:     import { ... } from '@/lib/@security'
// @storage:      import { ... } from '@/lib/@storage/docs'
// @tokens:       import { ... } from '@/lib/@tokens'
// @vcs:          import { ... } from '@/lib/@vcs'
