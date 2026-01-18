/**
 * @module lib/@reporter/formatter/json
 * @description JSON formatters for various data types
 */

import type { AIReport } from '../types';

/**
 * Format AI Report as JSON
 */
export function formatAsJson(report: AIReport): string {
  return JSON.stringify(report, null, 2);
}

/**
 * Format any data as pretty JSON
 * @param data - Any JSON-serializable data
 * @param options - Formatting options
 */
export function formatJson(
  data: unknown,
  options: { indent?: number; compact?: boolean } = {},
): string {
  const indent = options.compact ? 0 : (options.indent ?? 2);
  return JSON.stringify(data, null, indent);
}

/**
 * Format context data as JSON for MCP tools
 * Handles circular references and BigInt values
 */
export function formatContextJson(data: Record<string, unknown>): string {
  return JSON.stringify(
    data,
    (_key, value) => {
      // Handle BigInt
      if (typeof value === 'bigint') {
        return value.toString();
      }
      // Handle Date objects
      if (value instanceof Date) {
        return value.toISOString();
      }
      return value;
    },
    2,
  );
}
