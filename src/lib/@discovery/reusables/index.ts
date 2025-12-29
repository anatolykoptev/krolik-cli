/**
 * @module lib/@modules
 * @description Universal reusable code detection system
 *
 * Discovers and classifies reusable modules across any TypeScript/JavaScript
 * codebase using a multi-signal analysis approach.
 *
 * ## Features
 * - Zero-configuration: Works out of the box on any project
 * - Multi-signal detection: Uses directory patterns, exports, imports, naming, docs, and content analysis
 * - Accurate categorization: Classifies modules by purpose (hooks, utilities, components, etc.)
 * - Configurable: Power users can customize detection behavior
 *
 * ## Quick Start
 * ```ts
 * import { discoverReusableModules } from '@/lib/@discovery/reusables';
 *
 * const result = await discoverReusableModules('/path/to/project');
 *
 * // Access by category
 * result.byCategory.hook;      // All React hooks
 * result.byCategory.utility;   // All utility functions
 *
 * // Access by reusability level
 * result.byReusability.core;   // Essential shared code (score 80+)
 * result.byReusability.high;   // Frequently reused (score 50-79)
 * ```
 *
 * @see DESIGN.md for architecture details
 */

// ============================================================================
// MAIN API
// ============================================================================

export {
  discoverReusableModules,
  findModulesByCategory,
  findTopReusableModules,
  isLikelyReusable,
} from './detector';

// ============================================================================
// CLASSIFICATION
// ============================================================================

export {
  type ClassificationConfidence,
  calculateClassificationConfidence,
  classifyModule,
  getCategoryDisplayName,
  getCategoryIcon,
  getRelatedCategories,
  isTypicallyReusableCategory,
} from './classifier';

// ============================================================================
// SCORING
// ============================================================================

export {
  calculateReusabilityScore,
  determineReusabilityLevel,
  formatScoreBreakdown,
  getLevelColor,
  getLevelDescription,
  getScoreBreakdown,
  type ScoreBreakdown,
} from './scorer';

// ============================================================================
// SIGNAL ANALYZERS
// ============================================================================

export {
  // Content signals
  analyzeContentSignals,
  // Export signals
  analyzeDirectoryExports,
  // Directory signals
  analyzeDirectorySignals,
  // Documentation signals
  analyzeDocumentationSignals,
  analyzeExportSignals,
  // Import signals
  analyzeImportSignals,
  // Naming signals
  analyzeNamingSignals,
  buildImportGraph,
  countExamples,
  detectContentType,
  detectNamingPattern,
  extractCleanModuleName,
  extractModuleDescription,
  extractModuleName,
  findHighlyConnectedModules,
  findOrphanModules,
  getDirectoryCategoryHint,
  getExportCategoryHint,
  groupExportsByPattern,
  hasSubstantialDocumentation,
  type ImportGraph,
  inferCategoryFromNaming,
  isComponentName,
  isConstantName,
  isContextName,
  isGuardName,
  isHocName,
  isHookName,
  isInReusableDirectory,
  isLikelyReactComponent,
  isLikelyReactHook,
  isLikelyValidationSchema,
  isSchemaName,
  isServiceName,
  isTypeName,
  isUtilityName,
} from './signals';

// ============================================================================
// TYPES
// ============================================================================

export type {
  // Signal types
  ContentSignals,
  DetectionSignals,
  DirectorySignals,
  // Module types
  DiscoveredModule,
  DiscoveryResult,
  DocumentationSignals,
  ExportSignals,
  ImportSignals,
  // Core types
  ModuleCategory,
  ModulesByCategory,
  ModulesByReusability,
  NamingSignals,
  ReusabilityLevel,
  // Config types
  ReusableDetectionConfig,
} from './types';

export {
  DEFAULT_CONFIG,
  NAMING_PATTERNS,
  REUSABILITY_KEYWORDS,
  REUSABLE_DIRECTORY_PATTERNS,
} from './types';

// ============================================================================
// FORMATTERS
// ============================================================================

export { formatAsMarkdown, formatAsXML } from './formatters';
