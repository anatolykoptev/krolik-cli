/**
 * @module lib/@claude/sections/providers
 * @description Builtin section providers for CLAUDE.md generation
 *
 * Exports all builtin providers and a function to register them
 * with the section registry.
 */

import { registry } from '../registry';
import type { SectionRegistry } from '../types';
import { contextCacheProvider } from './context-cache';
import { libModulesProvider } from './lib-modules';
import { roadmapProvider } from './roadmap';
import { sessionStartupProvider } from './session-startup';
import { subDocsProvider } from './sub-docs';

// Export all providers (including disabled ones for external use)
export { contextCacheProvider } from './context-cache';
export { libModulesProvider } from './lib-modules';
export { recentMemoriesProvider } from './recent-memories';
export { roadmapProvider } from './roadmap';
export { sessionStartupProvider } from './session-startup';
export { subDocsProvider } from './sub-docs';
export { toolsTableProvider } from './tools-table';

/**
 * All builtin section providers
 */
export const BUILTIN_PROVIDERS = [
  sessionStartupProvider,
  // recentMemoriesProvider, // Disabled: Claude calls krolik_mem_recent directly via MCP
  contextCacheProvider,
  roadmapProvider,
  subDocsProvider,
  libModulesProvider,
  // toolsTableProvider, // Disabled: Tools already visible via MCP (descriptions, params)
] as const;

/**
 * Register all builtin section providers with a custom registry
 *
 * @param customRegistry - Section registry to register providers with
 */
export function registerBuiltinSections(customRegistry: SectionRegistry = registry): void {
  for (const provider of BUILTIN_PROVIDERS) {
    customRegistry.register(provider);
  }
}
