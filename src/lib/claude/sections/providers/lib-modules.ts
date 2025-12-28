/**
 * @module lib/claude/sections/providers/lib-modules
 * @description Lib modules section provider
 *
 * Scans lib/@* modules and formats them as AI-friendly documentation.
 * Returns skip: true if no modules are found.
 */

import type { ModuleScanResult } from '@/lib/@discovery';
import { formatModulesMarkdown, scanLibModules } from '@/lib/@discovery';
import type { SectionContext, SectionProvider, SectionResult } from '../types';
import { SectionPriority } from '../types';

/** Cache key for storing module scan result */
const CACHE_KEY = 'lib-modules-scan-result';

/**
 * Scan lib modules with caching
 *
 * @param ctx - Section context
 * @returns Module scan result
 */
function scanModulesWithCache(ctx: SectionContext): ModuleScanResult {
  // Check cache first
  const cached = ctx.cache.get(CACHE_KEY) as ModuleScanResult | undefined;
  if (cached) {
    return cached;
  }

  // Scan modules
  const result = scanLibModules(ctx.projectRoot);

  // Cache for reuse by other sections
  ctx.cache.set(CACHE_KEY, result);

  return result;
}

/**
 * Lib modules section provider
 *
 * Priority 350 - renders after sub-docs, before tools
 */
export const libModulesProvider: SectionProvider = {
  id: 'lib-modules',
  name: 'Lib Modules',
  priority: SectionPriority.LIB_MODULES,

  render(ctx: SectionContext): SectionResult {
    const result = scanModulesWithCache(ctx);

    // Skip if no modules found
    if (result.modules.length === 0) {
      return {
        content: '> No reusable lib modules found.',
        skip: true,
      };
    }

    const content = formatModulesMarkdown(result);

    return {
      content,
      metadata: {
        moduleCount: result.modules.length,
        exportCount: result.totalExports,
        durationMs: result.durationMs,
      },
    };
  },
};
