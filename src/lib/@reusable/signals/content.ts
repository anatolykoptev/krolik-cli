/**
 * @module lib/@reusable/signals/content
 * @description Content analysis for reusable code detection
 *
 * Analyzes file content using AST to detect patterns like
 * React hooks, JSX, validation schemas, etc.
 */

import * as fs from 'node:fs';
import type { ContentSignals } from '../types';

// ============================================================================
// SCORING CONSTANTS
// ============================================================================

const SCORES = {
  /** Score for exporting validation schemas */
  EXPORTS_SCHEMA: 15,
  /** Score for being a pure function */
  PURE_FUNCTION: 10,
  /** Score for React hook usage (indicates hook module) */
  USES_HOOKS: 5,
  /** Score for creating context */
  CREATES_CONTEXT: 5,
  /** Penalty for JSX (indicates component, less reusable) */
  EXPORTS_JSX_PENALTY: -5,
};

// ============================================================================
// CONTENT PATTERNS
// ============================================================================

/**
 * Patterns that indicate React hook usage
 */
const REACT_HOOK_PATTERNS = [
  /\buseState\s*\(/,
  /\buseEffect\s*\(/,
  /\buseContext\s*\(/,
  /\buseReducer\s*\(/,
  /\buseCallback\s*\(/,
  /\buseMemo\s*\(/,
  /\buseRef\s*\(/,
  /\buseLayoutEffect\s*\(/,
  /\buseImperativeHandle\s*\(/,
  /\buseDebugValue\s*\(/,
  /\buseId\s*\(/,
  /\buseSyncExternalStore\s*\(/,
  /\buseTransition\s*\(/,
  /\buseDeferredValue\s*\(/,
  /\buseInsertionEffect\s*\(/,
];

/**
 * Patterns that indicate JSX usage
 */
const JSX_PATTERNS = [
  /<[A-Z][a-zA-Z0-9]*[\s/>]/, // <Component
  /<[a-z][a-zA-Z0-9-]*[\s/>]/, // <div, <my-element
  /React\.createElement\s*\(/, // React.createElement
  /jsx\s*\(/, // jsx()
  /jsxs\s*\(/, // jsxs()
  /Fragment\s*>/, // <>Fragment</>
];

/**
 * Patterns that indicate validation schema usage
 */
const SCHEMA_PATTERNS = [
  /z\.(object|string|number|boolean|array|union|enum|literal|tuple|record)/, // Zod
  /yup\.(object|string|number|boolean|array|mixed)/, // Yup
  /Joi\.(object|string|number|boolean|array)/, // Joi
  /v\.(object|string|number|boolean|array)/, // Valibot
  /\.refine\s*\(/, // Zod refine
  /\.transform\s*\(/, // Zod transform
  /\.parse\s*\(/, // Schema parse
  /\.safeParse\s*\(/, // Zod safeParse
  /Schema\s*=\s*z\./, // const Schema = z.
  /export\s+(?:const|type)\s+\w*Schema/, // export const/type XxxSchema
];

/**
 * Patterns that indicate React context creation
 */
const CONTEXT_PATTERNS = [
  /createContext\s*\(/, // React.createContext
  /React\.createContext\s*\(/, // Full path
  /Context\.Provider/, // Context provider usage
  /useContext\s*\(\s*\w+Context\)/, // useContext(SomeContext)
];

/**
 * Patterns that suggest pure functions
 */
const PURE_FUNCTION_INDICATORS = [
  /^export\s+(?:const|function)\s+\w+\s*=?\s*\([^)]*\)\s*(?:=>|{)/, // Export function with params
  /^\s*return\s+/m, // Has return statement
];

/**
 * Patterns that suggest side effects
 */
const SIDE_EFFECT_PATTERNS = [
  /fetch\s*\(/, // Network calls
  /axios\.\w+\s*\(/, // Axios calls
  /console\.(log|warn|error|info)/, // Console output
  /localStorage\.\w+/, // LocalStorage
  /sessionStorage\.\w+/, // SessionStorage
  /document\.\w+/, // DOM manipulation
  /window\.\w+/, // Window access
  /process\.env/, // Environment access
  /fs\.\w+/, // File system (Node)
  /new\s+Date\s*\(\s*\)/, // Current time (impure)
  /Math\.random\s*\(\s*\)/, // Random values
  /\bawait\s+/, // Async operations (usually side effects)
];

/**
 * Patterns that indicate async operations
 */
const ASYNC_PATTERNS = [
  /async\s+(?:function|\([^)]*\)\s*=>|\w+\s*=\s*async)/, // async function
  /\.then\s*\(/, // Promise.then
  /await\s+/, // await keyword
  /Promise\.(all|race|any|allSettled)\s*\(/, // Promise combinators
];

// ============================================================================
// ANALYSIS FUNCTIONS
// ============================================================================

/**
 * Check if content contains any of the given patterns
 */
function matchesAnyPattern(content: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(content));
}

// NOTE: countPatternMatches is kept for potential future use
// function countPatternMatches(content: string, patterns: RegExp[]): number {
//   return patterns.filter((pattern) => pattern.test(content)).length;
// }

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Analyze content signals for a file
 *
 * @param filePath - Path to the file
 * @param content - Optional file content (reads from disk if not provided)
 * @returns Content signals with score
 *
 * @example
 * ```ts
 * const signals = analyzeContentSignals('/path/to/useAuth.ts');
 * // { usesReactHooks: true, exportsJSX: false, score: 5, ... }
 * ```
 */
export function analyzeContentSignals(filePath: string, content?: string): ContentSignals {
  let fileContent: string;

  try {
    fileContent = content ?? fs.readFileSync(filePath, 'utf-8');
  } catch {
    return {
      exportsJSX: false,
      usesReactHooks: false,
      exportsValidationSchema: false,
      createsReactContext: false,
      isPureFunction: false,
      hasAsyncOperations: false,
      score: 0,
    };
  }

  // Detect patterns
  const exportsJSX = matchesAnyPattern(fileContent, JSX_PATTERNS);
  const usesReactHooks = matchesAnyPattern(fileContent, REACT_HOOK_PATTERNS);
  const exportsValidationSchema = matchesAnyPattern(fileContent, SCHEMA_PATTERNS);
  const createsReactContext = matchesAnyPattern(fileContent, CONTEXT_PATTERNS);
  const hasAsyncOperations = matchesAnyPattern(fileContent, ASYNC_PATTERNS);

  // Determine if it's a pure function
  const hasPureIndicators = matchesAnyPattern(fileContent, PURE_FUNCTION_INDICATORS);
  const hasSideEffects = matchesAnyPattern(fileContent, SIDE_EFFECT_PATTERNS);
  const isPureFunction = hasPureIndicators && !hasSideEffects && !exportsJSX && !hasAsyncOperations;

  // Calculate score
  let score = 0;

  if (exportsValidationSchema) {
    score += SCORES.EXPORTS_SCHEMA;
  }
  if (isPureFunction) {
    score += SCORES.PURE_FUNCTION;
  }
  if (usesReactHooks && !exportsJSX) {
    // Hooks without JSX are likely hook utilities
    score += SCORES.USES_HOOKS;
  }
  if (createsReactContext) {
    score += SCORES.CREATES_CONTEXT;
  }
  if (exportsJSX) {
    // JSX exports are typically components, less reusable as utilities
    score += SCORES.EXPORTS_JSX_PENALTY;
  }

  return {
    exportsJSX,
    usesReactHooks,
    exportsValidationSchema,
    createsReactContext,
    isPureFunction,
    hasAsyncOperations,
    score: Math.max(0, score),
  };
}

/**
 * Detect dominant content type
 *
 * Returns a hint about what the file primarily contains.
 */
export function detectContentType(
  signals: ContentSignals,
): 'component' | 'hook' | 'schema' | 'context' | 'utility' | 'async-service' | null {
  if (signals.exportsJSX) {
    return signals.usesReactHooks ? 'component' : 'component';
  }
  if (signals.createsReactContext) {
    return 'context';
  }
  if (signals.usesReactHooks && !signals.exportsJSX) {
    return 'hook';
  }
  if (signals.exportsValidationSchema) {
    return 'schema';
  }
  if (signals.hasAsyncOperations) {
    return 'async-service';
  }
  if (signals.isPureFunction) {
    return 'utility';
  }

  return null;
}

/**
 * Check if file is likely a React component
 */
export function isLikelyReactComponent(filePath: string, content?: string): boolean {
  const signals = analyzeContentSignals(filePath, content);
  return signals.exportsJSX;
}

/**
 * Check if file is likely a React hook
 */
export function isLikelyReactHook(filePath: string, content?: string): boolean {
  const signals = analyzeContentSignals(filePath, content);
  return signals.usesReactHooks && !signals.exportsJSX;
}

/**
 * Check if file is likely a validation schema
 */
export function isLikelyValidationSchema(filePath: string, content?: string): boolean {
  const signals = analyzeContentSignals(filePath, content);
  return signals.exportsValidationSchema;
}
