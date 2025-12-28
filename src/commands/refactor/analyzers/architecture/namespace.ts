/**
 * @module commands/refactor/analyzers/architecture/namespace
 * @description Namespace structure analyzer for lib/ directory
 *
 * Re-exports from namespace/ directory for backward compatibility.
 * All functionality has been split into focused modules.
 */

export { NAMESPACE_INFO } from '../../core/constants';
export { analyzeNamespaceDirectory, analyzeNamespaceStructure } from './namespace/analysis';
export { countTsFiles, findLibDir, getSubdirs, isNamespaced } from './namespace/fs-utils';

export { generateNamespaceMigrationPlan } from './namespace/migration';
export { calculateNamespaceScore, detectNamespaceCategory } from './namespace/scoring';
export type {
  NamespaceAnalysisResult,
  NamespaceImportUpdate,
  NamespaceMigrationMove,
  NamespaceMigrationPlan,
} from './namespace/types';
