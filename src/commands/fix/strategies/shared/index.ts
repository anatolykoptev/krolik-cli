/**
 * @module commands/fix/strategies/shared
 * @description Shared utilities for fix strategies
 *
 * @deprecated Many utilities have been moved to core/. Please update imports:
 * - Line utils: import from '../core/line-utils' or '../core/utils'
 * - Operations: import from '../core/operations' or '../core/utils'
 * - Pattern utils: import from '../core/pattern-utils' or '../core/utils'
 *
 * This file is kept for backward compatibility but will be removed in a future version.
 */

// Biome integration
export {
  type BiomeCheckResult,
  type BiomeDiagnostic,
  type BiomeResult,
  biomeAutoFix,
  biomeCheckFile,
  biomeFixFile,
  biomeFormat,
  biomeLint,
  biomeLintFix,
  biomeOrganizeImports,
  getBiomeVersion,
  hasBiomeConfig,
  isBiomeAvailable,
  shouldBiomeProcess,
} from './biome';

// Formatting & validation
export {
  // Types
  type CreateProjectOptions,
  clearPrettierCache,
  createProject,
  formatWithPrettier,
  getSyntaxErrors,
  hasAlertCallAtLine,
  hasConsoleCallAtLine,
  // AST-based checks
  hasDebuggerStatementAtLine,
  tryFormatWithPrettier,
  validateAndFormat,
  validateAndFormatWithErrors,
  validateSyntax,
} from './formatting';

// TypeScript integration
export {
  formatAsJson,
  formatAsText,
  formatAsXml,
  getSummaryLine,
  getTscVersion,
  hasTsConfig,
  isTscAvailable,
  runTypeCheck,
  shouldTsProcess,
  type TsCheckResult,
  type TsDiagnostic,
} from './typescript';

// ============================================================================
// DEPRECATED: Re-exports from core/ for backward compatibility
// ============================================================================

/**
 * @deprecated Import from '../core/line-utils' or '../core/utils' instead
 */
export {
  countLines,
  getLineContext,
  getLines,
  isComment,
  isEmptyLine,
  joinLines,
  type LineContext,
  lineContains,
  lineEndsWith,
  lineStartsWith,
  splitLines,
} from '../../core/line-utils';

/**
 * @deprecated Import from '../core/operations' or '../core/utils' instead
 */
export {
  createDeleteLine,
  createFullFileReplace,
  createReplaceLine,
  createReplaceRange,
  createSplitFile,
  isNoOp,
  withMetadata,
} from '../../core/operations';

/**
 * @deprecated Import from '../core/pattern-utils' or '../core/utils' instead
 */
export {
  containsKeyword,
  extractNumber,
  extractString,
  findMatchingPattern,
  inRange,
  matchesAll,
  matchesAny,
  matchNumberInRange,
  type NumberRange,
  type PatternMatch,
} from '../../core/pattern-utils';
