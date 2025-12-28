/**
 * @module lib/format/json
 * @description JSON formatting utilities
 *
 * Provides utilities for:
 * - Pretty-printed JSON output
 * - Compact JSON for APIs
 * - Partial JSON for large objects
 */

// ============================================================================
// TYPES
// ============================================================================

export interface JsonFormatOptions {
  /** Indentation (default: 2 spaces) */
  indent?: number;
  /** Sort object keys alphabetically */
  sortKeys?: boolean;
  /** Maximum depth to serialize (for circular/deep objects) */
  maxDepth?: number;
  /** Replacer function for JSON.stringify */
  replacer?: (key: string, value: unknown) => unknown;
}

// ============================================================================
// FORMATTING
// ============================================================================

/**
 * Format data as pretty-printed JSON
 *
 * @example
 * formatJson({ name: 'John', age: 30 })
 * // Returns: '{\n  "name": "John",\n  "age": 30\n}'
 */
export function formatJson<T>(data: T, options: JsonFormatOptions = {}): string {
  const { indent = 2, sortKeys = false, maxDepth, replacer } = options;

  // Handle circular references and max depth
  const processedData = maxDepth ? limitDepth(data, maxDepth) : data;

  // Sort keys if requested
  const sortedData = sortKeys ? sortObjectKeys(processedData) : processedData;

  return JSON.stringify(sortedData, replacer as never, indent);
}

/**
 * Format data as compact JSON (single line)
 */
export function formatJsonCompact<T>(data: T): string {
  return JSON.stringify(data);
}

/**
 * Format data as JSONL (JSON Lines - one object per line)
 */
export function formatJsonLines<T>(items: T[]): string {
  return items.map((item) => JSON.stringify(item)).join('\n');
}

// ============================================================================
// PARSING
// ============================================================================

/**
 * Safely parse JSON with error handling
 *
 * @returns Parsed object or null if invalid
 */
export function parseJsonSafe<T>(json: string): T | null {
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

/**
 * Parse JSON with a default value on error
 */
export function parseJsonWithDefault<T>(json: string, defaultValue: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return defaultValue;
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Limit object depth to prevent infinite recursion
 */
function limitDepth(obj: unknown, maxDepth: number, currentDepth: number = 0): unknown {
  if (currentDepth >= maxDepth) {
    return '[Max depth reached]';
  }

  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => limitDepth(item, maxDepth, currentDepth + 1));
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = limitDepth(value, maxDepth, currentDepth + 1);
    }
    return result;
  }

  return obj;
}

/**
 * Sort object keys alphabetically (recursive)
 */
function sortObjectKeys(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }

  if (typeof obj === 'object') {
    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(obj as Record<string, unknown>).sort();

    for (const key of keys) {
      sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
    }

    return sorted;
  }

  return obj;
}

/**
 * Check if a string is valid JSON
 */
export function isValidJson(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Merge multiple JSON objects
 */
export function mergeJson<T extends Record<string, unknown>>(...objects: Partial<T>[]): T {
  return objects.reduce((acc, obj) => ({ ...acc, ...obj }), {}) as T;
}
