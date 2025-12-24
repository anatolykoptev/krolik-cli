/**
 * @module commands/fix/ast-utils/types
 * @description Type definitions for AST-based code transformations
 */

import type { Node } from 'ts-morph';

// ============================================================================
// FUNCTION EXTRACTION
// ============================================================================

export interface ExtractFunctionOptions {
  startLine: number;
  endLine: number;
  functionName: string;
  isAsync?: boolean;
}

export interface ExtractFunctionResult {
  success: boolean;
  newContent?: string;
  error?: string;
  extractedFunction?: string;
}

// ============================================================================
// NESTING REDUCTION
// ============================================================================

export interface ReduceNestingResult {
  success: boolean;
  newContent?: string;
  changesCount?: number;
  error?: string;
}

// ============================================================================
// FILE SPLITTING
// ============================================================================

export interface SplitFileResult {
  success: boolean;
  files?: Array<{ path: string; content: string }>;
  error?: string;
}

export interface SplitConfig {
  byType?: boolean;
  byPrefix?: boolean;
  groupFn?: (name: string, node: Node) => string;
}
