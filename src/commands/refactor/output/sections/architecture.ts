/**
 * @module commands/refactor/output/sections/architecture
 * @description Architecture health section formatter
 */

import { escapeXml } from '../../../../lib/format';
import type { ArchViolation, EnhancedRefactorAnalysis } from '../../core';
import { deduplicateViolations, sortBySeverity } from '../helpers';

/**
 * Format a single violation
 */
export function formatViolation(lines: string[], v: ArchViolation): void {
  lines.push(`      <violation type="${v.type}" severity="${v.severity}">`);
  lines.push(`        <from>${v.from}</from>`);
  lines.push(`        <to>${v.to}</to>`);
  lines.push(`        <message>${escapeXml(v.message)}</message>`);
  lines.push(`        <fix>${escapeXml(v.fix)}</fix>`);
  lines.push('      </violation>');
}

/**
 * Format architecture health section
 */
export function formatArchitectureHealth(
  lines: string[],
  analysis: EnhancedRefactorAnalysis,
): void {
  const { archHealth } = analysis;

  lines.push(`  <architecture-health score="${archHealth.score}">`);

  // Dependency graph
  lines.push('    <dependency-graph>');
  for (const [node, deps] of Object.entries(archHealth.dependencyGraph)) {
    if (deps.length > 0) {
      lines.push(`      <node name="${node}" depends-on="${deps.join(', ')}" />`);
    } else {
      lines.push(`      <node name="${node}" depends-on="none" />`);
    }
  }
  lines.push('    </dependency-graph>');

  // Layer compliance
  lines.push('    <layer-compliance>');
  for (const [name, compliance] of Object.entries(archHealth.layerCompliance)) {
    lines.push(
      `      <layer name="${name}" expected="${compliance.expected}" compliant="${compliance.compliant}" />`,
    );
  }
  lines.push('    </layer-compliance>');

  // Violations - deduplicated and sorted by severity
  if (archHealth.violations.length > 0) {
    const deduplicated = deduplicateViolations(archHealth.violations);
    const sorted = sortBySeverity(deduplicated);

    lines.push(`    <violations deduplicated="true" sorted-by="severity">`);
    for (const v of sorted) {
      formatViolation(lines, v);
    }
    lines.push('    </violations>');
  }

  lines.push('  </architecture-health>');
  lines.push('');
}
