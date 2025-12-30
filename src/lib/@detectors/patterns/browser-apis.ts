/**
 * @module lib/@detectors/patterns/browser-apis
 * @description Browser API detection patterns - single source of truth
 *
 * Uses object-based detection instead of hardcoded method lists:
 * - Console methods: detected by object name, not method name
 * - Dialog functions: detected as global window APIs
 *
 * Used by:
 * - lib/@swc/detectors/lint-detector.ts
 * - lib/@detectors/lint.ts
 */

// ============================================================================
// CONSOLE OBJECT DETECTION
// ============================================================================

/**
 * Console object identifiers.
 * In browser/Node.js environments, console can be accessed as:
 * - `console` (global)
 * - `window.console` (browser)
 * - `globalThis.console` (universal)
 */
export const CONSOLE_OBJECT_NAMES = ['console'] as const;

/**
 * Parent objects that may contain console.
 */
export const CONSOLE_PARENT_OBJECTS = ['window', 'globalThis', 'global'] as const;

/**
 * Check if a member expression represents a console method call.
 * This uses object-based detection - any method on the console object is considered.
 *
 * @param objectName - The object being accessed (e.g., 'console', 'window')
 * @param memberName - The property/method being accessed (e.g., 'log', 'error')
 * @returns true if this is a console method access
 *
 * @example
 * isConsoleMember('log', 'console')           // true
 * isConsoleMember('myMethod', 'console')      // true (any console method)
 * isConsoleMember('log', 'logger')            // false (not console object)
 * isConsoleMember('console', 'window')        // true (window.console access)
 */
export function isConsoleMember(memberName: string, objectName: string): boolean {
  // Direct console access: console.log, console.error, etc.
  if ((CONSOLE_OBJECT_NAMES as readonly string[]).includes(objectName)) {
    return true;
  }

  // Parent object access to console: window.console, globalThis.console
  if (
    (CONSOLE_PARENT_OBJECTS as readonly string[]).includes(objectName) &&
    memberName === 'console'
  ) {
    return true;
  }

  return false;
}

/**
 * Known console methods for reference.
 * These are the standard Console API methods.
 * Note: Detection is object-based, so any console.* call is detected.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Console
 */
export const KNOWN_CONSOLE_METHODS = [
  // Logging
  'log',
  'info',
  'warn',
  'error',
  'debug',
  'trace',
  // Grouping
  'group',
  'groupCollapsed',
  'groupEnd',
  // Counting/Timing
  'count',
  'countReset',
  'time',
  'timeLog',
  'timeEnd',
  'timeStamp',
  // Formatting
  'table',
  'dir',
  'dirxml',
  // Assertions
  'assert',
  // Clearing
  'clear',
  // Profiling (non-standard)
  'profile',
  'profileEnd',
] as const;

// ============================================================================
// DIALOG FUNCTIONS DETECTION
// ============================================================================

/**
 * Browser dialog function names.
 * These are global window methods that show modal dialogs.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Window/alert
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Window/confirm
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Window/prompt
 */
export const DIALOG_FUNCTION_NAMES = ['alert', 'confirm', 'prompt'] as const;

/**
 * Window-like objects that contain dialog functions.
 */
export const DIALOG_PARENT_OBJECTS = ['window', 'globalThis'] as const;

/**
 * Check if a function name is a browser dialog function.
 * Detects both global calls (alert()) and window method calls (window.alert()).
 *
 * @param name - Function or method name to check
 * @param parentObject - Optional parent object (e.g., 'window')
 * @returns true if this is a browser dialog function
 *
 * @example
 * isDialogFunction('alert')                  // true (global call)
 * isDialogFunction('alert', 'window')        // true (window.alert)
 * isDialogFunction('showAlert')              // false (custom function)
 * isDialogFunction('log', 'console')         // false (console method)
 */
export function isDialogFunction(name: string, parentObject?: string): boolean {
  // Check if the name matches a dialog function
  const isDialogName = (DIALOG_FUNCTION_NAMES as readonly string[]).includes(name);

  if (!isDialogName) {
    return false;
  }

  // Global call (no parent object) - likely a dialog function
  if (parentObject === undefined) {
    return true;
  }

  // Check if called on window-like objects
  return (DIALOG_PARENT_OBJECTS as readonly string[]).includes(parentObject);
}

// ============================================================================
// EVAL DETECTION
// ============================================================================

/**
 * Dangerous eval-like function names.
 * These functions can execute arbitrary code and are security risks.
 */
export const EVAL_FUNCTION_NAMES = ['eval'] as const;

/**
 * Related dangerous patterns (Function constructor, etc.).
 */
export const EVAL_LIKE_PATTERNS = ['Function', 'setTimeout', 'setInterval'] as const;

/**
 * Check if a function name is eval or eval-like.
 *
 * @param name - Function name to check
 * @param checkConstructors - Also check Function constructor patterns
 * @returns true if this is an eval-like function
 *
 * @example
 * isEvalFunction('eval')              // true
 * isEvalFunction('Function', true)    // true (with constructors check)
 * isEvalFunction('myEval')            // false
 */
export function isEvalFunction(name: string, checkConstructors = false): boolean {
  if ((EVAL_FUNCTION_NAMES as readonly string[]).includes(name)) {
    return true;
  }

  if (checkConstructors && (EVAL_LIKE_PATTERNS as readonly string[]).includes(name)) {
    return true;
  }

  return false;
}

// ============================================================================
// COMPOSITE CHECKS
// ============================================================================

/**
 * Browser API categories for detection.
 */
export type BrowserApiCategory = 'console' | 'dialog' | 'eval';

/**
 * Detection result for browser API calls.
 */
export interface BrowserApiDetection {
  category: BrowserApiCategory;
  name: string;
  objectName?: string;
}

/**
 * Detect browser API call from a member expression or identifier.
 *
 * @param name - The function/method name
 * @param objectName - Optional object name for member expressions
 * @returns Detection result or null if not a browser API
 *
 * @example
 * detectBrowserApi('log', 'console')   // { category: 'console', name: 'log', objectName: 'console' }
 * detectBrowserApi('alert')            // { category: 'dialog', name: 'alert' }
 * detectBrowserApi('myFunc')           // null
 */
export function detectBrowserApi(name: string, objectName?: string): BrowserApiDetection | null {
  // Check console methods
  if (objectName && isConsoleMember(name, objectName)) {
    return {
      category: 'console',
      name,
      objectName,
    };
  }

  // Check dialog functions
  if (isDialogFunction(name, objectName)) {
    const result: BrowserApiDetection = {
      category: 'dialog',
      name,
    };
    if (objectName !== undefined) {
      result.objectName = objectName;
    }
    return result;
  }

  // Check eval functions (only without object for global eval)
  if (!objectName && isEvalFunction(name)) {
    return {
      category: 'eval',
      name,
    };
  }

  return null;
}
