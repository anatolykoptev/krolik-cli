/**
 * @module commands/fix/fixers
 * @description Auto-registers all fixers with the global registry
 *
 * To add a new fixer:
 * 1. Create a folder: fixers/my-fixer/
 * 2. Create index.ts exporting a Fixer
 * 3. Import and register here
 *
 * @example
 * ```ts
 * import { registry, allFixers } from './fixers';
 *
 * // All fixers are auto-registered
 * const fixers = registry.all();
 *
 * // Get by category
 * const lintFixers = registry.byCategory('lint');
 *
 * // Get trivial (safe to auto-apply) fixers
 * const trivial = registry.trivial();
 * ```
 */

import { registry } from '../core/registry';
import type { Fixer } from '../core/types';

// ============================================================================
// IMPORT ALL FIXERS
// ============================================================================

// Lint fixers (trivial - safe to auto-apply)
import { consoleFixer } from './console';
import { debuggerFixer } from './debugger';
import { alertFixer } from './alert';
import { unusedImportsFixer } from './unused-imports';

// Type-safety fixers (safe)
import { tsIgnoreFixer } from './ts-ignore';
import { anyTypeFixer } from './any-type';
import { equalityFixer } from './equality';
import { evalFixer } from './eval';

// Hardcoded value fixers (safe)
import { magicNumbersFixer } from './magic-numbers';
import { hardcodedUrlsFixer } from './hardcoded-urls';

// Complexity fixers (risky - require review)
import { complexityFixer } from './complexity';
import { longFunctionsFixer } from './long-functions';

// Architecture fixers (risky)
import { srpFixer } from './srp';
import { refineFixer } from './refine';

// ============================================================================
// FIXER LIST
// ============================================================================

/**
 * All available fixers, organized by difficulty
 */
export const allFixers: Fixer[] = [
  // Trivial - always safe to auto-apply
  consoleFixer,
  debuggerFixer,
  alertFixer,

  // Safe - unlikely to break anything
  tsIgnoreFixer,
  anyTypeFixer,
  equalityFixer,
  evalFixer,
  unusedImportsFixer,
  magicNumbersFixer,
  hardcodedUrlsFixer,

  // Risky - may require manual review
  complexityFixer,
  longFunctionsFixer,
  srpFixer,
  refineFixer,
];

/**
 * Fixers grouped by category
 */
export const fixersByCategory = {
  lint: [consoleFixer, debuggerFixer, alertFixer, unusedImportsFixer],
  'type-safety': [tsIgnoreFixer, anyTypeFixer, equalityFixer, evalFixer],
  hardcoded: [magicNumbersFixer, hardcodedUrlsFixer],
  complexity: [complexityFixer, longFunctionsFixer],
  srp: [srpFixer],
  refine: [refineFixer],
};

/**
 * Fixers grouped by difficulty
 */
export const fixersByDifficulty = {
  trivial: [consoleFixer, debuggerFixer, alertFixer],
  safe: [tsIgnoreFixer, anyTypeFixer, equalityFixer, evalFixer, unusedImportsFixer, magicNumbersFixer, hardcodedUrlsFixer],
  risky: [complexityFixer, longFunctionsFixer, srpFixer, refineFixer],
};

// ============================================================================
// AUTO-REGISTRATION
// ============================================================================

/**
 * Register all fixers with the global registry
 */
function registerAllFixers(): void {
  registry.registerAll(allFixers);
}

// Auto-register on import
registerAllFixers();

// ============================================================================
// EXPORTS
// ============================================================================

// Re-export registry for convenience
export { registry };

// Export individual fixers
export { consoleFixer } from './console';
export { debuggerFixer } from './debugger';
export { alertFixer } from './alert';
export { tsIgnoreFixer } from './ts-ignore';
export { anyTypeFixer } from './any-type';
export { equalityFixer } from './equality';
export { evalFixer } from './eval';
export { unusedImportsFixer } from './unused-imports';
export { magicNumbersFixer } from './magic-numbers';
export { hardcodedUrlsFixer } from './hardcoded-urls';
export { complexityFixer } from './complexity';
export { longFunctionsFixer } from './long-functions';
export { srpFixer } from './srp';
export { refineFixer } from './refine';

// Utility functions
export function getFixerById(id: string): Fixer | undefined {
  return registry.get(id);
}

export function getFixerIds(): string[] {
  return registry.ids();
}

export function getTrivialFixers(): Fixer[] {
  return registry.trivial();
}

export function getSafeFixers(): Fixer[] {
  return registry.byDifficulty('trivial').concat(registry.byDifficulty('safe'));
}
