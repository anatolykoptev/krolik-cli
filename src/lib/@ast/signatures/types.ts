/**
 * @module lib/parsing/signatures/types
 * @description Type definitions for signature extraction from AST
 *
 * Provides shared types for extracting function, class, type, and interface
 * signatures from TypeScript/JavaScript source files.
 *
 * @example
 * import type { Signature, SignatureType, SignatureOptions } from '@/lib/@ast/signatures';
 *
 * const sig: Signature = {
 *   file: 'src/utils.ts',
 *   line: 42,
 *   text: 'export function parseDate(str: string): Date',
 *   type: 'function',
 *   name: 'parseDate',
 *   isExported: true,
 * };
 */

// ============================================================================
// SIGNATURE TYPE
// ============================================================================

/**
 * Types of signatures that can be extracted
 */
export type SignatureType = 'class' | 'function' | 'type' | 'interface' | 'const' | 'method';

/**
 * Represents a condensed view of a symbol without its implementation body
 *
 * Based on Aider's RepoMap approach - shows only signatures for code context.
 *
 * @example
 * const signature: Signature = {
 *   file: 'src/lib/utils.ts',
 *   line: 15,
 *   text: 'export function formatCurrency(amount: number, currency: string): string',
 *   type: 'function',
 *   name: 'formatCurrency',
 *   isExported: true,
 * };
 */
export interface Signature {
  /** Absolute or relative file path */
  file: string;

  /** Line number (1-based) */
  line: number;

  /** Signature text (single line, without body) */
  text: string;

  /** Symbol type */
  type: SignatureType;

  /** Symbol name */
  name: string;

  /** Whether the symbol is exported */
  isExported: boolean;
}

// ============================================================================
// OPTIONS
// ============================================================================

/**
 * Options for signature extraction
 *
 * @example
 * const options: SignatureOptions = {
 *   includePrivate: false,
 *   includeInternal: false,
 *   maxLength: 200,
 * };
 */
export interface SignatureOptions {
  /**
   * Include private methods (those starting with #)
   * @default false
   */
  includePrivate?: boolean;

  /**
   * Include internal symbols (those starting with _)
   * @default false
   */
  includeInternal?: boolean;

  /**
   * Maximum signature length before truncation
   * @default 200
   */
  maxLength?: number;
}

/**
 * Signature options with all fields required (after applying defaults)
 */
export type RequiredSignatureOptions = Required<SignatureOptions>;

// ============================================================================
// EXTRACTION CONTEXT
// ============================================================================

/**
 * Context passed to extraction functions containing parsed AST data
 */
export interface ExtractionContext {
  /** Source file content */
  content: string;

  /** Pre-calculated line offsets for position mapping */
  lineOffsets: number[];

  /** Base offset for SWC span normalization */
  baseOffset: number;

  /** File path being analyzed */
  filePath: string;

  /** Extraction options */
  options: RequiredSignatureOptions;
}
