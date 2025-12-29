/**
 * @module commands/refactor/output/sections/ranking.section
 * @description Ranking section for the registry-based architecture
 *
 * Shows PageRank-based hotspots, coupling metrics, and safe refactoring order.
 */

import { escapeXml } from '../../../../lib/@format';
import type { DependencyHotspot, RankingAnalysis } from '../../analyzers/ranking/types';
import type { Section, SectionContext } from '../registry';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format a hotspot as XML
 */
function formatHotspot(lines: string[], hotspot: DependencyHotspot, indent: string): void {
  lines.push(
    `${indent}<hotspot path="${escapeXml(hotspot.path)}" percentile="${hotspot.percentile}" risk="${hotspot.riskLevel}">`,
  );
  lines.push(
    `${indent}  <metrics pagerank="${hotspot.pageRank.toFixed(4)}" ca="${hotspot.coupling.afferentCoupling}" ce="${hotspot.coupling.efferentCoupling}" instability="${hotspot.coupling.instability.toFixed(2)}" />`,
  );
  lines.push(`${indent}</hotspot>`);
}

// ============================================================================
// SECTION DEFINITION
// ============================================================================

/**
 * Ranking section
 *
 * Renders PageRank-based analysis including hotspots and safe refactoring order.
 */
export const rankingSection: Section = {
  metadata: {
    id: 'ranking',
    name: 'Dependency Ranking',
    description: 'Shows hotspots and safe refactoring order',
    order: 45, // After architecture, before domains
    requires: ['ranking'],
    showWhen: 'has-data',
  },

  shouldRender(ctx: SectionContext): boolean {
    const result = ctx.results.get('ranking');
    return result?.status === 'success' && result.data != null;
  },

  render(lines: string[], ctx: SectionContext): void {
    const result = ctx.results.get('ranking');

    // Handle error case
    if (result?.status === 'error') {
      lines.push('  <ranking status="error">');
      lines.push(`    <error>${escapeXml(result.error ?? 'Unknown error')}</error>`);
      lines.push('  </ranking>');
      lines.push('');
      return;
    }

    const data = result?.data as RankingAnalysis | undefined;

    // Handle no data
    if (!data) {
      lines.push('  <ranking status="no-data" />');
      lines.push('');
      return;
    }

    // Normal rendering
    const { hotspots, safeOrder, stats } = data;

    lines.push('  <!-- RANKING - PageRank-based dependency analysis -->');
    lines.push(
      `  <ranking modules="${stats.nodeCount}" edges="${stats.edgeCount}" cycles="${stats.cycleCount}">`,
    );

    // Hotspots (most critical modules by centrality)
    if (hotspots.length > 0) {
      lines.push('    <!-- HOTSPOTS - Most central modules, refactor with care -->');
      lines.push(`    <hotspots count="${hotspots.length}">`);
      for (const hotspot of hotspots.slice(0, 10)) {
        formatHotspot(lines, hotspot, '      ');
      }
      lines.push('    </hotspots>');
    }

    // Safe refactoring order
    if (safeOrder.phases.length > 0) {
      lines.push('    <!-- SAFE ORDER - Recommended refactoring sequence -->');
      lines.push(`    <safe-order phases="${safeOrder.phases.length}">`);
      for (const phase of safeOrder.phases.slice(0, 5)) {
        const moduleList = phase.modules.slice(0, 5).join(', ');
        const moreCount = phase.modules.length > 5 ? ` +${phase.modules.length - 5} more` : '';
        lines.push(
          `      <phase order="${phase.order}" modules="${phase.modules.length}" risk="${phase.riskLevel}">${moduleList}${moreCount}</phase>`,
        );
      }
      if (safeOrder.phases.length > 5) {
        lines.push(`      <!-- +${safeOrder.phases.length - 5} more phases -->`);
      }
      lines.push('    </safe-order>');
    }

    // Cycles (if any)
    if (safeOrder.cycles.length > 0) {
      lines.push('    <!-- CYCLES - Must break for safe refactoring -->');
      lines.push(`    <cycles count="${safeOrder.cycles.length}">`);
      for (const cycle of safeOrder.cycles.slice(0, 5)) {
        lines.push(`      <cycle>${cycle.join(' → ')}</cycle>`);
      }
      if (safeOrder.cycles.length > 5) {
        lines.push(`      <!-- +${safeOrder.cycles.length - 5} more cycles -->`);
      }
      lines.push('    </cycles>');
    }

    lines.push('  </ranking>');
    lines.push('');
  },
};
