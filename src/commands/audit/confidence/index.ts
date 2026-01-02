/**
 * @module commands/audit/confidence
 * @description Confidence scoring for issue detection
 *
 * Based on Google Engineering Practices:
 * "Zero False Positives > High Recall"
 *
 * Each issue gets a confidence score based on detection method accuracy.
 */

import {
  type ConfidenceFactor,
  type ConfidenceScore,
  DETECTION_CONFIDENCE,
  scoreToConfidenceLevel,
} from '@/types/severity';
import type { QualityCategory } from '../../fix/core';

// ============================================================================
// CATEGORY CONFIDENCE
// ============================================================================

/**
 * Base confidence by issue category
 * Some categories are more reliably detected than others
 */
const CATEGORY_CONFIDENCE: Record<QualityCategory, number> = {
  // High confidence (AST-based, clear patterns)
  lint: 95, // console.log, debugger - very clear
  security: 90, // SQL injection, path traversal - clear patterns

  // Medium-high confidence
  'type-safety': 85, // any, unknown - AST-based
  modernization: 80, // old patterns detected reliably
  'backwards-compat': 85, // deprecated markers are clear

  // Medium confidence (context-dependent)
  complexity: 75, // cyclomatic complexity is objective
  size: 70, // line count is objective but threshold is subjective
  srp: 65, // single responsibility is somewhat subjective
  'circular-dep': 90, // clear circular import detection

  // Lower confidence (heuristic-based)
  hardcoded: 60, // magic numbers might be intentional
  documentation: 55, // JSDoc missing might be intentional
  'mixed-concerns': 50, // architectural, subjective
  i18n: 65, // hardcoded text detection

  // Special categories
  composite: 70, // multi-file operations
  agent: 75, // AI operations
  refine: 70, // @namespace structure
};

// ============================================================================
// DETECTION METHOD CONFIDENCE
// ============================================================================

/**
 * Confidence boost/penalty by detection method
 */
interface DetectionMethod {
  /** Detection used AST parsing */
  ast: boolean;
  /** Detection has type information */
  typed: boolean;
  /** Detection is context-aware */
  contextual: boolean;
  /** Detection uses historical data */
  historical: boolean;
}

/**
 * Calculate confidence from detection method
 */
function calculateMethodConfidence(method: Partial<DetectionMethod>): number {
  let score = 0;
  if (method.ast) score += DETECTION_CONFIDENCE.ast ?? 0;
  if (method.typed) score += DETECTION_CONFIDENCE.typed ?? 0;
  if (method.contextual) score += DETECTION_CONFIDENCE.contextual ?? 0;
  if (method.historical) score += DETECTION_CONFIDENCE.historical ?? 0;
  return Math.min(score, 100);
}

// ============================================================================
// ISSUE-SPECIFIC CONFIDENCE
// ============================================================================

/**
 * Confidence adjustments for specific issue patterns
 */
const PATTERN_CONFIDENCE: Record<string, number> = {
  // Very high confidence (clear patterns)
  'console-log': 98,
  debugger: 99,
  alert: 95,
  'ts-ignore': 95,
  'ts-nocheck': 95,

  // High confidence
  'any-usage': 90,
  'sql-injection': 92,
  'path-traversal': 88,
  'command-injection': 90,

  // Medium confidence
  'high-complexity': 80,
  'missing-return-type': 75,

  // Lower confidence (might be intentional)
  'hardcoded-url': 60, // might be constant
  'hardcoded-number': 50, // might be intentional
  'hardcoded-string': 45, // might be intentional
  'missing-jsdoc': 40, // style preference
};

// ============================================================================
// MAIN API
// ============================================================================

/**
 * Options for confidence calculation
 */
