/**
 * @module lib/@docs/sections
 * @description Section Registry system for CLAUDE.md generation
 *
 * Provides a pluggable architecture for generating dynamic content
 * in CLAUDE.md documentation files.
 *
 * @example
 * ```typescript
 * import {
 *   registerSection,
 *   getOrderedSections,
 *   createSectionContext,
 *   SectionPriority,
 *   type SectionProvider,
 * } from '@/lib/@docs/sections';
 *
 * // Register a custom section
 * registerSection({
 *   id: 'custom-notes',
 *   name: 'Custom Notes',
 *   priority: SectionPriority.CUSTOM,
 *   render: (ctx) => `## Notes\n\nProject: ${ctx.projectRoot}`
 * });
 *
 * // Create context and render all sections
 * const ctx = createSectionContext({
 *   projectRoot: '/my/project',
 *   tools: getAllTools(),
 *   subDocs: findSubDocs('/my/project'),
 *   version: TEMPLATE_VERSION,
 * });
 *
 * const sections = getOrderedSections();
 * const content = sections
 *   .filter(s => !s.shouldRender || s.shouldRender(ctx))
 *   .map(s => {
 *     const result = s.render(ctx);
 *     return typeof result === 'string' ? result : result.content;
 *   })
 *   .join('\n\n');
 * ```
 */

// Context factory
export type { CreateSectionContextOptions } from './context';
export {
  cloneContext,
  createSectionContext,
  createTestContext,
  getCacheValue,
  setCacheValue,
} from './context';
// Executor functions
export {
  DependencyGraph,
  executeSection,
  executeSections,
  getActiveSectionIds,
  orderSections,
  validateSectionDependencies,
} from './executor';
// Providers
export {
  BUILTIN_PROVIDERS,
  contextCacheProvider,
  registerBuiltinSections,
  sessionStartupProvider,
  subDocsProvider,
  toolsTableProvider,
} from './providers';
// Registry functions
export {
  clearSections,
  disableSection,
  enableSection,
  getAllSections,
  getEnabledSections,
  getOrderedSections,
  getSection,
  getSectionCount,
  getSectionIds,
  hasSection,
  isSectionDisabled,
  registerSection,
  registry,
  unregisterSection,
} from './registry';
// Types
export type {
  SectionContext,
  SectionId,
  SectionPriorityValue,
  SectionProvider,
  SectionRegistrationOptions,
  SectionRegistry,
  SectionRenderContext,
  SectionResult,
} from './types';
export { SectionPriority } from './types';
