/**
 * @module commands/context/formatters/ai/sections/architecture
 * @description Architecture patterns section formatter
 */

import type { AiContextData } from '../../../types';
import { escapeXml } from '../helpers';

/**
 * Format architecture patterns section
 */
export function formatArchitectureSection(lines: string[], data: AiContextData): void {
  const { architecture } = data;
  if (!architecture || architecture.patterns.length === 0) return;

  lines.push(`  <architecture type="${architecture.projectType}">`);

  for (const pattern of architecture.patterns) {
    const tag = pattern.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    lines.push(`    <${tag} count="${pattern.count}">`);
    lines.push(`      <description>${escapeXml(pattern.description)}</description>`);
    lines.push(`      <pattern>${escapeXml(pattern.pattern)}</pattern>`);

    if (pattern.examples.length > 0) {
      lines.push(`      <examples>${pattern.examples.map(escapeXml).join(', ')}</examples>`);
    }

    lines.push(`    </${tag}>`);
  }

  lines.push('  </architecture>');
}
