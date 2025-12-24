/**
 * @module commands/fix/strategies/shared
 * @description Shared utilities for fix strategies
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
// Line manipulation
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
} from './line-utils';

// Fix operations
export {
  createDeleteLine,
  createFullFileReplace,
  createReplaceLine,
  createReplaceRange,
  createSplitFile,
  isNoOp,
  withMetadata,
} from './operations';
// Pattern matching
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
} from './pattern-utils';

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
