/**
 * @module lib/@detectors/noise-filter/extractors/jsx-children
 * @description JSX Component Children Extraction
 *
 * Extracts user-defined component names from JSX for semantic comparison.
 * Used to distinguish wrappers that render different components.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface JSXChildrenResult {
  components: string[];
  count: number;
  hasChildren: boolean;
}

// ============================================================================
// PATTERNS
// ============================================================================

/**
 * Regex to extract JSX component names (starts with uppercase).
 * Matches: <ComponentName, <ComponentName>, <ComponentName />
 */
const JSX_COMPONENT_PATTERN = /<([A-Z][A-Za-z0-9_]*)/g;

/**
 * Regex to detect HTML elements (starts with lowercase).
 */
const HTML_ELEMENT_PATTERN = /^[a-z]/;

/**
 * Built-in React components to exclude (Fragment, Suspense, etc.)
 */
const REACT_BUILTINS = new Set(['Fragment', 'Suspense', 'StrictMode', 'Profiler', 'Children']);

// ============================================================================
// EXTRACTION
// ============================================================================

/**
 * Extract user-defined component names from JSX code.
 *
 * @param code - JSX/TSX code to analyze
 * @returns List of unique component names found
 *
 * @example
 * extractJSXChildren('<UserCard user={user} />')
 * // → { components: ['UserCard'], count: 1, hasChildren: true }
 *
 * extractJSXChildren('<div><Header /><Content /><Footer /></div>')
 * // → { components: ['Header', 'Content', 'Footer'], count: 3, hasChildren: true }
 */
export function extractJSXChildren(code: string): JSXChildrenResult {
  const matches = [...code.matchAll(JSX_COMPONENT_PATTERN)];
  const components: string[] = [];

  for (const match of matches) {
    const name = match[1];
    if (!name) continue;

    // Skip HTML elements
    if (HTML_ELEMENT_PATTERN.test(name)) continue;

    // Skip React built-ins
    if (REACT_BUILTINS.has(name)) continue;

    // Skip if already added
    if (!components.includes(name)) {
      components.push(name);
    }
  }

  return {
    components,
    count: components.length,
    hasChildren: components.length > 0,
  };
}

/**
 * Check if code has exactly one user component (wrapper pattern).
 */
export function isSingleComponentWrapper(code: string): boolean {
  const { count } = extractJSXChildren(code);
  return count === 1;
}

/**
 * Compare JSX children of two code snippets.
 *
 * @returns true if they render the same components
 */
export function haveSameJSXChildren(code1: string, code2: string): boolean {
  const children1 = extractJSXChildren(code1).components.sort();
  const children2 = extractJSXChildren(code2).components.sort();

  if (children1.length !== children2.length) return false;

  return children1.every((c, i) => c === children2[i]);
}

/**
 * Check if all code snippets render different components.
 *
 * Used to detect intentional wrappers that render different content.
 */
export function allRenderDifferentComponents(codes: string[]): boolean {
  if (codes.length < 2) return false;

  const childrenSets = codes.map((code) => {
    const { components } = extractJSXChildren(code);
    return components.sort().join(',');
  });

  const uniqueSets = new Set(childrenSets);
  return uniqueSets.size === childrenSets.length;
}

/**
 * Get the main rendered component (first user component).
 */
export function getMainComponent(code: string): string | undefined {
  const { components } = extractJSXChildren(code);
  return components[0];
}
