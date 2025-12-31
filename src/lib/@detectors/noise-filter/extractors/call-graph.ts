/**
 * @module lib/@detectors/noise-filter/extractors/call-graph
 * @description Call Graph Extraction
 *
 * Extracts function and component calls from code for semantic comparison.
 * Used to distinguish functions that call different APIs/components.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface CallNode {
  name: string;
  type: 'function' | 'component' | 'hook' | 'method' | 'constructor';
  isAsync: boolean;
}

export interface CallGraphResult {
  functions: string[];
  components: string[];
  hooks: string[];
  methods: string[];
  all: string[];
}

// ============================================================================
// PATTERNS
// ============================================================================

/**
 * Regex to extract function calls.
 * Matches: functionName(, await functionName(
 */
const FUNCTION_CALL_PATTERN = /(?:await\s+)?([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;

/**
 * Regex to extract method calls.
 * Matches: object.methodName(
 */
const METHOD_CALL_PATTERN = /\.([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;

/**
 * Hook pattern (starts with use).
 */
const HOOK_PATTERN = /^use[A-Z]/;

/**
 * Component pattern (starts with uppercase).
 */
const COMPONENT_PATTERN = /^[A-Z]/;

/**
 * Built-in functions to exclude.
 */
const BUILTIN_FUNCTIONS = new Set([
  // JS built-ins
  'console',
  'Math',
  'JSON',
  'Object',
  'Array',
  'String',
  'Number',
  'Boolean',
  'Promise',
  'Date',
  'Error',
  'Map',
  'Set',
  'RegExp',
  // Control flow
  'if',
  'for',
  'while',
  'switch',
  'try',
  'catch',
  'throw',
  // Common utility
  'require',
  'import',
  'export',
  'return',
  'async',
  'await',
  'function',
  'class',
  'new',
  'typeof',
  'instanceof',
]);

/**
 * Built-in methods to exclude.
 */
const BUILTIN_METHODS = new Set([
  // Array methods
  'map',
  'filter',
  'reduce',
  'forEach',
  'find',
  'some',
  'every',
  'includes',
  'indexOf',
  'push',
  'pop',
  'shift',
  'unshift',
  'slice',
  'splice',
  'concat',
  'join',
  'sort',
  'reverse',
  'flat',
  'flatMap',
  'fill',
  'entries',
  'keys',
  'values',
  // String methods
  'toLowerCase',
  'toUpperCase',
  'trim',
  'split',
  'replace',
  'match',
  'startsWith',
  'endsWith',
  'substring',
  'charAt',
  'charCodeAt',
  'padStart',
  'padEnd',
  // Object methods
  'hasOwnProperty',
  'toString',
  'valueOf',
  'toJSON',
  // Promise methods
  'then',
  'catch',
  'finally',
  'resolve',
  'reject',
  'all',
  'race',
  'allSettled',
  // Console methods
  'log',
  'error',
  'warn',
  'info',
  'debug',
  'trace',
  // JSON methods
  'parse',
  'stringify',
  // Common methods
  'get',
  'set',
  'delete',
  'has',
  'clear',
  'add',
  'next',
  'done',
]);

// ============================================================================
// EXTRACTION
// ============================================================================

/**
 * Extract function and method calls from code.
 *
 * @param code - Code to analyze
 * @returns Categorized list of calls
 *
 * @example
 * extractCallGraph('const data = await fetchUser(id); return <UserCard user={data} />')
 * // → { functions: ['fetchUser'], components: ['UserCard'], hooks: [], methods: [], all: ['fetchUser', 'UserCard'] }
 */
export function extractCallGraph(code: string): CallGraphResult {
  const functions: string[] = [];
  const components: string[] = [];
  const hooks: string[] = [];
  const methods: string[] = [];

  // Extract function calls
  const functionMatches = [...code.matchAll(FUNCTION_CALL_PATTERN)];
  for (const match of functionMatches) {
    const name = match[1];
    if (!name) continue;
    if (BUILTIN_FUNCTIONS.has(name)) continue;

    if (HOOK_PATTERN.test(name)) {
      if (!hooks.includes(name)) hooks.push(name);
    } else if (COMPONENT_PATTERN.test(name)) {
      if (!components.includes(name)) components.push(name);
    } else {
      if (!functions.includes(name)) functions.push(name);
    }
  }

  // Extract method calls
  const methodMatches = [...code.matchAll(METHOD_CALL_PATTERN)];
  for (const match of methodMatches) {
    const name = match[1];
    if (!name) continue;
    if (BUILTIN_METHODS.has(name)) continue;
    if (!methods.includes(name)) methods.push(name);
  }

  return {
    functions,
    components,
    hooks,
    methods,
    all: [...functions, ...components, ...hooks],
  };
}

/**
 * Compare call graphs of two code snippets.
 *
 * @returns Jaccard similarity (0.0 - 1.0)
 */
export function compareCallGraphs(code1: string, code2: string): number {
  const graph1 = extractCallGraph(code1);
  const graph2 = extractCallGraph(code2);

  const set1 = new Set(graph1.all);
  const set2 = new Set(graph2.all);

  if (set1.size === 0 && set2.size === 0) return 1.0;
  if (set1.size === 0 || set2.size === 0) return 0.0;

  const intersection = [...set1].filter((x) => set2.has(x)).length;
  const union = new Set([...set1, ...set2]).size;

  return intersection / union;
}

/**
 * Check if two code snippets call the same functions/components.
 */
export function haveSameCalls(code1: string, code2: string): boolean {
  const graph1 = extractCallGraph(code1).all.sort();
  const graph2 = extractCallGraph(code2).all.sort();

  if (graph1.length !== graph2.length) return false;
  return graph1.every((c, i) => c === graph2[i]);
}

/**
 * Check if all code snippets make different calls.
 */
export function allMakeDifferentCalls(codes: string[]): boolean {
  if (codes.length < 2) return false;

  const callSets = codes.map((code) => {
    const { all } = extractCallGraph(code);
    return all.sort().join(',');
  });

  const uniqueSets = new Set(callSets);
  return uniqueSets.size === callSets.length;
}

/**
 * Get the signature of calls for comparison.
 */
export function getCallSignature(code: string): string {
  const { all } = extractCallGraph(code);
  return all.sort().join(',');
}
