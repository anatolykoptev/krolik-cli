/**
 * @module commands/refactor/analyzers/enhanced
 * @description Enhanced AI-native analysis
 *
 * Creates comprehensive analysis with project context, architecture health,
 * domain classification, AI navigation hints, and prioritized recommendations.
 */

import type {
  ArchHealth,
  EnhancedMigrationAction,
  EnhancedMigrationPlan,
  EnhancedRefactorAnalysis,
  MigrationPlan,
  RefactorAnalysis,
} from '../core';
import { analyzeArchHealth } from './architecture';
import { detectProjectContext } from './context';
import { classifyDomains } from './domains';
import { generateAiNavigation } from './navigation';
import { generateRecommendations } from './recommendations';

// ============================================================================
// ENHANCED MIGRATION PLAN
// ============================================================================

/**
 * Create enhanced migration plan with ordering and dependencies
 */
export function createEnhancedMigrationPlan(
  basePlan: MigrationPlan,
  _archHealth: ArchHealth,
): EnhancedMigrationPlan {
  const enhancedActions: EnhancedMigrationAction[] = [];
  const executionOrder: EnhancedMigrationPlan['executionOrder'] = [];
  const rollbackPoints: string[] = [];

  let order = 1;

  // First: create-barrel actions (safe, can be rolled back)
  for (const action of basePlan.actions.filter((a) => a.type === 'create-barrel')) {
    const id = `act-${order}`;
    enhancedActions.push({
      ...action,
      id,
      order,
      prerequisite: [],
      reason: 'Create barrel export for clean imports',
      affectedDetails: action.affectedImports.map((f) => ({ file: f, importCount: 1 })),
    });
    executionOrder.push({ step: order, actionId: id, canParallelize: true });
    rollbackPoints.push(`after-${id}`);
    order++;
  }

  // Second: move actions (need import updates)
  const moveActions = basePlan.actions.filter((a) => a.type === 'move');
  for (const action of moveActions) {
    const id = `act-${order}`;
    enhancedActions.push({
      ...action,
      id,
      order,
      prerequisite: [],
      reason: action.target
        ? `Move to correct namespace (${action.target})`
        : 'Reorganize file location',
      affectedDetails: action.affectedImports.map((f) => ({ file: f, importCount: 1 })),
    });
    executionOrder.push({ step: order, actionId: id, canParallelize: false });
    order++;
  }

  // Third: merge actions (depend on moves)
  const mergeActions = basePlan.actions.filter((a) => a.type === 'merge');
  const moveIds = enhancedActions.filter((a) => a.type === 'move').map((a) => a.id);
  for (const action of mergeActions) {
    const id = `act-${order}`;
    enhancedActions.push({
      ...action,
      id,
      order,
      prerequisite: moveIds.length > 0 ? [moveIds[moveIds.length - 1]!] : [],
      reason: 'Consolidate duplicate functions',
      affectedDetails: action.affectedImports.map((f) => ({ file: f, importCount: 1 })),
    });
    executionOrder.push({ step: order, actionId: id, canParallelize: false });
    rollbackPoints.push(`after-${id}`);
    order++;
  }

  // Fourth: delete actions (last, depend on merges)
  for (const action of basePlan.actions.filter((a) => a.type === 'delete')) {
    const id = `act-${order}`;
    const mergeIds = enhancedActions.filter((a) => a.type === 'merge').map((a) => a.id);
    enhancedActions.push({
      ...action,
      id,
      order,
      prerequisite: mergeIds,
      reason: 'Remove duplicate after consolidation',
      affectedDetails: [],
    });
    executionOrder.push({ step: order, actionId: id, canParallelize: true });
    order++;
  }

  return {
    ...basePlan,
    actions: enhancedActions,
    executionOrder,
    rollbackPoints,
  };
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Create enhanced AI-native refactor analysis
 */
export function createEnhancedAnalysis(
  baseAnalysis: RefactorAnalysis,
  projectRoot: string,
  targetPath: string,
): EnhancedRefactorAnalysis {
  // Detect project context
  const projectContext = detectProjectContext(projectRoot);

  // Analyze architecture health
  const archHealth = analyzeArchHealth(targetPath, projectRoot);

  // Classify domains
  const domains = classifyDomains(targetPath);

  // Generate AI navigation hints
  const aiNavigation = generateAiNavigation(projectContext, targetPath);

  // Generate recommendations
  const recommendations = generateRecommendations(baseAnalysis, archHealth, domains);

  // Create enhanced migration plan
  const enhancedMigration = createEnhancedMigrationPlan(baseAnalysis.migration, archHealth);

  return {
    ...baseAnalysis,
    projectContext,
    archHealth,
    domains,
    aiNavigation,
    enhancedMigration,
    recommendations,
  };
}
