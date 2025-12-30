/**
 * @module lib/@detectors/patterns/react-patterns
 * @description React hook detection patterns - single source of truth
 *
 * Uses pattern-based detection instead of hardcoded lists:
 * - React hooks: any function starting with `use` followed by capital letter
 * - Built-in vs custom: determined by import source
 *
 * Used by:
 * - commands/context/parsers/components.ts
 * - commands/context/parsers/components-swc.ts
 */

// ============================================================================
// PATTERNS
// ============================================================================

/**
 * Pattern matching React hook naming convention.
 * React hooks MUST:
 * - Start with "use"
 * - Followed by an uppercase letter (e.g., useEffect, useState)
 *
 * @see https://react.dev/learn/reusing-logic-with-custom-hooks#hook-names-always-start-with-use
 */
export const REACT_HOOK_PATTERN = /^use[A-Z][a-zA-Z0-9]*$/;

/**
 * Pattern for extracting hook names from source code.
 * Matches function calls that look like hooks.
 */
export const HOOK_CALL_PATTERN = /\buse[A-Z][a-zA-Z0-9]*\b/g;

// ============================================================================
// BUILT-IN HOOKS
// ============================================================================

/**
 * React package identifiers for import source detection.
 */
export const REACT_PACKAGE_IDENTIFIERS = ['react', 'react-dom', '@types/react'] as const;

/**
 * Complete list of React built-in hooks (React 18+).
 * These are the hooks that ship with React itself.
 *
 * @see https://react.dev/reference/react
 */
export const REACT_BUILT_IN_HOOKS = [
  // State Hooks
  'useState',
  'useReducer',
  // Context Hooks
  'useContext',
  // Ref Hooks
  'useRef',
  'useImperativeHandle',
  // Effect Hooks
  'useEffect',
  'useLayoutEffect',
  'useInsertionEffect',
  // Performance Hooks
  'useMemo',
  'useCallback',
  'useTransition',
  'useDeferredValue',
  // Other Hooks
  'useDebugValue',
  'useId',
  'useSyncExternalStore',
  // React 19 Hooks (form actions)
  'useActionState',
  'useFormStatus',
  'useOptimistic',
] as const;

/**
 * React DOM built-in hooks.
 */
export const REACT_DOM_BUILT_IN_HOOKS = ['useFormStatus', 'useFormState'] as const;

/**
 * All React ecosystem built-in hooks (React + React DOM).
 */
export const ALL_BUILT_IN_HOOKS = [...REACT_BUILT_IN_HOOKS, ...REACT_DOM_BUILT_IN_HOOKS] as const;

// ============================================================================
// DETECTION FUNCTIONS
// ============================================================================

/**
 * Check if a function name follows React hook naming convention.
 * Hook names MUST start with "use" followed by an uppercase letter.
 *
 * @param name - Function name to check
 * @returns true if the name follows hook naming convention
 *
 * @example
 * isReactHook('useState')     // true
 * isReactHook('useMyHook')    // true
 * isReactHook('usememo')      // false (lowercase after 'use')
 * isReactHook('useEffect')    // true
 * isReactHook('createState')  // false (doesn't start with 'use')
 */
export function isReactHook(name: string): boolean {
  return REACT_HOOK_PATTERN.test(name);
}

/**
 * Check if a hook is a React built-in hook.
 *
 * When importSource is provided, it checks if the hook is imported from React.
 * When importSource is not provided, it falls back to checking the hook name
 * against the known built-in hooks list.
 *
 * @param name - Hook name to check
 * @param importSource - Optional import source path (e.g., 'react', '@/hooks/useAuth')
 * @returns true if the hook is a React built-in
 *
 * @example
 * isBuiltInHook('useState')                    // true (known built-in)
 * isBuiltInHook('useState', 'react')           // true (from react)
 * isBuiltInHook('useAuth', '@/hooks/useAuth')  // false (custom hook)
 * isBuiltInHook('useMyCustomHook')             // false (unknown)
 */
export function isBuiltInHook(name: string, importSource?: string): boolean {
  // If import source is provided, check if it's from React packages
  if (importSource !== undefined) {
    const isFromReact = REACT_PACKAGE_IDENTIFIERS.some(
      (pkg) => importSource === pkg || importSource.startsWith(`${pkg}/`),
    );

    // If imported from React, it's built-in if it follows hook naming
    if (isFromReact && isReactHook(name)) {
      return true;
    }

    // If imported from elsewhere, it's not a built-in
    if (!isFromReact) {
      return false;
    }
  }

  // Fallback: check against known built-in hooks list
  return (ALL_BUILT_IN_HOOKS as readonly string[]).includes(name);
}

/**
 * Check if a hook is a custom (non-built-in) hook.
 *
 * @param name - Hook name to check
 * @param importSource - Optional import source path
 * @returns true if the hook is a custom hook
 *
 * @example
 * isCustomHook('useAuth')     // true
 * isCustomHook('useState')    // false (built-in)
 * isCustomHook('myFunction')  // false (not a hook)
 */
export function isCustomHook(name: string, importSource?: string): boolean {
  // Must be a valid hook name first
  if (!isReactHook(name)) {
    return false;
  }

  // If it's a built-in, it's not custom
  return !isBuiltInHook(name, importSource);
}

/**
 * Extract all hook names from source code content.
 *
 * @param content - Source code to extract hooks from
 * @returns Array of hook names found in the content
 *
 * @example
 * extractHookNames('const x = useState(0); useEffect(() => {}, []);')
 * // Returns: ['useState', 'useEffect']
 */
export function extractHookNames(content: string): string[] {
  const matches = content.match(HOOK_CALL_PATTERN) || [];
  return [...new Set(matches)];
}

/**
 * Extract only custom hooks from source code content.
 * Filters out React built-in hooks.
 *
 * @param content - Source code to extract hooks from
 * @returns Array of custom hook names found in the content
 *
 * @example
 * extractCustomHooks('const x = useState(0); useAuth();')
 * // Returns: ['useAuth']
 */
export function extractCustomHooks(content: string): string[] {
  const allHooks = extractHookNames(content);
  return allHooks.filter((hook) => isCustomHook(hook));
}
