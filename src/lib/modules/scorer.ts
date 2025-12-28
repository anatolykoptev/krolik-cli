/**
 * @module lib/modules/scorer
 * @description Reusability score calculation
 *
 * Combines signals from all analyzers to produce a final
 * reusability score and level.
 */

import type { DetectionSignals, ModuleCategory, ReusabilityLevel } from './types';

// ============================================================================
// WEIGHT CONFIGURATION
// ============================================================================

/**
 * Weights for each signal category
 *
 * Sum should be roughly 100 for max score of ~100.
 */
const SIGNAL_WEIGHTS = {
  /** Weight for directory pattern match */
  directory: 1.0,
  /** Weight for export patterns */
  exports: 1.0,
  /** Weight for import frequency */
  imports: 1.2, // Slightly higher - imports are strong signal
  /** Weight for naming conventions */
  naming: 0.8,
  /** Weight for documentation */
  documentation: 0.7,
  /** Weight for content analysis */
  content: 0.9,
};

/**
 * Category bonuses/penalties
 *
 * Some categories are inherently more reusable.
 */
const CATEGORY_ADJUSTMENTS: Record<ModuleCategory, number> = {
  utility: 10, // Pure utilities are very reusable
  hook: 8, // Hooks are designed for reuse
  type: 5, // Types are always reusable
  schema: 7, // Validation schemas are shared
  constant: 5, // Constants are simple and reusable
  context: 5, // Contexts are meant to be shared
  service: 5, // Services abstract common operations
  'ui-component': 0, // Components vary in reusability
  hoc: 3, // HOCs are moderately reusable
  model: 3, // Models are moderately reusable
  unknown: -5, // Unknown categories are suspect
};

// ============================================================================
// SCORE CALCULATION
// ============================================================================

/**
 * Calculate total reusability score from signals
 *
 * @param signals - All detection signals
 * @param category - Classified category (for bonus)
 * @returns Numeric score (typically 0-100+)
 *
 * @example
 * ```ts
 * const score = calculateReusabilityScore(signals, 'utility');
 * // 75 (score can exceed 100 for highly reusable modules)
 * ```
 */
export function calculateReusabilityScore(
  signals: DetectionSignals,
  category: ModuleCategory,
): number {
  // Calculate weighted sum of signal scores
  let weightedSum = 0;

  weightedSum += signals.directory.score * SIGNAL_WEIGHTS.directory;
  weightedSum += signals.exports.score * SIGNAL_WEIGHTS.exports;
  weightedSum += signals.imports.score * SIGNAL_WEIGHTS.imports;
  weightedSum += signals.naming.score * SIGNAL_WEIGHTS.naming;
  weightedSum += signals.documentation.score * SIGNAL_WEIGHTS.documentation;
  weightedSum += signals.content.score * SIGNAL_WEIGHTS.content;

  // Apply category adjustment
  const categoryBonus = CATEGORY_ADJUSTMENTS[category] ?? 0;
  weightedSum += categoryBonus;

  // Apply any penalties
  const penalties = calculatePenalties(signals);
  weightedSum -= penalties;

  // Ensure non-negative
  return Math.max(0, Math.round(weightedSum));
}

/**
 * Calculate penalties for anti-patterns
 */
function calculatePenalties(signals: DetectionSignals): number {
  let penalties = 0;

  // Default-only exports are less reusable
  if (signals.exports.defaultExportOnly) {
    penalties += 5;
  }

  // No documentation is a minor penalty
  if (!signals.documentation.hasAnyDocs) {
    penalties += 3;
  }

  // JSX exports are often single-use components
  if (signals.content.exportsJSX && signals.imports.importedByCount < 3) {
    penalties += 5;
  }

  return penalties;
}

// ============================================================================
// LEVEL DETERMINATION
// ============================================================================

/**
 * Determine reusability level from score
 *
 * @param score - Numeric reusability score
 * @returns Reusability level
 *
 * @example
 * ```ts
 * determineReusabilityLevel(85); // 'core'
 * determineReusabilityLevel(60); // 'high'
 * determineReusabilityLevel(35); // 'medium'
 * determineReusabilityLevel(15); // 'low'
 * determineReusabilityLevel(5);  // 'none'
 * ```
 */
export function determineReusabilityLevel(score: number): ReusabilityLevel {
  if (score >= 80) return 'core';
  if (score >= 50) return 'high';
  if (score >= 30) return 'medium';
  if (score >= 10) return 'low';
  return 'none';
}

/**
 * Get human-readable level description
 */
