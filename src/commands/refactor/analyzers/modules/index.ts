/**
 * @module commands/refactor/analyzers/modules
 * @description Auto-registration of all refactor analyzers
 *
 * Import this module to register all analyzers with the registry.
 * Analyzers are registered in dependency order.
 *
 * Dependency Graph:
 * ```
 * project-context (foundational)
 *       │
 *       ├───► architecture
 *       │           │
 *       │           ├───► domains
 *       │           │       │
 *       │           │       └───► recommendations
 *       │           │
 *       │           ├───► ranking
 *       │           │
 *       │           └───► migration
 *       │
 *       └───► navigation
 *
 * file-size (independent)
 * duplicates (independent)
 * reusable (independent)
 * i18n (independent)
 * api (independent, deep mode only)
 * file-system (independent)
 * dead-code (independent)
 * data-validation (independent)
 * ```
 */

import { analyzerRegistry } from '../registry';

// Import all analyzers
import { apiAnalyzer } from './api.analyzer';
import { architectureAnalyzer } from './architecture.analyzer';
import { dataValidationAnalyzer } from './data-validation.analyzer';
import { deadCodeAnalyzer } from './dead-code.analyzer';
import { domainsAnalyzer } from './domains.analyzer';
import { duplicatesAnalyzer } from './duplicates.analyzer';
import { fileSizeAnalyzer } from './file-size.analyzer';
import { fileSystemAnalyzer } from './file-system.analyzer';
import { i18nAnalyzer } from './i18n.analyzer';
import { migrationAnalyzer } from './migration.analyzer';
import { navigationAnalyzer } from './navigation.analyzer';
import { projectContextAnalyzer } from './project-context.analyzer';
import { rankingAnalyzer } from './ranking.analyzer';
import { recommendationsAnalyzer } from './recommendations.analyzer';
import { reusableAnalyzer } from './reusable.analyzer';

// ============================================================================
// ANALYZER REGISTRATION
// ============================================================================

// Phase 1: Foundational analyzers (no dependencies)
analyzerRegistry.register(projectContextAnalyzer);

// Phase 2: Independent analyzers (can run in parallel)
analyzerRegistry.register(fileSizeAnalyzer);
analyzerRegistry.register(duplicatesAnalyzer);
analyzerRegistry.register(reusableAnalyzer);
analyzerRegistry.register(i18nAnalyzer);
analyzerRegistry.register(apiAnalyzer);
analyzerRegistry.register(fileSystemAnalyzer);
analyzerRegistry.register(deadCodeAnalyzer);
analyzerRegistry.register(dataValidationAnalyzer);

// Phase 3: Dependent analyzers (require project-context)
analyzerRegistry.register(architectureAnalyzer);
analyzerRegistry.register(navigationAnalyzer);

// Phase 4: Analyzers depending on architecture
analyzerRegistry.register(domainsAnalyzer);
analyzerRegistry.register(rankingAnalyzer);
analyzerRegistry.register(migrationAnalyzer);

// Phase 5: Analyzers depending on domains
analyzerRegistry.register(recommendationsAnalyzer);

// ============================================================================
// EXPORTS
// ============================================================================

// Re-export registry for convenience
export { analyzerRegistry } from '../registry';
export { apiAnalyzer } from './api.analyzer';
export { architectureAnalyzer } from './architecture.analyzer';
export { dataValidationAnalyzer } from './data-validation.analyzer';
export { deadCodeAnalyzer } from './dead-code.analyzer';
export { domainsAnalyzer } from './domains.analyzer';
export { duplicatesAnalyzer } from './duplicates.analyzer';
export { fileSizeAnalyzer } from './file-size.analyzer';
export { fileSystemAnalyzer } from './file-system.analyzer';
export { i18nAnalyzer } from './i18n.analyzer';
export { migrationAnalyzer } from './migration.analyzer';
export { navigationAnalyzer } from './navigation.analyzer';
export { projectContextAnalyzer } from './project-context.analyzer';
export { rankingAnalyzer } from './ranking.analyzer';
export { recommendationsAnalyzer } from './recommendations.analyzer';
export { reusableAnalyzer } from './reusable.analyzer';
