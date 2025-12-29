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
import { recentMemoriesProvider } from './recent-memories';
import { sessionStartupProvider } from './session-startup';
import { subDocsProvider } from './sub-docs';
import { toolsTableProvider } from './tools-table';

// Export all providers
export { contextCacheProvider } from './context-cache';
export { libModulesProvider } from './lib-modules';
export { recentMemoriesProvider } from './recent-memories';
export { sessionStartupProvider } from './session-startup';
export { subDocsProvider } from './sub-docs';
export { toolsTableProvider } from './tools-table';

/**
 * All builtin section providers
 */
export const BUILTIN_PROVIDERS = [
  sessionStartupProvider,
  recentMemoriesProvider,
  contextCacheProvider,
  subDocsProvider,
  libModulesProvider,
  toolsTableProvider,
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
