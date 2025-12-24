/**
 * @module commands/fix/reporter/effort
 * @description Effort estimation for code quality issues
 */

import type { QualityIssue, QualityCategory, FixDifficulty } from '../types';
import { getFixDifficulty } from '../types';
import type { EffortEstimate, EffortLevel } from './types';

// ============================================================================
// EFFORT ESTIMATION RULES
// ============================================================================

/**
 * Base effort by category (in minutes)
 */
const CATEGORY_BASE_EFFORT: Record<QualityCategory, number> = {
  lint: 2,              // Simple delete/replace
  'type-safety': 10,    // May need type analysis
  hardcoded: 5,         // Extract to constant
  documentation: 5,     // Add JSDoc
  complexity: 20,       // May need refactoring
  srp: 30,              // File splitting
  'mixed-concerns': 25, // Separation of concerns
  size: 40,             // Large refactoring
  'circular-dep': 30,   // Dependency restructuring
  composite: 15,        // Multi-file operation
  agent: 20,            // AI-assisted fix
  refine: 35,           // @namespace structure migration
};

/**
 * Multipliers based on severity
 */
const SEVERITY_MULTIPLIER: Record<string, number> = {
  error: 1.5,
  warning: 1.0,
  info: 0.7,
};

/**
 * Multipliers based on difficulty
 */
const DIFFICULTY_MULTIPLIER: Record<FixDifficulty, number> = {
  trivial: 0.5,
  safe: 1.0,
  risky: 2.0,
};

// ============================================================================
// ESTIMATION LOGIC
// ============================================================================

/**
 * Estimate effort for a single issue
 */
export function estimateEffort(issue: QualityIssue): EffortEstimate {
  const difficulty = getFixDifficulty(issue);
  const baseMinutes = CATEGORY_BASE_EFFORT[issue.category];
  const severityMult = SEVERITY_MULTIPLIER[issue.severity] ?? 1.0;
  const difficultyMult = DIFFICULTY_MULTIPLIER[difficulty];

  // Calculate raw minutes
  let minutes = Math.round(baseMinutes * severityMult * difficultyMult);

  // Apply message-based adjustments
  minutes = adjustByMessage(issue, minutes);

  // Determine level
  const level = getEffortLevel(minutes);
  const timeLabel = formatTimeLabel(minutes);
  const reason = generateReason(issue, difficulty);

  return {
    level,
    minutes,
    timeLabel,
    reason,
  };
}

/**
 * Adjust effort based on message content
 */
function adjustByMessage(issue: QualityIssue, baseMinutes: number): number {
  const msg = issue.message.toLowerCase();

  // Quick fixes
  if (msg.includes('console.log') || msg.includes('debugger')) {
    return Math.min(baseMinutes, 2);
  }
  if (msg.includes('@ts-ignore') || msg.includes('@ts-nocheck')) {
    return Math.min(baseMinutes, 5);
  }

  // Medium fixes
  if (msg.includes('magic number') || msg.includes('hardcoded')) {
    return Math.max(baseMinutes, 5);
  }
  if (msg.includes('missing jsdoc') || msg.includes('missing documentation')) {
    return 5;
  }

  // Complex fixes
  if (msg.includes('too many') || msg.includes('exceeds')) {
    return Math.max(baseMinutes, 20);
  }
  if (msg.includes('split') || msg.includes('extract')) {
    return Math.max(baseMinutes, 30);
  }
  if (msg.includes('circular') || msg.includes('cycle')) {
    return Math.max(baseMinutes, 45);
  }

  return baseMinutes;
}

/**
 * Determine effort level from minutes
 */
function getEffortLevel(minutes: number): EffortLevel {
  if (minutes <= 5) return 'trivial';
  if (minutes <= 15) return 'small';
  if (minutes <= 30) return 'medium';
  if (minutes <= 60) return 'large';
  return 'complex';
}

/**
 * Format minutes as human-readable time
 */
function formatTimeLabel(minutes: number): string {
  if (minutes < 1) return '<1 min';
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}min`;
}

/**
 * Generate reason for effort estimate
 */
function generateReason(issue: QualityIssue, difficulty: FixDifficulty): string {
  const parts: string[] = [];

  // Category-based reason
  switch (issue.category) {
    case 'lint':
      parts.push('Simple code removal/replacement');
      break;
    case 'type-safety':
      parts.push('Type annotation changes');
      break;
    case 'hardcoded':
      parts.push('Extract to named constant');
      break;
    case 'documentation':
      parts.push('Add documentation');
      break;
    case 'complexity':
      parts.push('Function refactoring needed');
      break;
    case 'srp':
      parts.push('File splitting required');
      break;
    case 'mixed-concerns':
      parts.push('Separate business logic from UI');
      break;
    case 'size':
      parts.push('Large file restructuring');
      break;
    case 'circular-dep':
      parts.push('Dependency graph restructuring');
      break;
    default:
      parts.push('Code modification required');
  }

  // Difficulty modifier
  if (difficulty === 'risky') {
    parts.push('may affect other code');
  } else if (difficulty === 'trivial') {
    parts.push('safe to auto-fix');
  }

  return parts.join(', ');
}

// ============================================================================
// AGGREGATE EFFORT
// ============================================================================

/**
 * Calculate total effort for multiple issues
 */
export function aggregateEffort(estimates: EffortEstimate[]): EffortEstimate {
  if (estimates.length === 0) {
    return {
      level: 'trivial',
      minutes: 0,
      timeLabel: '0 min',
      reason: 'No issues',
    };
  }

  const totalMinutes = estimates.reduce((sum, e) => sum + e.minutes, 0);
  const level = getEffortLevel(totalMinutes);
  const timeLabel = formatTimeLabel(totalMinutes);

  return {
    level,
    minutes: totalMinutes,
    timeLabel,
    reason: `Total for ${estimates.length} issues`,
  };
}
