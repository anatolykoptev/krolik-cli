/**
 * @module commands/quality/analyzers/thresholds
 * @description Path-based threshold configuration and overrides
 */

import type { ThresholdOverride, Thresholds } from '../types';

/**
 * Get thresholds for a specific file path, applying overrides
 * Last matching override wins
 */
export function getThresholdsForPath(
  relativePath: string,
  baseThresholds: Thresholds,
  overrides?: ThresholdOverride[],
): Thresholds {
  if (!overrides || overrides.length === 0) {
    return baseThresholds;
  }

  // Find matching override (last match wins)
  let result = { ...baseThresholds };

  for (const override of overrides) {
    // Simple glob matching: check if path starts with pattern (minus **)
    const pattern = override.pattern.replace(/\*\*/g, '').replace(/\*/g, '');
    if (relativePath.startsWith(pattern) || relativePath.includes(pattern)) {
      result = { ...result, ...override.thresholds };
    }
  }

  return result;
}

/**
 * Build thresholds from options with defaults
 */
export function buildThresholds(options: {
  maxFunctionLines?: number;
  maxFunctionsPerFile?: number;
  maxExportsPerFile?: number;
  maxFileLines?: number;
  maxComplexity?: number;
  requireJSDoc?: boolean;
}): Thresholds {
  return {
    maxFunctionLines: options.maxFunctionLines ?? 50,
    maxFunctionsPerFile: options.maxFunctionsPerFile ?? 10,
    maxExportsPerFile: options.maxExportsPerFile ?? 5,
    maxFileLines: options.maxFileLines ?? 400,
    maxParams: 5,
    maxImports: 20,
    maxComplexity: options.maxComplexity ?? 10,
    requireJSDoc: options.requireJSDoc ?? true,
  };
}
