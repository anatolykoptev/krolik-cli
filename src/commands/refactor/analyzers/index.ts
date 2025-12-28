/**
 * @module commands/refactor/analyzers
 * @description Analyzers for refactor command
 *
 * Analysis capabilities:
 * - Duplicate function detection (AST-based)
 * - Duplicate type/interface detection (structural comparison)
 * - Structure analysis (namespace organization)
 * - Project context detection
 * - Architecture health analysis
 * - Domain classification
 * - Standards compliance
 * - AI navigation hints
 * - Recommendations generation
 *
 * Directory structure:
 * - core/          - Core analysis (duplicates, type-duplicates, swc-parser)
 * - architecture/  - Architecture analysis (health, domains, structure, namespace)
 * - context/       - Project context (detection, standards, navigation)
 * - metrics/       - Metrics & scoring (file-size, reusable, recommendations)
 * - shared/        - Shared utilities (helpers)
 */

// ============================================================================
// CORE ANALYZERS (from core/)
// ============================================================================

export {
  extractFunctions,
  type FindDuplicatesOptions,
  findDuplicates,
  quickScanDuplicates,
} from './core/duplicates';
export { extractFunctionsSwc, type SwcFunctionInfo } from './core/swc-parser';
export {
  extractTypes,
  type FindTypeDuplicatesOptions,
  findTypeDuplicates,
  quickScanTypeDuplicates,
  type TypeDuplicateInfo,
  type TypeSignature,
} from './core/type-duplicates';

// ============================================================================
// ARCHITECTURE ANALYSIS (from architecture/)
// ============================================================================

export {
  analyzeArchHealth,
  analyzeDependencies,
  findCircularDeps,
  getDirectoriesWithCategories,
} from './architecture/architecture';
export {
  classifyDomains,
  getLowCoherenceDomains,
  getTotalMisplacedFiles,
  groupMisplacedByTarget,
} from './architecture/domains';
export type {
  NamespaceAnalysisResult,
  NamespaceImportUpdate,
  NamespaceMigrationMove,
  NamespaceMigrationPlan,
} from './architecture/namespace';
export {
  analyzeNamespaceDirectory,
  analyzeNamespaceStructure,
  calculateNamespaceScore,
  detectNamespaceCategory,
  findLibDir,
  generateNamespaceMigrationPlan,
} from './architecture/namespace';
export { analyzeStructure, visualizeStructure } from './architecture/structure';

// ============================================================================
// PROJECT CONTEXT (from context/)
// ============================================================================

export {
  detectEntryPoints,
  detectImportAlias,
  detectProjectContext,
  detectProjectType,
  detectSrcDir,
  detectTechStack,
} from './context/context';
export { generateAiNavigation } from './context/navigation';
export { checkStandards } from './context/standards';

// ============================================================================
// METRICS & SCORING (from metrics/)
// ============================================================================

export {
  analyzeFileSizes,
  DEFAULT_THRESHOLDS as FILE_SIZE_THRESHOLDS,
  quickScanFileSizes,
} from './metrics/file-size';
export {
  calculateTotalImprovement,
  filterByCategory,
  generateRecommendations,
  getAutoFixable,
  groupByCategory,
  sortByPriority,
} from './metrics/recommendations';
export { analyzeReusableModules, getQuickReusableSummary } from './metrics/reusable';

// ============================================================================
// SHARED UTILITIES (from shared/)
// ============================================================================

export type { PackageJson } from './shared/helpers';
export {
  createSharedProject,
  findDir,
  findFile,
  findTsConfig,
  getAllDependencies,
  getSubdirectories,
  hasDir,
  hasFile,
  listDirectory,
  readPackageJson,
} from './shared/helpers';

// ============================================================================
// ENHANCED ANALYSIS (orchestrator)
// ============================================================================

export {
  createEnhancedAnalysis,
  createEnhancedMigrationPlan,
  type EnhancedAnalysisOptions,
} from './enhanced';
