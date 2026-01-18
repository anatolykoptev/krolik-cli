/**
 * @module lib/@ralph/router/history
 * @description History-based model routing adjustments
 *
 * Analyzes past attempts to adjust model selection:
 * - Groups tasks by signature (complexity + tags + files range)
 * - If cheap model failed >50% on similar tasks → raise to mid
 * - If cheap model succeeded >80% on harder tasks → lower to cheap
 * - Minimum 3 samples for decision
 */

import { createHash } from 'node:crypto';
import { getProjectDatabase, prepareStatement } from '@/lib/@storage/database';
import { compareTiers, getModelTier } from './model-tiers';
import type {
  HistoryAdjustment,
  ModelName,
  ModelTier,
  RoutingPattern,
  RoutingPatternRow,
  TaskAttributes,
  TaskSignature,
} from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

const MIN_SAMPLES = 3;
const FAIL_THRESHOLD = 0.5; // >50% failures → escalate
const SUCCESS_THRESHOLD = 0.8; // >80% success → can downgrade

// ============================================================================
// SIGNATURE GENERATION
// ============================================================================

/**
 * Determine files range category
 */
function getFilesRange(filesCount: number): 'few' | 'some' | 'many' {
  if (filesCount <= 2) return 'few';
  if (filesCount <= 5) return 'some';
  return 'many';
}

/**
 * Create a task signature for grouping similar tasks
 */
export function createTaskSignature(task: TaskAttributes): TaskSignature {
  const complexity = task.complexity ?? 'moderate';
  const tags = [...(task.tags ?? [])].sort();
  const filesRange = getFilesRange(task.filesAffected?.length ?? 0);

  // Create hash from signature components
  const signatureStr = JSON.stringify({ complexity, tags, filesRange });
  const hash = createHash('md5').update(signatureStr).digest('hex').slice(0, 12);

  return {
    hash,
    complexity,
    tags,
    filesRange,
  };
}

// ============================================================================
// PATTERN STORAGE
// ============================================================================

/**
 * Get routing patterns for a signature
 */
export function getRoutingPatterns(signatureHash: string, projectPath: string): RoutingPattern[] {
  const db = getProjectDatabase(projectPath);

  const sql = `
    SELECT * FROM ralph_routing_patterns
    WHERE signature_hash = ?
    ORDER BY success_count DESC
  `;

  const stmt = prepareStatement<[string], RoutingPatternRow>(db, sql);
  const rows = stmt.all(signatureHash);

  return rows.map((row) => ({
    signatureHash: row.signature_hash,
    model: row.model as ModelName,
    successCount: row.success_count,
    failCount: row.fail_count,
    avgCost: row.avg_cost,
    lastUpdated: row.last_updated,
  }));
}

/**
 * Update routing pattern with new result
 */
