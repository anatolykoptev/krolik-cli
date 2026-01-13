/**
 * @module commands/context/modes
 * @description Context mode handlers
 *
 * Modes:
 * - minimal: Ultra-compact (~1500 tokens) - summary, git, memory only
 * - quick: Compact (~3500 tokens) - architecture, git, tree, schema, routes
 * - deep: Heavy analysis - imports, types, env, contracts only
 * - full: Everything (quick + deep)
 */

export { buildDeepSections } from './deep';
export { buildMinimalSections } from './minimal';
export { buildQuickSections } from './quick';
