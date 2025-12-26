/**
 * @module lib/@reusable/signals
 * @description Signal analyzers for reusable code detection
 *
 * Provides individual signal analyzers that contribute to
 * the overall reusability score.
 *
 * @example
 * ```ts
 * import {
 *   analyzeDirectorySignals,
 *   analyzeExportSignals,
 *   analyzeImportSignals,
 *   analyzeNamingSignals,
 *   analyzeDocumentationSignals,
 *   analyzeContentSignals,
 * } from '@/lib/@reusable/signals';
 *
 * const dirSignals = analyzeDirectorySignals(relativePath);
 * const exportSignals = analyzeExportSignals(filePath);
 * // ... combine for final score
 * ```
 */

// Content/AST analysis
export {
  analyzeContentSignals,
  detectContentType,
  isLikelyReactComponent,
  isLikelyReactHook,
  isLikelyValidationSchema,
} from './content';
// Directory pattern analysis
export {
  analyzeDirectorySignals,
  extractModuleName,
  getDirectoryCategoryHint,
  isInReusableDirectory,
} from './directory';
// Documentation analysis
export {
  analyzeDocumentationSignals,
  countExamples,
  extractModuleDescription,
  hasSubstantialDocumentation,
} from './documentation';
// Export pattern analysis
export {
  analyzeDirectoryExports,
  analyzeExportSignals,
  getExportCategoryHint,
} from './exports';
// Import frequency analysis
export type { ImportGraph } from './imports';
export {
  analyzeImportSignals,
  buildImportGraph,
  findHighlyConnectedModules,
  findOrphanModules,
} from './imports';
// Naming convention analysis
export {
  analyzeNamingSignals,
  detectNamingPattern,
  extractCleanModuleName,
  groupExportsByPattern,
  inferCategoryFromNaming,
  isComponentName,
  isConstantName,
  isContextName,
  isGuardName,
  isHocName,
  isHookName,
  isSchemaName,
  isServiceName,
  isTypeName,
  isUtilityName,
} from './naming';