export interface ConfidenceOptions {
  /** Issue category */
  category: QualityCategory;
  /** Specific pattern if known */
  pattern?: string | undefined;
  /** Detection method used */
  method?: Partial<DetectionMethod> | undefined;
  /** Additional context factors */
  context?:
    | {
        /** Is in test file */
        isTest?: boolean | undefined;
        /** Is in generated file */
        isGenerated?: boolean | undefined;
        /** Has TODO/FIXME comment nearby */
        hasTodoComment?: boolean | undefined;
        /** Is in try-catch block */
        isInTryCatch?: boolean | undefined;
      }
    | undefined;
}

/**
 * Calculate confidence score for an issue
 *
 * @param options - Confidence calculation options
 * @returns Confidence score with reasoning
 */
export function calculateConfidence(options: ConfidenceOptions): ConfidenceScore {
  const factors: ConfidenceFactor[] = [];
  let totalScore = 0;

  // 1. Base confidence from category
  const categoryScore = CATEGORY_CONFIDENCE[options.category] ?? 50;
  factors.push({
    name: 'category',
    contribution: categoryScore * 0.4, // 40% weight
    description: `${options.category} detection accuracy`,
  });
  totalScore += categoryScore * 0.4;

  // 2. Pattern-specific confidence
  const patternScore = options.pattern ? PATTERN_CONFIDENCE[options.pattern] : undefined;
  if (patternScore !== undefined) {
    factors.push({
      name: 'pattern',
      contribution: patternScore * 0.3, // 30% weight
      description: `${options.pattern} pattern accuracy`,
    });
    totalScore += patternScore * 0.3;
  } else {
    // Default pattern score
    factors.push({
      name: 'pattern',
      contribution: 50 * 0.3,
      description: 'Generic pattern detection',
    });
    totalScore += 50 * 0.3;
  }

  // 3. Detection method confidence
  if (options.method) {
    const methodScore = calculateMethodConfidence(options.method);
    factors.push({
      name: 'method',
      contribution: methodScore * 0.2, // 20% weight
      description: 'Detection method reliability',
    });
    totalScore += methodScore * 0.2;
  } else {
    // Assume basic detection
    factors.push({
      name: 'method',
      contribution: 30 * 0.2,
      description: 'Basic detection method',
    });
    totalScore += 30 * 0.2;
  }

  // 4. Context adjustments (10% weight, can reduce confidence)
  let contextAdjustment = 0;
  if (options.context) {
    if (options.context.isTest) {
      contextAdjustment -= 20; // Less strict in tests
      factors.push({
        name: 'test-file',
        contribution: -20 * 0.1,
        description: 'In test file (less strict)',
      });
    }
    if (options.context.isGenerated) {
      contextAdjustment -= 40; // Much less strict in generated
      factors.push({
        name: 'generated',
        contribution: -40 * 0.1,
        description: 'Generated file (might be intentional)',
      });
    }
    if (options.context.hasTodoComment) {
      contextAdjustment -= 10; // Known issue
      factors.push({
        name: 'todo-comment',
        contribution: -10 * 0.1,
        description: 'Has TODO comment (known issue)',
      });
    }
  }
  totalScore += contextAdjustment * 0.1;

  // Clamp to 0-100
  const finalScore = Math.max(0, Math.min(100, Math.round(totalScore)));

  return {
    score: finalScore,
    level: scoreToConfidenceLevel(finalScore),
    factors,
  };
}

/**
 * Quick confidence calculation for common patterns
 */
export function getPatternConfidence(pattern: string): number {
  return PATTERN_CONFIDENCE[pattern] ?? 50;
}

/**
 * Quick confidence calculation for category
 */
export function getCategoryConfidence(category: QualityCategory): number {
  return CATEGORY_CONFIDENCE[category] ?? 50;
}

/**
 * Check if issue should be shown based on confidence threshold
 */
export function shouldShowIssue(
  confidence: ConfidenceScore,
  threshold: 'high' | 'medium' | 'low' = 'high',
): boolean {
  const thresholdValue = threshold === 'high' ? 80 : threshold === 'medium' ? 60 : 0;
  return confidence.score >= thresholdValue;
}
