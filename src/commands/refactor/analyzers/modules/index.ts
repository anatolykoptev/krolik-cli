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
 * ```
 */

import { analyzerRegistry } from '../registry';

// Import all analyzers
import { architectureAnalyzer } from './architecture.analyzer';
import { domainsAnalyzer } from './domains.analyzer';
import { duplicatesAnalyzer } from './duplicates.analyzer';
import { fileSizeAnalyzer } from './file-size.analyzer';
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
export { architectureAnalyzer } from './architecture.analyzer';
export { domainsAnalyzer } from './domains.analyzer';
export { duplicatesAnalyzer } from './duplicates.analyzer';
export { fileSizeAnalyzer } from './file-size.analyzer';
export { migrationAnalyzer } from './migration.analyzer';
export { navigationAnalyzer } from './navigation.analyzer';
export { projectContextAnalyzer } from './project-context.analyzer';
export { rankingAnalyzer } from './ranking.analyzer';
export { recommendationsAnalyzer } from './recommendations.analyzer';
export { reusableAnalyzer } from './reusable.analyzer';
