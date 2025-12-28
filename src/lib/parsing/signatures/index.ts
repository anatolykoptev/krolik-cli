/**
 * @module lib/parsing/signatures
 * @description Signature extraction from TypeScript/JavaScript source files
 *
 * Provides reusable functions for extracting function, class, type, and interface
 * signatures from source code. Uses SWC AST for fast and accurate parsing.
 *
 * Based on Aider's RepoMap approach - shows only signatures for code context.
 *
 * @example
 * // High-level API
 * import { extractSignatures, extractSignaturesFromFiles } from '@/lib/parsing/signatures';
 *
 * const signatures = extractSignatures('src/utils.ts', sourceCode);
 * for (const sig of signatures) {
 *   console.log(`${sig.type}: ${sig.name} at line ${sig.line}`);
 * }
 *
 * @example
 * // Low-level extraction with custom context
 * import {
 *   extractFromModule,
 *   ExtractionContext,
 *   DEFAULT_SIGNATURE_OPTIONS
 * } from '@/lib/parsing/signatures';
 * import { parseFile, calculateLineOffsets } from '@/lib/parsing/swc';
 *
 * const { ast, lineOffsets, baseOffset } = parseFile('app.ts', code);
 * const ctx: ExtractionContext = {
 *   content: code,
 *   lineOffsets,
 *   baseOffset,
 *   filePath: 'app.ts',
 *   options: DEFAULT_SIGNATURE_OPTIONS,
 * };
 * const signatures = extractFromModule(ast, ctx);
 *
 * @example
 * // Text extraction utilities
 * import { extractSignatureText, findSignatureEnd } from '@/lib/parsing/signatures';
 *
 * const sigText = extractSignatureText(content, 100, 200, 200);
 * const bodyStart = findSignatureEnd('function foo() { return 1; }');
 */

import * as fs from 'node:fs';
import { parseFile as swcParseFile } from '@/lib/parsing/swc';
import { DEFAULT_SIGNATURE_OPTIONS } from './constants';
import { extractFromModule } from './extractors';
import type { ExtractionContext, Signature, SignatureOptions } from './types';

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Extract all signatures from a file
 *
 * This is the main entry point for signature extraction.
 * Handles file reading and parsing internally.
 *
 * @param filePath - Path to the TypeScript/JavaScript file
 * @param content - Optional file content (will read from disk if not provided)
 * @param options - Extraction options
 * @returns Array of Signature objects
 *
 * @example
 * const signatures = extractSignatures('src/lib/utils.ts');
 * for (const sig of signatures) {
 *   console.log(`${sig.type}: ${sig.name} at line ${sig.line}`);
 * }
 *
 * @example
 * // With options
 * const signatures = extractSignatures('src/internal.ts', undefined, {
 *   includeInternal: true,
 *   maxLength: 150,
 * });
 */
export function extractSignatures(
  filePath: string,
  content?: string,
  options: SignatureOptions = {},
): Signature[] {
  const opts = { ...DEFAULT_SIGNATURE_OPTIONS, ...options };
  const sourceContent = content ?? readFileSafe(filePath);
  if (!sourceContent) return [];

  try {
    const { ast, lineOffsets, baseOffset } = swcParseFile(filePath, sourceContent);

    const ctx: ExtractionContext = {
      content: sourceContent,
      lineOffsets,
      baseOffset,
      filePath,
      options: opts,
    };

    return extractFromModule(ast, ctx);
  } catch {
    return [];
  }
}

/**
 * Extract signatures from multiple files
 *
 * Batch extraction with efficient error handling per file.
 *
 * @param files - Array of file paths
 * @param options - Extraction options
 * @returns Map of file path to signatures
 *
 * @example
 * const files = ['src/a.ts', 'src/b.ts', 'src/c.ts'];
 * const signaturesMap = extractSignaturesFromFiles(files);
 *
 * for (const [file, sigs] of signaturesMap) {
 *   console.log(`${file}: ${sigs.length} signatures`);
 * }
 */
export function extractSignaturesFromFiles(
  files: string[],
  options: SignatureOptions = {},
): Map<string, Signature[]> {
  const result = new Map<string, Signature[]>();

  for (const filePath of files) {
    const signatures = extractSignatures(filePath, undefined, options);
    if (signatures.length > 0) {
      result.set(filePath, signatures);
    }
  }

  return result;
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Safely read file content, returning null on error
 */
function readFileSafe(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

// ============================================================================
// RE-EXPORTS
// ============================================================================

export type { VariableKeyword } from './constants';

// Constants
export {
  ARROW_OPERATOR,
  ASSIGNMENT_OPERATOR,
  BODY_START_BRACE,
  BRACKET_DELTAS,
  CLASS_KEYWORD,
  DEFAULT_MAX_SIGNATURE_LENGTH,
  DEFAULT_SIGNATURE_OPTIONS,
  EXPORT_KEYWORD,
  FUNCTION_KEYWORD,
  INTERFACE_KEYWORD,
  INTERNAL_PREFIX,
  MAX_CONTEXT_SNIPPET_LENGTH,
  PRIVATE_PREFIX,
  SWC_OFFSET_BASE,
  TRUNCATION_SUFFIX,
  TRUNCATION_SUFFIX_LENGTH,
  VARIABLE_KEYWORDS,
} from './constants';
// AST extractors
// Note: getNodeSpan is intentionally not exported here as it conflicts with
// the version in @/lib/parsing/swc/parser. Use getNodeSpan from swc instead.
export {
  extractClassSignatures,
  extractDeclaratorSignature,
  extractFromDeclaration,
  extractFromModule,
  extractFromModuleItem,
  extractFunctionExprSignature,
  extractFunctionSignature,
  extractInterfaceSignature,
  extractMethodSignatures,
  extractTypeAliasSignature,
  extractVariableSignatures,
} from './extractors';
// Format helpers
export {
  formatClassSignatureText,
  formatConstFunctionText,
  formatInterfaceSignatureText,
  formatMethodSignatureText,
  formatWithExport,
} from './format-helpers';
// Text extraction (pure functions)
export {
  extractConstTypeSignature,
  extractDeclarationLine,
  extractFirstLine,
  extractSignatureText,
  findBodyStartAt,
  findSignatureEnd,
} from './text-extraction';

// Types
export type {
  ExtractionContext,
  RequiredSignatureOptions,
  Signature,
  SignatureOptions,
  SignatureType,
} from './types';
