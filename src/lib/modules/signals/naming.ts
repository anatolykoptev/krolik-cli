/**
 * @module lib/modules/signals/naming
 * @description Naming convention analysis for reusable code detection
 *
 * Analyzes file and export names to infer module category and reusability.
 */

import * as path from 'node:path';
import type { ExportedMember } from '@/lib/parsing';
import { type ModuleCategory, NAMING_PATTERNS, type NamingSignals } from '../types';

// ============================================================================
// SCORING CONSTANTS
// ============================================================================

const SCORES = {
  /** Score for matching utility pattern */
  UTILITY_PATTERN: 15,
  /** Score for matching hook pattern */
  HOOK_PATTERN: 15,
  /** Score for matching schema pattern */
  SCHEMA_PATTERN: 10,
  /** Score for matching service pattern */
  SERVICE_PATTERN: 10,
  /** Score for matching constant pattern */
  CONSTANT_PATTERN: 5,
};

// ============================================================================
// PATTERN MATCHING
// ============================================================================

/**
 * Check if name matches hook pattern (useXxx)
 */
export function isHookName(name: string): boolean {
  return NAMING_PATTERNS.hook.test(name);
}

/**
 * Check if name matches utility function pattern
 */
export function isUtilityName(name: string): boolean {
  return NAMING_PATTERNS.utility.test(name);
}

/**
 * Check if name matches guard/predicate pattern
 */
export function isGuardName(name: string): boolean {
  return NAMING_PATTERNS.guard.test(name);
}

/**
 * Check if name matches constant pattern (UPPER_SNAKE_CASE)
 */
export function isConstantName(name: string): boolean {
  return NAMING_PATTERNS.constant.test(name);
}

/**
 * Check if name matches type pattern
 */
export function isTypeName(name: string): boolean {
  return NAMING_PATTERNS.type.test(name);
}

/**
 * Check if name matches schema pattern
 */
export function isSchemaName(name: string): boolean {
  return NAMING_PATTERNS.schema.test(name);
}

/**
 * Check if name matches service pattern
 */
export function isServiceName(name: string): boolean {
  return NAMING_PATTERNS.service.test(name);
}

/**
 * Check if name matches component pattern (PascalCase, not hook)
 */
export function isComponentName(name: string): boolean {
  return NAMING_PATTERNS.component.test(name) && !isHookName(name);
}

/**
 * Check if name matches context pattern
 */
export function isContextName(name: string): boolean {
  return NAMING_PATTERNS.context.test(name);
}

/**
 * Check if name matches HOC pattern
 */
export function isHocName(name: string): boolean {
  return NAMING_PATTERNS.hoc.test(name);
}

// ============================================================================
// ANALYSIS
// ============================================================================

/**
 * Detect naming pattern for a single name
 */
export function detectNamingPattern(
  name: string,
):
  | 'hook'
  | 'utility'
  | 'guard'
  | 'constant'
  | 'type'
  | 'schema'
  | 'service'
  | 'component'
  | 'context'
  | 'hoc'
  | null {
  // Order matters - more specific patterns first
  if (isHookName(name)) return 'hook';
  if (isHocName(name)) return 'hoc';
  if (isContextName(name)) return 'context';
  if (isSchemaName(name)) return 'schema';
  if (isServiceName(name)) return 'service';
  if (isGuardName(name)) return 'guard';
  if (isUtilityName(name)) return 'utility';
  if (isConstantName(name)) return 'constant';
  if (isTypeName(name)) return 'type';
  if (isComponentName(name)) return 'component';

  return null;
}

/**
 * Analyze naming signals for a module
 *
 * @param moduleName - Name of the module (file/folder name)
 * @param exports - Exported members from the module
 * @returns Naming signals with score
 *
 * @example
 * ```ts
 * const signals = analyzeNamingSignals('useAuth', exports);
 * // { matchedPattern: 'hook', isHookNaming: true, score: 15, ... }
 * ```
 */
