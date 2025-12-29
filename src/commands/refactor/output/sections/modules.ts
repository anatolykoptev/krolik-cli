/**
 * @module commands/refactor/output/sections/modules
 * @description Auto-registration of all refactor output sections
 *
 * Import this module to register all sections with the registry.
 * Sections are sorted by their metadata.order property during rendering.
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
 * 65  i18n              (internationalization issues)
 * 68  api               (API analysis)
 * 70  migration         (enhanced migration plan)
 * 80  duplicates        (duplicate functions/types)
 * 85  reusable          (reusable modules)
 * 90  file-size         (oversized files)
 * 95  navigation        (AI navigation hints)
 * ```
 */

import { sectionRegistry } from '../registry';

// Import all sections
import { aiConfigSection } from './ai-config.section';
import { apiSection } from './api.section';
import { architectureSection } from './architecture.section';
import { domainsSection } from './domains.section';
import { duplicatesSection } from './duplicates.section';
import { fileSizeSection } from './file-size.section';
import { i18nSection } from './i18n.section';
import { migrationSection } from './migration.section';
import { navigationSection } from './navigation.section';
import { projectContextSection } from './project-context.section';
import { rankingSection } from './ranking.section';
import { recommendationsSection } from './recommendations.section';
import { reusableSection } from './reusable.section';
import { statsSection } from './stats.section';

// ============================================================================
// SECTION REGISTRATION
// ============================================================================

// Register all sections (order doesn't matter here, sorted by metadata.order)
sectionRegistry.register(statsSection);
sectionRegistry.register(projectContextSection);
sectionRegistry.register(architectureSection);
sectionRegistry.register(rankingSection);
sectionRegistry.register(domainsSection);
sectionRegistry.register(aiConfigSection);
sectionRegistry.register(recommendationsSection);
sectionRegistry.register(i18nSection);
sectionRegistry.register(apiSection);
sectionRegistry.register(migrationSection);
sectionRegistry.register(duplicatesSection);
sectionRegistry.register(reusableSection);
sectionRegistry.register(fileSizeSection);
sectionRegistry.register(navigationSection);

// ============================================================================
// EXPORTS
// ============================================================================

// Re-export registry for convenience
export { sectionRegistry } from '../registry';
export { aiConfigSection } from './ai-config.section';
export { apiSection } from './api.section';
export { architectureSection } from './architecture.section';
export { domainsSection } from './domains.section';
export { duplicatesSection } from './duplicates.section';
export { fileSizeSection } from './file-size.section';
export { i18nSection } from './i18n.section';
export { migrationSection } from './migration.section';
export { navigationSection } from './navigation.section';
export { projectContextSection } from './project-context.section';
export { rankingSection } from './ranking.section';
export { recommendationsSection } from './recommendations.section';
export { reusableSection } from './reusable.section';
export { statsSection } from './stats.section';
