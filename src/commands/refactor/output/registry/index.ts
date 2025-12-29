/**
 * @module commands/refactor/output/registry
 * @description Section Registry for refactor output formatting
 *
 * Provides a centralized registration point for all output sections:
 * - Order-aware rendering
 * - Dependency checking (required analyzers)
 * - Conditional visibility (showWhen)
 * - Debug comments for skipped sections
 *
 * @example
 * ```ts
 * import { sectionRegistry, type Section } from './registry';
 *
 * // Register a section
 * sectionRegistry.register(mySection);
 *
 * // Format all sections
 * const lines = sectionRegistry.formatAll(ctx);
 *
 * // Join to XML
 * const xml = lines.join('\n');
 * ```
 */

// Registry
export { SectionRegistry, sectionRegistry } from './registry';
// Types
export type {
  OutputLevel,
  Section,
  SectionContext,
  SectionMetadata,
  ShowWhen,
} from './types';
