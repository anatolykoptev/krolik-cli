/**
 * @module lib/@utils/object
 * @description Object utility functions
 */

/**
 * Remove undefined values from an object.
 * Useful for passing options to functions with exactOptionalPropertyTypes.
 *
 * @example
 * const opts = stripUndefined({ a: 1, b: undefined, c: 'hello' });
 * // { a: 1, c: 'hello' }
 */
export function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

/**
 * Pick only defined values from an object
 * Type-safe version that returns the same type
 */
export function definedOnly<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined),
  ) as T;
}
