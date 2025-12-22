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
