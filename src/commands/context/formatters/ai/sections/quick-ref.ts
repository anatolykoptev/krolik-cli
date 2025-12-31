/**
 * @module commands/context/formatters/ai/sections/quick-ref
 * @description Quick reference section - appears FIRST in context
 *
 * Shows at a glance:
 * - Hot files (critical risk)
 * - Git changes summary
 * - Memory highlights
 * - Recommended next actions
 */

import { generateNextActions } from '../../../helpers/next-actions';
import type { AiContextData } from '../../../types';
import { escapeXml } from '../helpers';

/**
 * Format quick-ref section (~150 tokens)
 *
 * @example
 * <quick-ref>
 *   <hot file="src/core/index.ts" deps="50" risk="critical"/>
 *   <changed n="15" staged="1"/>
 *   <memory>Noise Filter Pipeline, i18n detection</memory>
 *   <next-actions>
 *     <action tool="krolik_review" params="staged:true" priority="1"/>
 *   </next-actions>
 * </quick-ref>
 */
export function formatQuickRefSection(lines: string[], data: AiContextData): void {
  lines.push('<quick-ref>');

  // Hot files from import graph
  if (data.importGraph?.nodes) {
    const hotFiles = data.importGraph.nodes
      .filter((n) => (n.importedBy?.length || 0) > 20)
      .slice(0, 2);

    for (const f of hotFiles) {
      const deps = f.importedBy?.length || 0;
      const risk = deps > 50 ? 'critical' : 'high';
      lines.push(`  <hot file="${escapeXml(f.file)}" deps="${deps}" risk="${risk}"/>`);
    }
  }

  // Git summary
  if (data.git) {
    const changed = data.git.changedFiles.length;
    const staged = data.git.stagedFiles.length;
    if (changed > 0 || staged > 0) {
      lines.push(`  <changed n="${changed}" staged="${staged}"/>`);
    }
  }

  // Memory highlights
  if (data.memories && data.memories.length > 0) {
    const highlights = data.memories
      .slice(0, 3)
      .map((m) => m.title)
      .join(', ');
    lines.push(`  <memory>${escapeXml(highlights)}</memory>`);
  }

  // Next actions
  const actions = generateNextActions({
    git: data.git,
    qualityIssues: data.qualityIssues,
    domains: data.context.domains,
    memory: data.memories,
  });

  if (actions.length > 0) {
    lines.push('  <next-actions>');
    for (const a of actions) {
      const params =
        Object.entries(a.params)
          .map(([k, v]) => `${k}:${v}`)
          .join(' ') || '';
      const paramsAttr = params ? ` params="${params}"` : '';
      lines.push(
        `    <action tool="${a.tool}"${paramsAttr} priority="${a.priority}" reason="${escapeXml(a.reason)}"/>`,
      );
    }
    lines.push('  </next-actions>');
  }

  lines.push('</quick-ref>');
}