export function analyzeNamingSignals(moduleName: string, exports: ExportedMember[]): NamingSignals {
  // Analyze module name
  const modulePattern = detectNamingPattern(moduleName);

  // Analyze export names
  const exportPatterns = new Map<string, number>();
  for (const exp of exports) {
    const pattern = detectNamingPattern(exp.name);
    if (pattern) {
      exportPatterns.set(pattern, (exportPatterns.get(pattern) ?? 0) + 1);
    }
  }

  // Find dominant export pattern
  let dominantExportPattern: string | null = null;
  let maxCount = 0;
  for (const [pattern, count] of exportPatterns) {
    if (count > maxCount) {
      maxCount = count;
      dominantExportPattern = pattern;
    }
  }

  // Determine overall pattern
  const matchedPattern = modulePattern ?? dominantExportPattern ?? undefined;

  // Determine flags
  const isHookNaming = modulePattern === 'hook' || exportPatterns.has('hook');
  const isUtilityNaming =
    modulePattern === 'utility' ||
    modulePattern === 'guard' ||
    exportPatterns.has('utility') ||
    exportPatterns.has('guard');
  const isComponentNaming = modulePattern === 'component';
  const isConstantNaming = modulePattern === 'constant' || exportPatterns.has('constant');
  const isServiceNaming = modulePattern === 'service' || exportPatterns.has('service');

  // Calculate score
  let score = 0;

  if (isHookNaming) {
    score += SCORES.HOOK_PATTERN;
  }
  if (isUtilityNaming) {
    score += SCORES.UTILITY_PATTERN;
  }
  if (exportPatterns.has('schema')) {
    score += SCORES.SCHEMA_PATTERN;
  }
  if (isServiceNaming) {
    score += SCORES.SERVICE_PATTERN;
  }
  if (isConstantNaming) {
    score += SCORES.CONSTANT_PATTERN;
  }

  const result: NamingSignals = {
    isHookNaming,
    isUtilityNaming,
    isComponentNaming,
    isConstantNaming,
    isServiceNaming,
    score,
  };

  if (matchedPattern) {
    result.matchedPattern = matchedPattern;
  }

  return result;
}

/**
 * Infer category from naming patterns
 *
 * @param signals - Naming signals
 * @returns Inferred category or null
 */
export function inferCategoryFromNaming(signals: NamingSignals): ModuleCategory | null {
  if (signals.isHookNaming) return 'hook';
  if (signals.isServiceNaming) return 'service';
  if (signals.isConstantNaming) return 'constant';
  if (signals.isUtilityNaming) return 'utility';
  if (signals.isComponentNaming) return 'ui-component';

  // Check specific patterns
  if (signals.matchedPattern === 'schema') return 'schema';
  if (signals.matchedPattern === 'type') return 'type';
  if (signals.matchedPattern === 'context') return 'context';
  if (signals.matchedPattern === 'hoc') return 'hoc';

  return null;
}

/**
 * Extract clean module name from file path
 *
 * Removes common prefixes/suffixes for better pattern matching.
 */
export function extractCleanModuleName(filePath: string): string {
  const fileName = path.basename(filePath, path.extname(filePath));

  // Remove common suffixes
  return fileName
    .replace(/\.(test|spec|stories|story)$/i, '')
    .replace(/\.d$/i, '') // .d.ts
    .replace(/^index$/i, path.basename(path.dirname(filePath)));
}

/**
 * Group exports by naming pattern
 *
 * Useful for understanding module composition.
 */
export function groupExportsByPattern(exports: ExportedMember[]): Record<string, ExportedMember[]> {
  const groups: Record<string, ExportedMember[]> = {
    hook: [],
    utility: [],
    guard: [],
    constant: [],
    type: [],
    schema: [],
    service: [],
    component: [],
    context: [],
    hoc: [],
    other: [],
  };

  for (const exp of exports) {
    const pattern = detectNamingPattern(exp.name);
    if (pattern && groups[pattern]) {
      groups[pattern].push(exp);
    } else if (groups.other) {
      groups.other.push(exp);
    }
  }

  // Remove empty groups
  return Object.fromEntries(Object.entries(groups).filter(([, v]) => v.length > 0));
}
