/**
 * @module commands/refactor/output/sections/architecture.section
 * @description Architecture health section for the registry-based architecture
 *
 * Shows architecture health score, layer violations, circular dependencies,
 * and dependency graph structure.
 */

import { escapeXml } from '../../../../lib/@format';
import type { ArchHealth, ArchViolation } from '../../core';
import type { Section, SectionContext } from '../registry';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format a violation as XML
 */
function formatViolation(lines: string[], violation: ArchViolation, indent: string): void {
  lines.push(`${indent}<violation type="${violation.type}" severity="${violation.severity}">`);
  lines.push(`${indent}  <from>${escapeXml(violation.from)}</from>`);
  lines.push(`${indent}  <to>${escapeXml(violation.to)}</to>`);
  lines.push(`${indent}  <message>${escapeXml(violation.message)}</message>`);
  lines.push(`${indent}  <fix>${escapeXml(violation.fix)}</fix>`);
  lines.push(`${indent}</violation>`);
}

// ============================================================================
// SECTION DEFINITION
// ============================================================================

/**
 * Architecture health section
 *
 * Renders architecture health score, violations, and dependency structure.
 * Critical for understanding codebase architecture issues.
 */
export const architectureSection: Section = {
  metadata: {
    id: 'architecture',
    name: 'Architecture Health',
    description: 'Shows architecture score, violations, and dependencies',
    order: 40, // Mid-level - architecture analysis
    requires: ['architecture'],
    showWhen: 'always',
  },

  shouldRender(ctx: SectionContext): boolean {
    const result = ctx.results.get('architecture');
    return result?.status !== 'skipped';
  },

  render(lines: string[], ctx: SectionContext): void {
    const result = ctx.results.get('architecture');

    // Handle error case
    if (result?.status === 'error') {
      lines.push('  <architecture-health status="error">');
      lines.push(`    <error>${escapeXml(result.error ?? 'Unknown error')}</error>`);
      lines.push('  </architecture-health>');
      lines.push('');
      return;
    }

    const data = result?.data as ArchHealth | undefined;

    // Handle no data
    if (!data) {
      lines.push('  <architecture-health status="no-data" />');
      lines.push('');
      return;
    }

    // Healthy state - no violations
    if (data.violations.length === 0) {
      lines.push('  <!-- Architecture health: no violations detected -->');
      lines.push(`  <architecture-health score="${data.score}" violations="0" status="healthy" />`);
      lines.push('');
      return;
    }

    // Normal rendering with violations
    const errors = data.violations.filter((v) => v.severity === 'error');
    const warnings = data.violations.filter((v) => v.severity === 'warning');
    const circular = data.violations.filter((v) => v.type === 'circular');
    const layerViolations = data.violations.filter((v) => v.type === 'layer-violation');

    lines.push('  <!-- ARCHITECTURE HEALTH - Layer and dependency analysis -->');
    lines.push(
      `  <architecture-health score="${data.score}" violations="${data.violations.length}" errors="${errors.length}" warnings="${warnings.length}">`,
    );

    // Circular dependencies (most critical)
    if (circular.length > 0) {
      lines.push('    <!-- CIRCULAR DEPENDENCIES - Must be broken -->');
      lines.push(`    <circular-dependencies count="${circular.length}">`);
      for (const v of circular.slice(0, 10)) {
        formatViolation(lines, v, '      ');
      }
      if (circular.length > 10) {
        lines.push(`      <!-- +${circular.length - 10} more circular dependencies -->`);
      }
      lines.push('    </circular-dependencies>');
    }

    // Layer violations
    if (layerViolations.length > 0) {
      lines.push('    <!-- LAYER VIOLATIONS - Clean Architecture breaches -->');
      lines.push(`    <layer-violations count="${layerViolations.length}">`);
      for (const v of layerViolations.slice(0, 10)) {
        formatViolation(lines, v, '      ');
      }
      if (layerViolations.length > 10) {
        lines.push(`      <!-- +${layerViolations.length - 10} more layer violations -->`);
      }
      lines.push('    </layer-violations>');
    }

    // Dependency graph summary
    const graphNodes = Object.keys(data.dependencyGraph).length;
    const graphEdges = Object.values(data.dependencyGraph).reduce(
      (sum, deps) => sum + deps.length,
      0,
    );

    lines.push('    <dependency-graph>');
    lines.push(`      <nodes>${graphNodes}</nodes>`);
    lines.push(`      <edges>${graphEdges}</edges>`);
    lines.push('    </dependency-graph>');

    lines.push('  </architecture-health>');
    lines.push('');
  },
};
