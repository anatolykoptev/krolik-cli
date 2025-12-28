/**
 * @module commands/refactor/analyzers/architecture
 * @description Architecture analysis including health, domains, structure, and namespaces
 */

// Architecture health
export {
  analyzeArchHealth,
  analyzeDependencies,
  findCircularDeps,
  getDirectoriesWithCategories,
} from './architecture';

// Domain classification
export {
  classifyDomains,
  getLowCoherenceDomains,
  getTotalMisplacedFiles,
  groupMisplacedByTarget,
} from './domains';
// Namespace analysis
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
  NAMESPACE_INFO,
} from './namespace';
// Structure analysis
export { analyzeStructure, visualizeStructure } from './structure';
