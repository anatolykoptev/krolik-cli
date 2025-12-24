/**
 * @module commands/fix/strategies/shared
 * @description Shared utilities for fix strategies
 */

// Line manipulation
export {
  splitLines,
  getLineContext,
  getLines,
  joinLines,
  countLines,
  lineStartsWith,
  lineEndsWith,
  lineContains,
  isComment,
  isEmptyLine,
  type LineContext,
} from './line-utils';

// Pattern matching
export {
  extractNumber,
  extractString,
  inRange,
  matchNumberInRange,
  matchesAny,
  matchesAll,
  findMatchingPattern,
  containsKeyword,
  type NumberRange,
  type PatternMatch,
} from './pattern-utils';

// Formatting & validation
export {
  createProject,
  validateSyntax,
  getSyntaxErrors,
  formatWithPrettier,
  tryFormatWithPrettier,
  validateAndFormat,
  validateAndFormatWithErrors,
  clearPrettierCache,
  // AST-based checks
  hasDebuggerStatementAtLine,
  hasConsoleCallAtLine,
  hasAlertCallAtLine,
  // Types
  type CreateProjectOptions,
} from './formatting';

// Fix operations
export {
  createDeleteLine,
  createReplaceLine,
  createReplaceRange,
  createFullFileReplace,
  createSplitFile,
  withMetadata,
  isNoOp,
} from './operations';

// Biome integration
export {
  isBiomeAvailable,
  hasBiomeConfig,
  biomeAutoFix,
  biomeLint,
  biomeLintFix,
  biomeFormat,
  biomeOrganizeImports,
  biomeFixFile,
  biomeCheckFile,
  getBiomeVersion,
  shouldBiomeProcess,
  type BiomeDiagnostic,
  type BiomeResult,
  type BiomeCheckResult,
} from './biome';

// TypeScript integration
export {
  isTscAvailable,
  hasTsConfig,
  getTscVersion,
  runTypeCheck,
  formatAsJson,
  formatAsXml,
  formatAsText,
  getSummaryLine,
  shouldTsProcess,
  type TsDiagnostic,
  type TsCheckResult,
} from './typescript';
