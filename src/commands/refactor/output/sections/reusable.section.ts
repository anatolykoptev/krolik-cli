/**
 * @module commands/refactor/output/sections/reusable.section
 * @description Reusable modules section for the registry-based architecture
 *
 * Shows discovered reusable modules, their categories, and reusability scores.
 */

import { escapeXml } from '../../../../lib/@format';
import type { ReusableModuleSummary, ReusableModulesInfo } from '../../core/types-ai';
import type { Section, SectionContext } from '../registry';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format a reusable module as XML
 */
function formatModule(lines: string[], mod: ReusableModuleSummary, indent: string): void {
  lines.push(
    `${indent}<module path="${escapeXml(mod.path)}" name="${escapeXml(mod.name)}" level="${mod.level}" score="${mod.score}">`,
  );
  lines.push(
    `${indent}  <stats exports="${mod.exportCount}" imported-by="${mod.importedByCount}" />`,
  );
  if (mod.description) {
    lines.push(`${indent}  <description>${escapeXml(mod.description)}</description>`);
  }
  lines.push(`${indent}</module>`);
}

// ============================================================================
// SECTION DEFINITION
// ============================================================================

/**
 * Reusable modules section
 *
 * Renders discovered reusable modules with their categories and scores.
 */
export const reusableSection: Section = {
  metadata: {
    id: 'reusable',
    name: 'Reusable Modules',
    description: 'Shows discovered reusable modules and their scores',
    order: 85, // Near the end
    requires: ['reusable'],
    showWhen: 'has-data',
  },

  shouldRender(ctx: SectionContext): boolean {
    const result = ctx.results.get('reusable');
    return result?.status === 'success' && result.data != null;
  },

  render(lines: string[], ctx: SectionContext): void {
    const result = ctx.results.get('reusable');

    // Handle error case
    if (result?.status === 'error') {
      lines.push('  <reusable-modules status="error">');
      lines.push(`    <error>${escapeXml(result.error ?? 'Unknown error')}</error>`);
      lines.push('  </reusable-modules>');
      lines.push('');
      return;
    }

    const data = result?.data as ReusableModulesInfo | undefined;

    // Handle no data
    if (!data) {
      lines.push('  <reusable-modules status="no-data" />');
      lines.push('');
      return;
    }

    // No modules found
    if (data.totalModules === 0) {
      lines.push('  <reusable-modules total="0" status="none-found" />');
      lines.push('');
      return;
    }

    // Normal rendering
    lines.push('  <!-- REUSABLE MODULES - Candidates for sharing or promoting to libraries -->');
    lines.push(
      `  <reusable-modules total="${data.totalModules}" exports="${data.totalExports}" scan-time="${data.scanDurationMs}ms">`,
    );

    // Top modules (core + high reusability)
    if (data.topModules.length > 0) {
      lines.push('    <!-- TOP MODULES - Highest reusability potential -->');
      lines.push(`    <top-modules count="${data.topModules.length}">`);
      for (const mod of data.topModules.slice(0, 10)) {
        formatModule(lines, mod, '      ');
      }
      if (data.topModules.length > 10) {
        lines.push(`      <!-- +${data.topModules.length - 10} more top modules -->`);
      }
      lines.push('    </top-modules>');
    }

    // Category summary
    lines.push('    <by-category>');
    const categories = Object.entries(data.byCategory) as [string, ReusableModuleSummary[]][];
    for (const [category, modules] of categories) {
      if (modules.length > 0) {
        lines.push(`      <${category} count="${modules.length}" />`);
      }
    }
    lines.push('    </by-category>');

    lines.push('  </reusable-modules>');
    lines.push('');
  },
};
