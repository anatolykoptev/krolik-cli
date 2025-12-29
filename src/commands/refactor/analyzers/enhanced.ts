/**
 * @module commands/refactor/analyzers/enhanced
 * @description Enhanced AI-native analysis
 *
 * Creates comprehensive analysis with project context, architecture health,
 * domain classification, AI navigation hints, and prioritized recommendations.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { analyzeRoutes, type RoutesOutput } from '../../routes';
import type {
  ArchHealth,
  EnhancedMigrationAction,
  EnhancedMigrationPlan,
  EnhancedRefactorAnalysis,
  FileSizeAnalysis,
  MigrationPlan,
  RefactorAnalysis,
  ReusableModulesInfo,
} from '../core';
import { analyzeArchHealth } from './architecture/architecture';
import { classifyDomains } from './architecture/domains';
import { detectProjectContext } from './context/context';
import { generateAiNavigation } from './context/navigation';
import { analyzeFileSizes } from './metrics/file-size';
import { generateRecommendations } from './metrics/recommendations';
import { analyzeReusableModules } from './metrics/reusable';
import type { I18nAnalysisResult } from './modules/i18n.analyzer';
import { analyzeRanking, type RankingAnalysis } from './ranking/index';

// ============================================================================
// API ROUTERS DISCOVERY
// ============================================================================

/**
 * Common tRPC router directory locations to check
 */
const ROUTER_CANDIDATES = [
  'packages/api/src/routers', // Monorepo
  'src/server/routers', // Next.js
  'src/routers', // Simple
  'server/routers', // Alternative
  'src/trpc/routers', // tRPC specific
];

/**
 * Find tRPC routers directory in the project
 */
function findRoutersDir(projectRoot: string): string | null {
  for (const candidate of ROUTER_CANDIDATES) {
    const fullPath = path.join(projectRoot, candidate);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }
  return null;
}

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
 * Options for enhanced analysis
 */
export interface EnhancedAnalysisOptions {
  /** Include reusable modules analysis (default: true) */
  includeReusable?: boolean;
  /** Include file size analysis (default: true) */
  includeFileSize?: boolean;
  /** Include PageRank-based ranking analysis (default: true) */
  includeRanking?: boolean;
  /** Include i18n hardcoded strings analysis (default: true in deep mode) */
  includeI18n?: boolean;
  /** Include API routes analysis (default: true in deep mode) */
  includeApi?: boolean;
  /** Quick mode: only ranking, skip slow analyses (default: false) */
  quickMode?: boolean;
}

/**
 * Create enhanced AI-native refactor analysis
 */
export async function createEnhancedAnalysis(
  baseAnalysis: RefactorAnalysis,
  projectRoot: string,
  targetPath: string,
  options: EnhancedAnalysisOptions = {},
): Promise<EnhancedRefactorAnalysis> {
  const {
    includeReusable = true,
    includeFileSize = true,
    includeRanking = true,
    // includeI18n - now handled via registry-based analyzer system
    includeApi = true,
    quickMode = false,
  } = options;

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

  // Analyze reusable modules (skip in quick mode)
  let reusableModules: ReusableModulesInfo | undefined;
  if (includeReusable && !quickMode) {
    try {
      reusableModules = await analyzeReusableModules(projectRoot, targetPath);
    } catch {
      // Silently skip if reusable analysis fails
    }
  }

  // Analyze file sizes (skip in quick mode)
  let fileSizeAnalysis: FileSizeAnalysis | undefined;
  if (includeFileSize && !quickMode) {
    try {
      fileSizeAnalysis = analyzeFileSizes(targetPath, projectRoot);
    } catch {
      // Silently skip if file size analysis fails
    }
  }

  // Analyze PageRank-based ranking (hotspots, coupling, safe order)
  let rankingAnalysis: RankingAnalysis | undefined;
  if (includeRanking && Object.keys(archHealth.dependencyGraph).length > 0) {
    try {
      rankingAnalysis = analyzeRanking(archHealth.dependencyGraph);
    } catch {
      // Silently skip if ranking analysis fails
    }
  }

  // Note: i18n analysis is now handled via the registry-based analyzer system
  // See: analyzers/modules/i18n.analyzer.ts
  const i18nAnalysis: I18nAnalysisResult | undefined = undefined;

  // Analyze API routes (skip in quick mode)
  let apiAnalysis: RoutesOutput | undefined;
  if (includeApi && !quickMode) {
    try {
      const routersDir = findRoutersDir(projectRoot);
      if (routersDir) {
        apiAnalysis = analyzeRoutes(routersDir);
        // Only include if there are routers
        if (apiAnalysis.routers.length === 0) {
          apiAnalysis = undefined;
        }
      }
    } catch {
      // Silently skip if API analysis fails
    }
  }

  const result: EnhancedRefactorAnalysis = {
    ...baseAnalysis,
    projectContext,
    archHealth,
    domains,
    aiNavigation,
    enhancedMigration,
    recommendations,
  };

  if (reusableModules) {
    result.reusableModules = reusableModules;
  }

  if (fileSizeAnalysis && fileSizeAnalysis.issues.length > 0) {
    result.fileSizeAnalysis = fileSizeAnalysis;
  }

  if (rankingAnalysis) {
    result.rankingAnalysis = rankingAnalysis;
  }

  if (i18nAnalysis) {
    result.i18nAnalysis = i18nAnalysis;
  }

  if (apiAnalysis) {
    result.apiAnalysis = apiAnalysis;
  }

  return result;
}
