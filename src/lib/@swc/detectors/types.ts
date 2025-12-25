/**
 * @module lib/@swc/detectors/types
 * @description Shared types for SWC AST detection functions
 */

// ============================================================================
// LINT DETECTION TYPES
// ============================================================================

/** Lint issue types detected by AST visitor */
export type LintIssueType = 'console' | 'debugger' | 'alert' | 'eval' | 'empty-catch';

/** Lint issue detected by AST visitor */
export interface LintDetection {
  type: LintIssueType;
  offset: number;
  method?: string; // For console.log, alert, etc.
}

// ============================================================================
// TYPE-SAFETY DETECTION TYPES
// ============================================================================

/** Type-safety issue types detected by AST visitor */
export type TypeSafetyIssueType =
  | 'any-annotation'
  | 'any-assertion'
  | 'non-null'
  | 'any-param'
  | 'any-array'
  | 'double-assertion';

/** Type-safety issue detected by AST visitor */
export interface TypeSafetyDetection {
  type: TypeSafetyIssueType;
  offset: number;
}

// ============================================================================
// SECURITY DETECTION TYPES
// ============================================================================

/** Security issue types detected by AST visitor */
export type SecurityIssueType = 'command-injection' | 'path-traversal';

/** Security issue detected by AST visitor */
export interface SecurityDetection {
  type: SecurityIssueType;
  offset: number;
  method?: string; // For execSync, spawn, path.join, etc.
}

// ============================================================================
// MODERNIZATION DETECTION TYPES
// ============================================================================

/** Modernization issue types detected by AST visitor */
export type ModernizationIssueType = 'require';

/** Modernization issue detected by AST visitor */
export interface ModernizationDetection {
  type: ModernizationIssueType;
  offset: number;
  method?: string; // 'require' or 'require.resolve'
}

// ============================================================================
// HARDCODED VALUE DETECTION TYPES
// ============================================================================

/** Hardcoded value types detected by AST visitor */
export type HardcodedType = 'number' | 'url' | 'color';

/** Hardcoded value detected by AST visitor */
export interface HardcodedDetection {
  type: HardcodedType;
  value: string | number;
  offset: number;
}

// ============================================================================
// VISITOR CONTEXT TYPES
// ============================================================================

/** Context for tracking parent nodes during traversal */
export interface DetectorContext {
  /** Whether we're at top-level scope */
  isTopLevel: boolean;
  /** Whether we're inside a const declaration */
  inConstDeclaration: boolean | undefined;
  /** Whether we're inside a computed member expression */
  inMemberExpression: boolean | undefined;
  /** Parent node type */
  parentType: string | undefined;
}
