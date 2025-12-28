/**
 * @module commands/fix/strategies/shared
 * @description Shared utilities for fix strategies
 *
 * Contains:
 * - biome.ts: Biome integration (lint, format)
 * - formatting.ts: Prettier, syntax validation
 * - typescript.ts: TypeScript type checking
 *
 * For line/operations/pattern utilities, import from 'core/':
 * @example
 * import { splitLines, createDeleteLine } from '../core';
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
