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

import { alertFixer } from './alert';
import { anyTypeFixer } from './any-type';
// Complexity fixers (risky - require review)
import { complexityFixer } from './complexity';
// Lint fixers (trivial - safe to auto-apply)
import { consoleFixer } from './console';
import { debuggerFixer } from './debugger';
import { equalityFixer } from './equality';
import { evalFixer } from './eval';
import { hardcodedUrlsFixer } from './hardcoded-urls';
import { longFunctionsFixer } from './long-functions';
// Hardcoded value fixers (safe)
import { magicNumbersFixer } from './magic-numbers';
import { refineFixer } from './refine';
// Architecture fixers (risky)
import { srpFixer } from './srp';
// Type-safety fixers (safe)
import { tsIgnoreFixer } from './ts-ignore';
import { unusedImportsFixer } from './unused-imports';

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
  safe: [
    tsIgnoreFixer,
    anyTypeFixer,
    equalityFixer,
    evalFixer,
    unusedImportsFixer,
    magicNumbersFixer,
    hardcodedUrlsFixer,
  ],
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

export { alertFixer } from './alert';
export { anyTypeFixer } from './any-type';
export { complexityFixer } from './complexity';
// Export individual fixers
export { consoleFixer } from './console';
export { debuggerFixer } from './debugger';
export { equalityFixer } from './equality';
export { evalFixer } from './eval';
export { hardcodedUrlsFixer } from './hardcoded-urls';
export { longFunctionsFixer } from './long-functions';
export { magicNumbersFixer } from './magic-numbers';
export { refineFixer } from './refine';
export { srpFixer } from './srp';
export { tsIgnoreFixer } from './ts-ignore';
export { unusedImportsFixer } from './unused-imports';

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
