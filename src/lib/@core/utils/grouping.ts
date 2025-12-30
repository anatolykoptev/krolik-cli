/**
 * @module lib/@core/utils/grouping
 * @description Generic grouping utilities for collections
 */

/**
 * Group items by a key extracted from each item via a function
 *
 * @example
 * const users = [{ name: 'Alice', role: 'admin' }, { name: 'Bob', role: 'user' }];
 * const byRole = groupBy(users, u => u.role);
 * // Map { 'admin' => [{ name: 'Alice', ... }], 'user' => [{ name: 'Bob', ... }] }
 */
export function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();

  for (const item of items) {
    const key = keyFn(item);
    const group = grouped.get(key) ?? [];
    group.push(item);
    grouped.set(key, group);
  }

  return grouped;
}

/**
 * Group items by a property key (type-safe accessor)
 *
 * @example
 * const users = [{ id: 1, role: 'admin' }, { id: 2, role: 'user' }];
 * const byRole = groupByProperty(users, 'role');
 * // Map { 'admin' => [...], 'user' => [...] }
 */
export function groupByProperty<T, K extends keyof T>(items: T[], key: K): Map<string, T[]> {
  return groupBy(items, (item) => String(item[key]));
}

/**
 * Group items by a key function, returning a plain object instead of Map
 * Useful for JSON serialization or when Map is not needed
 *
 * @example
 * const items = [{ type: 'a', val: 1 }, { type: 'b', val: 2 }];
 * const grouped = groupByToRecord(items, i => i.type);
 * // { a: [{ type: 'a', val: 1 }], b: [{ type: 'b', val: 2 }] }
 */
export function groupByToRecord<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return items.reduce(
    (result, item) => {
      const key = keyFn(item);
      result[key] = result[key] ?? [];
      result[key].push(item);
      return result;
    },
    {} as Record<string, T[]>,
  );
}

/**
 * Group items by a property key, returning a plain object
 *
 * @example
 * const issues = [{ severity: 'error', msg: 'A' }, { severity: 'warning', msg: 'B' }];
 * const grouped = groupByPropertyToRecord(issues, 'severity');
 * // { error: [...], warning: [...] }
 */
export function groupByPropertyToRecord<T, K extends keyof T>(
  items: T[],
  key: K,
): Record<string, T[]> {
  return groupByToRecord(items, (item) => String(item[key]));
}
