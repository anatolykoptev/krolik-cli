/**
 * @module lib/@ast
 * @description Unified AST utilities for code analysis
 *
 * This module provides two AST engines:
 * - ts-morph (default export) - Rich TypeScript AST (slower, full type info)
 * - swc (import from ./swc) - Fast SWC parser (10-20x faster, no type info)
 *
 * @example
 * ```typescript
 * // ts-morph for type-aware analysis (default)
 * import { withSourceFile } from '@/lib/@ast';
 *
 * // SWC for fast parsing (explicit import)
 * import { parseFile, visitNode } from '@/lib/@ast/swc';
 * ```
 */

// ============================================================================
// TS-MORPH (primary API)
// ============================================================================

export * from './ts-morph';

// ============================================================================
// ANALYSIS (source file analysis using SWC)
// ============================================================================

export * from './analysis';

// ============================================================================
// SIGNATURES (function/class signatures)
// ============================================================================

export * from './signatures';

// ============================================================================
// FINGERPRINTING (structural clone detection)
// ============================================================================

export * from './fingerprint';

// NOTE: SWC exports are available via '@/lib/@ast/swc'
// This avoids naming conflicts with ts-morph exports