export function updateRoutingPattern(
  signatureHash: string,
  model: ModelName,
  success: boolean,
  cost: number,
  projectPath: string,
): void {
  const db = getProjectDatabase(projectPath);
  const now = new Date().toISOString();

  // Try to update existing pattern
  const updateSql = `
    UPDATE ralph_routing_patterns SET
      success_count = success_count + ?,
      fail_count = fail_count + ?,
      avg_cost = (avg_cost * (success_count + fail_count) + ?) / (success_count + fail_count + 1),
      last_updated = ?
    WHERE signature_hash = ? AND model = ?
  `;

  const updateStmt = prepareStatement<[number, number, number, string, string, string]>(
    db,
    updateSql,
  );
  const result = updateStmt.run(success ? 1 : 0, success ? 0 : 1, cost, now, signatureHash, model);

  // If no row was updated, insert new one
  if (result.changes === 0) {
    const insertSql = `
      INSERT INTO ralph_routing_patterns (signature_hash, model, success_count, fail_count, avg_cost, last_updated)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const insertStmt = prepareStatement<[string, string, number, number, number, string]>(
      db,
      insertSql,
    );
    insertStmt.run(signatureHash, model, success ? 1 : 0, success ? 0 : 1, cost, now);
  }
}

// ============================================================================
// HISTORY ANALYSIS
// ============================================================================

/**
 * Analyze history and suggest tier adjustment
 */
export function analyzeHistory(
  task: TaskAttributes,
  currentTier: ModelTier,
  projectPath: string,
): HistoryAdjustment | null {
  const signature = createTaskSignature(task);
  const patterns = getRoutingPatterns(signature.hash, projectPath);

  if (patterns.length === 0) {
    return null; // No history for this signature
  }

  // Group patterns by tier
  const tierStats = new Map<ModelTier, { success: number; fail: number }>();

  for (const pattern of patterns) {
    const tier = getModelTier(pattern.model);
    const stats = tierStats.get(tier) ?? { success: 0, fail: 0 };
    stats.success += pattern.successCount;
    stats.fail += pattern.failCount;
    tierStats.set(tier, stats);
  }

  // Check if we should escalate from cheap
  if (currentTier === 'cheap') {
    const cheapStats = tierStats.get('cheap');
    if (cheapStats) {
      const total = cheapStats.success + cheapStats.fail;
      if (total >= MIN_SAMPLES) {
        const failRate = cheapStats.fail / total;
        if (failRate > FAIL_THRESHOLD) {
          return {
            originalTier: 'cheap',
            adjustedTier: 'mid',
            reason: `Cheap models failed ${Math.round(failRate * 100)}% on similar tasks`,
            confidence: Math.min(1, total / 10), // Higher confidence with more samples
          };
        }
      }
    }
  }

  // Check if we can downgrade from mid to cheap
  if (currentTier === 'mid') {
    const cheapStats = tierStats.get('cheap');
    if (cheapStats) {
      const total = cheapStats.success + cheapStats.fail;
      if (total >= MIN_SAMPLES) {
        const successRate = cheapStats.success / total;
        if (successRate > SUCCESS_THRESHOLD) {
          return {
            originalTier: 'mid',
            adjustedTier: 'cheap',
            reason: `Cheap models succeeded ${Math.round(successRate * 100)}% on similar tasks`,
            confidence: Math.min(1, total / 10),
          };
        }
      }
    }
  }

  return null;
}

/**
 * Get best model for a signature based on history
 */
export function getBestModelFromHistory(
  signatureHash: string,
  minTier: ModelTier,
  projectPath: string,
): ModelName | null {
  const patterns = getRoutingPatterns(signatureHash, projectPath);

  // Filter to patterns with enough samples
  const validPatterns = patterns.filter((p) => {
    const total = p.successCount + p.failCount;
    const tier = getModelTier(p.model);
    return total >= MIN_SAMPLES && compareTiers(tier, minTier) >= 0;
  });

  if (validPatterns.length === 0) {
    return null;
  }

  // Sort by success rate (descending), then by cost (ascending)
  validPatterns.sort((a, b) => {
    const aTotal = a.successCount + a.failCount;
    const bTotal = b.successCount + b.failCount;
    const aSuccessRate = a.successCount / aTotal;
    const bSuccessRate = b.successCount / bTotal;

    if (bSuccessRate !== aSuccessRate) {
      return bSuccessRate - aSuccessRate;
    }
    return a.avgCost - b.avgCost;
  });

  const bestPattern = validPatterns[0];
  return bestPattern ? bestPattern.model : null;
}

// ============================================================================
// STATISTICS
// ============================================================================

/**
 * Get routing statistics for a project
 */
export function getRoutingStats(projectPath: string): {
  totalPatterns: number;
  patternsWithSufficientData: number;
  modelDistribution: Record<ModelName, { success: number; fail: number }>;
  avgEscalationRate: number;
} {
  const db = getProjectDatabase(projectPath);

  // Total patterns
  const totalSql = 'SELECT COUNT(*) as count FROM ralph_routing_patterns';
  const totalStmt = prepareStatement<[], { count: number }>(db, totalSql);
  const totalRow = totalStmt.get();
  const totalPatterns = totalRow?.count ?? 0;

  // Patterns with sufficient data
  const sufficientSql = `
    SELECT COUNT(*) as count FROM ralph_routing_patterns
    WHERE success_count + fail_count >= ?
  `;
  const sufficientStmt = prepareStatement<[number], { count: number }>(db, sufficientSql);
  const sufficientRow = sufficientStmt.get(MIN_SAMPLES);
  const patternsWithSufficientData = sufficientRow?.count ?? 0;

  // Model distribution
  const distSql = `
    SELECT model, SUM(success_count) as success, SUM(fail_count) as fail
    FROM ralph_routing_patterns
    GROUP BY model
  `;
  const distStmt = prepareStatement<[], { model: string; success: number; fail: number }>(
    db,
    distSql,
  );
  const distRows = distStmt.all();

  const modelDistribution: Record<ModelName, { success: number; fail: number }> = {} as Record<
    ModelName,
    { success: number; fail: number }
  >;
  for (const row of distRows) {
    modelDistribution[row.model as ModelName] = {
      success: row.success ?? 0,
      fail: row.fail ?? 0,
    };
  }

  // Escalation rate (attempts with escalated_from set)
  const escalationSql = `
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN escalated_from IS NOT NULL THEN 1 ELSE 0 END) as escalated
    FROM ralph_attempts
  `;
  const escalationStmt = prepareStatement<[], { total: number; escalated: number }>(
    db,
    escalationSql,
  );
  const escalationRow = escalationStmt.get();
  const avgEscalationRate =
    escalationRow && escalationRow.total > 0 ? escalationRow.escalated / escalationRow.total : 0;

  return {
    totalPatterns,
    patternsWithSufficientData,
    modelDistribution,
    avgEscalationRate,
  };
}
