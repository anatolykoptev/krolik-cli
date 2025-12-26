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
  extractFunctions,
  findDuplicates,
  quickScanDuplicates,
} from './duplicates';
export {
  analyzeStructure,
  visualizeStructure,
} from './structure';
export { extractFunctionsSwc, type SwcFunctionInfo } from './swc-parser';
export {
  extractTypes,
  type FindTypeDuplicatesOptions,
  findTypeDuplicates,
  quickScanTypeDuplicates,
  type TypeDuplicateInfo,
  type TypeSignature,
} from './type-duplicates';

// ============================================================================
// PROJECT CONTEXT (from context.ts)
// ============================================================================

export {
  detectEntryPoints,
  detectImportAlias,
  detectProjectContext,
  detectProjectType,
  detectSrcDir,
  detectTechStack,
} from './context';

// ============================================================================
// ARCHITECTURE ANALYSIS (from architecture.ts)
// ============================================================================

export {
  analyzeArchHealth,
  analyzeDependencies,
  findCircularDeps,
  getDirectoriesWithCategories,
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

export { generateAiNavigation } from './navigation';

// ============================================================================
// RECOMMENDATIONS (from recommendations.ts)
// ============================================================================

export {
  calculateTotalImprovement,
  filterByCategory,
  generateRecommendations,
  getAutoFixable,
  groupByCategory,
  sortByPriority,
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

export { checkStandards } from './standards';

// ============================================================================
// NAMESPACE ANALYSIS (from namespace.ts)
// ============================================================================

export type {
  NamespaceAnalysisResult,
  NamespaceImportUpdate,
  NamespaceMigrationMove,
  NamespaceMigrationPlan,
} from './namespace';
export {
  analyzeNamespaceDirectory,
  analyzeNamespaceStructure,
  calculateNamespaceScore,
  detectNamespaceCategory,
  findLibDir,
  generateNamespaceMigrationPlan,
} from './namespace';

// ============================================================================
// HELPERS (from helpers.ts)
// ============================================================================

export type { PackageJson } from './helpers';
export {
  findDir,
  findFile,
  getAllDependencies,
  getSubdirectories,
  hasDir,
  hasFile,
  listDirectory,
  readPackageJson,
} from './helpers';

// ============================================================================
// REUSABLE MODULES (from reusable.ts)
// ============================================================================

export { analyzeReusableModules, getQuickReusableSummary } from './reusable';
