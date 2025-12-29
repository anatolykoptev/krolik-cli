/**
 * @module commands/refactor/output/sections
 * @description Registry-based section definitions for AI-native XML output
 *
 * Each section is a registry-compatible object with:
 * - metadata (id, name, order, requires, showWhen)
 * - shouldRender() - conditional visibility
 * - render() - formats XML output
 *
 * Section Order:
 * ```
 * 1   stats             (summary statistics)
 * 5   project-context   (foundational context)
 * 40  architecture      (health score, violations)
 * 45  ranking           (hotspots, safe order)
 * 50  domains           (domain classification)
 * 55  ai-config         (namespace configuration)
 * 60  recommendations   (prioritized recommendations)
 * 70  migration         (enhanced migration plan)
 * 80  duplicates        (duplicate functions/types)
 * 85  reusable          (reusable modules)
 * 90  file-size         (oversized files)
 * 95  navigation        (AI navigation hints)
 * ```
 */

// Section definitions (registry-based)
export { aiConfigSection } from './ai-config.section';
export { architectureSection } from './architecture.section';
export { domainsSection } from './domains.section';
export { duplicatesSection } from './duplicates.section';
export { fileSizeSection } from './file-size.section';
export { migrationSection } from './migration.section';
// Auto-registration module (imports this to register all sections)
export * from './modules';
export { navigationSection } from './navigation.section';
export { projectContextSection } from './project-context.section';
export { rankingSection } from './ranking.section';
export { recommendationsSection } from './recommendations.section';
export { reusableSection } from './reusable.section';
export { statsSection } from './stats.section';
