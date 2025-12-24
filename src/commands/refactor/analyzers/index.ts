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
 */

// ============================================================================
// CORE ANALYZERS
// ============================================================================

export {
  findDuplicates,
  quickScanDuplicates,
  extractFunctions,
} from './duplicates';

export { extractFunctionsSwc, type SwcFunctionInfo } from './swc-parser';

export {
  findTypeDuplicates,
  quickScanTypeDuplicates,
  extractTypes,
  type TypeSignature,
  type TypeDuplicateInfo,
  type FindTypeDuplicatesOptions,
} from './type-duplicates';

export {
  analyzeStructure,
  visualizeStructure,
} from './structure';

// ============================================================================
// PROJECT CONTEXT (from context.ts)
// ============================================================================

export {
  detectProjectContext,
  detectProjectType,
  detectTechStack,
  detectEntryPoints,
  detectImportAlias,
  detectSrcDir,
} from './context';

// ============================================================================
// ARCHITECTURE ANALYSIS (from architecture.ts)
// ============================================================================

export {
  analyzeArchHealth,
  getDirectoriesWithCategories,
  analyzeDependencies,
  findCircularDeps,
} from './architecture';

// ============================================================================
// DOMAIN CLASSIFICATION (from domains.ts)
// ============================================================================

export {
  classifyDomains,
  getLowCoherenceDomains,
  getTotalMisplacedFiles,
  groupMisplacedByTarget,
} from './domains';

// ============================================================================
// AI NAVIGATION (from navigation.ts)
// ============================================================================

export {
  generateAiNavigation,
} from './navigation';

// ============================================================================
// RECOMMENDATIONS (from recommendations.ts)
// ============================================================================

export {
  generateRecommendations,
  filterByCategory,
  getAutoFixable,
  calculateTotalImprovement,
  sortByPriority,
  groupByCategory,
} from './recommendations';

// ============================================================================
// ENHANCED ANALYSIS (from enhanced.ts)
// ============================================================================

export {
  createEnhancedAnalysis,
  createEnhancedMigrationPlan,
} from './enhanced';

// ============================================================================
// STANDARDS COMPLIANCE (from standards.ts)
// ============================================================================

export {
  checkStandards,
} from './standards';

// ============================================================================
// NAMESPACE ANALYSIS (from namespace.ts)
// ============================================================================

export {
  findLibDir,
  detectNamespaceCategory,
  analyzeNamespaceDirectory,
  calculateNamespaceScore,
  generateNamespaceMigrationPlan,
  analyzeNamespaceStructure,
} from './namespace';

export type {
  NamespaceMigrationMove,
  NamespaceImportUpdate,
  NamespaceMigrationPlan,
  NamespaceAnalysisResult,
} from './namespace';

// ============================================================================
// HELPERS (from helpers.ts)
// ============================================================================

export {
  readPackageJson,
  getAllDependencies,
  hasFile,
  hasDir,
  findDir,
  findFile,
  listDirectory,
  getSubdirectories,
} from './helpers';

export type {
  PackageJson,
} from './helpers';
