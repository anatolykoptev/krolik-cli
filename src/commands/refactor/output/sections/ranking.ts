/**
 * @module commands/refactor/output/sections/ranking
 * @description Ranking analysis section formatter (hotspots, coupling, safe order)
 *
 * Formats PageRank-based analysis results:
 * - Dependency hotspots (high centrality modules)
 * - Coupling metrics (Ca, Ce, Instability)
 * - Safe refactoring order (topological phases)
 */

import { escapeXml } from '../../../../lib/format';
import type {
  CouplingMetrics,
  DependencyHotspot,
  RefactoringPhase,
  SafeRefactoringOrder,
} from '../../analyzers/ranking/types';
import type { EnhancedRefactorAnalysis } from '../../core';

// ============================================================================
// HOTSPOTS FORMATTING
// ============================================================================

/**
 * Format a single hotspot
 */
export function formatHotspot(lines: string[], hotspot: DependencyHotspot): void {
  lines.push(
    `    <hotspot path="${escapeXml(hotspot.path)}" pagerank="${hotspot.pageRank}" risk="${hotspot.riskLevel}">`,
  );
  lines.push(`      <percentile>${hotspot.percentile}</percentile>`);
  lines.push(`      <dependents count="${hotspot.dependentCount}" />`);
  lines.push(`      <dependencies count="${hotspot.dependencyCount}" />`);
  lines.push(
    `      <coupling Ca="${hotspot.coupling.afferentCoupling}" Ce="${hotspot.coupling.efferentCoupling}" instability="${hotspot.coupling.instability}" />`,
  );
  lines.push(`      <reason>${escapeXml(hotspot.reason)}</reason>`);
  lines.push('    </hotspot>');
}

/**
 * Format hotspots section
 */
export function formatHotspots(lines: string[], hotspots: DependencyHotspot[]): void {
  if (hotspots.length === 0) {
    lines.push('  <dependency-hotspots count="0" />');
    lines.push('');
    return;
  }

  const criticalCount = hotspots.filter((h) => h.riskLevel === 'critical').length;
  const highCount = hotspots.filter((h) => h.riskLevel === 'high').length;

  lines.push(
    `  <dependency-hotspots count="${hotspots.length}" critical="${criticalCount}" high="${highCount}">`,
  );

  for (const hotspot of hotspots.slice(0, 10)) {
    formatHotspot(lines, hotspot);
  }

  if (hotspots.length > 10) {
    lines.push(`    <!-- +${hotspots.length - 10} more hotspots -->`);
  }

  lines.push('  </dependency-hotspots>');
  lines.push('');
}

// ============================================================================
// COUPLING FORMATTING
// ============================================================================

/**
 * Format coupling metrics section
 */
export function formatCouplingMetrics(lines: string[], metrics: CouplingMetrics[]): void {
  if (metrics.length === 0) {
    lines.push('  <coupling-analysis count="0" />');
    lines.push('');
    return;
  }

  // Only show modules with significant coupling
  const significant = metrics.filter((m) => m.afferentCoupling > 0 || m.efferentCoupling > 1);

  if (significant.length === 0) {
    lines.push('  <coupling-analysis count="0" note="no significant coupling detected" />');
    lines.push('');
    return;
  }

  // Calculate averages
  const avgInstability =
    significant.reduce((sum, m) => sum + m.instability, 0) / significant.length;
  const avgRisk = significant.reduce((sum, m) => sum + m.riskScore, 0) / significant.length;

  lines.push(
    `  <coupling-analysis count="${significant.length}" avg-instability="${avgInstability.toFixed(2)}" avg-risk="${avgRisk.toFixed(2)}">`,
  );

  // Top 10 by risk score
  const topByRisk = [...significant].sort((a, b) => b.riskScore - a.riskScore).slice(0, 10);

  for (const m of topByRisk) {
    lines.push(
      `    <module path="${escapeXml(m.path)}" Ca="${m.afferentCoupling}" Ce="${m.efferentCoupling}" instability="${m.instability}" risk="${m.riskScore.toFixed(2)}" />`,
    );
  }

  if (significant.length > 10) {
    lines.push(`    <!-- +${significant.length - 10} more modules -->`);
  }

  lines.push('  </coupling-analysis>');
  lines.push('');
}

// ============================================================================
// SAFE ORDER FORMATTING
// ============================================================================

/**
 * Format a single refactoring phase
 */
export function formatPhase(lines: string[], phase: RefactoringPhase): void {
  const attrs = [
    `order="${phase.order}"`,
    `category="${phase.category}"`,
    `risk="${phase.riskLevel}"`,
    phase.canParallelize ? 'parallelize="true"' : 'parallelize="false"',
  ];

  if (phase.prerequisites.length > 0) {
    attrs.push(`after="${phase.prerequisites.join(',')}"`);
  }

  lines.push(`    <phase ${attrs.join(' ')}>`);

  for (const module of phase.modules) {
    lines.push(`      <module>${escapeXml(module)}</module>`);
  }

  lines.push('    </phase>');
}

/**
 * Format safe refactoring order section
 */
export function formatSafeOrder(lines: string[], safeOrder: SafeRefactoringOrder): void {
  if (safeOrder.phases.length === 0) {
    lines.push('  <safe-refactor-order phases="0" />');
    lines.push('');
    return;
  }

  lines.push(
    `  <safe-refactor-order phases="${safeOrder.phases.length}" modules="${safeOrder.totalModules}" risk="${safeOrder.estimatedRisk}">`,
  );

  // Summary
  lines.push(
    `    <summary leaf-nodes="${safeOrder.leafNodes.length}" core-nodes="${safeOrder.coreNodes.length}" cycles="${safeOrder.cycles.length}" />`,
  );

  // Phases (limit to first 10)
  lines.push('    <phases>');
  for (const phase of safeOrder.phases.slice(0, 10)) {
    formatPhase(lines, phase);
  }
  if (safeOrder.phases.length > 10) {
    lines.push(`      <!-- +${safeOrder.phases.length - 10} more phases -->`);
  }
  lines.push('    </phases>');

  // Cycles (if any)
  if (safeOrder.cycles.length > 0) {
    lines.push('    <cycles note="must refactor together">');
    for (const cycle of safeOrder.cycles.slice(0, 5)) {
      lines.push(`      <cycle>${cycle.map(escapeXml).join(' → ')}</cycle>`);
    }
    if (safeOrder.cycles.length > 5) {
      lines.push(`      <!-- +${safeOrder.cycles.length - 5} more cycles -->`);
    }
    lines.push('    </cycles>');
  }

  lines.push('  </safe-refactor-order>');
  lines.push('');
}

// ============================================================================
// MAIN FORMATTER
// ============================================================================

/**
 * Format complete ranking analysis section
 */
export function formatRankingAnalysis(lines: string[], analysis: EnhancedRefactorAnalysis): void {
  const ranking = analysis.rankingAnalysis;

  if (!ranking) {
    return;
  }

  // Add ranking stats
  lines.push(
    `  <!-- PageRank Analysis: ${ranking.stats.nodeCount} nodes, ${ranking.stats.edgeCount} edges, ${ranking.stats.iterations} iterations${ranking.stats.converged ? ' (converged)' : ''} -->`,
  );
  lines.push('');

  // Hotspots
  formatHotspots(lines, ranking.hotspots);

  // Coupling metrics
  formatCouplingMetrics(lines, ranking.couplingMetrics);

  // Safe refactoring order
  formatSafeOrder(lines, ranking.safeOrder);
}