export function getLevelDescription(level: ReusabilityLevel): string {
  const descriptions: Record<ReusabilityLevel, string> = {
    core: 'Essential shared utilities used across the entire codebase',
    high: 'Frequently reused modules with high import counts',
    medium: 'Occasionally reused modules with moderate usage',
    low: 'Potentially reusable modules with limited current usage',
    none: 'Not detected as reusable (single-use or internal)',
  };

  return descriptions[level];
}

/**
 * Get level color for terminal output
 */
export function getLevelColor(level: ReusabilityLevel): string {
  const colors: Record<ReusabilityLevel, string> = {
    core: 'green',
    high: 'blue',
    medium: 'yellow',
    low: 'gray',
    none: 'dim',
  };

  return colors[level];
}

// ============================================================================
// SCORE BREAKDOWN
// ============================================================================

/**
 * Detailed score breakdown for debugging/transparency
 */
export interface ScoreBreakdown {
  directory: { raw: number; weighted: number };
  exports: { raw: number; weighted: number };
  imports: { raw: number; weighted: number };
  naming: { raw: number; weighted: number };
  documentation: { raw: number; weighted: number };
  content: { raw: number; weighted: number };
  categoryBonus: number;
  penalties: number;
  total: number;
  level: ReusabilityLevel;
}

/**
 * Get detailed score breakdown
 *
 * Useful for understanding why a module scored the way it did.
 */
export function getScoreBreakdown(
  signals: DetectionSignals,
  category: ModuleCategory,
): ScoreBreakdown {
  const directory = {
    raw: signals.directory.score,
    weighted: signals.directory.score * SIGNAL_WEIGHTS.directory,
  };

  const exports = {
    raw: signals.exports.score,
    weighted: signals.exports.score * SIGNAL_WEIGHTS.exports,
  };

  const imports = {
    raw: signals.imports.score,
    weighted: signals.imports.score * SIGNAL_WEIGHTS.imports,
  };

  const naming = {
    raw: signals.naming.score,
    weighted: signals.naming.score * SIGNAL_WEIGHTS.naming,
  };

  const documentation = {
    raw: signals.documentation.score,
    weighted: signals.documentation.score * SIGNAL_WEIGHTS.documentation,
  };

  const content = {
    raw: signals.content.score,
    weighted: signals.content.score * SIGNAL_WEIGHTS.content,
  };

  const categoryBonus = CATEGORY_ADJUSTMENTS[category] ?? 0;
  const penalties = calculatePenalties(signals);

  const total = Math.max(
    0,
    Math.round(
      directory.weighted +
        exports.weighted +
        imports.weighted +
        naming.weighted +
        documentation.weighted +
        content.weighted +
        categoryBonus -
        penalties,
    ),
  );

  return {
    directory,
    exports,
    imports,
    naming,
    documentation,
    content,
    categoryBonus,
    penalties,
    total,
    level: determineReusabilityLevel(total),
  };
}

/**
 * Format score breakdown for display
 */
export function formatScoreBreakdown(breakdown: ScoreBreakdown): string {
  const lines: string[] = [];

  lines.push('Score Breakdown:');
  lines.push(
    `  Directory:      ${breakdown.directory.raw.toFixed(0).padStart(3)} -> ${breakdown.directory.weighted.toFixed(1)}`,
  );
  lines.push(
    `  Exports:        ${breakdown.exports.raw.toFixed(0).padStart(3)} -> ${breakdown.exports.weighted.toFixed(1)}`,
  );
  lines.push(
    `  Imports:        ${breakdown.imports.raw.toFixed(0).padStart(3)} -> ${breakdown.imports.weighted.toFixed(1)}`,
  );
  lines.push(
    `  Naming:         ${breakdown.naming.raw.toFixed(0).padStart(3)} -> ${breakdown.naming.weighted.toFixed(1)}`,
  );
  lines.push(
    `  Documentation:  ${breakdown.documentation.raw.toFixed(0).padStart(3)} -> ${breakdown.documentation.weighted.toFixed(1)}`,
  );
  lines.push(
    `  Content:        ${breakdown.content.raw.toFixed(0).padStart(3)} -> ${breakdown.content.weighted.toFixed(1)}`,
  );
  lines.push(
    `  Category Bonus: ${breakdown.categoryBonus >= 0 ? '+' : ''}${breakdown.categoryBonus}`,
  );
  lines.push(`  Penalties:      -${breakdown.penalties}`);
  lines.push(`  ─────────────────────────`);
  lines.push(`  Total:          ${breakdown.total} (${breakdown.level})`);

  return lines.join('\n');
}
