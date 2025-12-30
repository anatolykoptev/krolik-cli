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
// Refactor integration fixers (safe)
import { backwardsCompatFixer } from './backwards-compat';
// Complexity fixers (risky - require review)
import { complexityFixer } from './complexity';
// Lint fixers (trivial - safe to auto-apply)
import { consoleFixer } from './console';
import { debuggerFixer } from './debugger';
import { duplicateFixer } from './duplicate';
import { equalityFixer } from './equality';
import { evalFixer } from './eval';
import { hardcodedUrlsFixer } from './hardcoded-urls';
// I18n fixer (risky - requires manual translation file updates)
import { i18nFixer } from './i18n';
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
  duplicateFixer, // Refactor integration: merge duplicate functions
  backwardsCompatFixer, // Cleanup deprecated shim files

  i18nFixer, // I18n: extract hardcoded text to translation keys

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
  lint: [consoleFixer, debuggerFixer, alertFixer, unusedImportsFixer, duplicateFixer],
  'type-safety': [tsIgnoreFixer, anyTypeFixer, equalityFixer, evalFixer],
  hardcoded: [magicNumbersFixer, hardcodedUrlsFixer],
  complexity: [complexityFixer, longFunctionsFixer],
  srp: [srpFixer],
  refine: [refineFixer],
  i18n: [i18nFixer],
  'backwards-compat': [backwardsCompatFixer],
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
    duplicateFixer,
    backwardsCompatFixer,
    i18nFixer, // I18n: extract hardcoded text to translation keys
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
export { backwardsCompatFixer } from './backwards-compat';
export { complexityFixer } from './complexity';
// Export individual fixers
export { consoleFixer } from './console';
export { debuggerFixer } from './debugger';
export { duplicateFixer } from './duplicate';
export { equalityFixer } from './equality';
export { evalFixer } from './eval';
export { hardcodedUrlsFixer } from './hardcoded-urls';
export { i18nFixer } from './i18n';
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
