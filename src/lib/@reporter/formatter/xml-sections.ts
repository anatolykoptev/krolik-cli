/**
 * @module lib/@reporter/formatter/xml-sections
 * @description XML section formatters for AI Report
 */

import { escapeXml } from '../../@core/xml/escape';
import { formatCodeContextAsXml, formatGitContextXml } from '../../@krolik/enrichment';
import type { ActionStep, AIReport } from '../types';
import { formatImpactXml, formatSuggestionXml } from './shared';

// ============================================================================
// XML SECTION HELPERS
// ============================================================================

export function formatXmlSummary(summary: AIReport['summary']): string[] {
  const lines: string[] = [];

  lines.push('  <summary>');
  lines.push(`    <total-issues>${summary.totalIssues}</total-issues>`);
  lines.push(`    <auto-fixable>${summary.autoFixableIssues}</auto-fixable>`);
  lines.push(`    <manual-required>${summary.manualIssues}</manual-required>`);
  lines.push(
    `    <total-effort minutes="${summary.totalEffortMinutes}">${summary.totalEffortLabel}</total-effort>`,
  );

  const bySeverity = {
    'must-fix': summary.byPriority.critical ?? 0,
    'should-fix': summary.byPriority.high ?? 0,
    nit: summary.byPriority.medium ?? 0,
    optional: summary.byPriority.low ?? 0,
  };
  lines.push('    <by-severity google-style="true">');
  lines.push(`      <must-fix blocking="true">${bySeverity['must-fix']}</must-fix>`);
  lines.push(`      <should-fix>${bySeverity['should-fix']}</should-fix>`);
  lines.push(`      <nit>${bySeverity.nit}</nit>`);
  lines.push(`      <optional>${bySeverity.optional}</optional>`);
  lines.push('    </by-severity>');
  lines.push('  </summary>');
  lines.push('');

  return lines;
}

export function formatXmlQuickWins(quickWins: AIReport['quickWins']): string[] {
  if (!quickWins || quickWins.length === 0) return [];

  const lines: string[] = [];
  lines.push('  <quick-wins>');

  for (const win of quickWins) {
    const loc = win.issue.line ? `:${win.issue.line}` : '';
    const severityAttr = win.severity ? ` severity="${win.severity}"` : '';
    const confidenceAttr = win.confidence ? ` confidence="${win.confidence.score}%"` : '';
    lines.push(
      `    <issue file="${win.issue.file}${loc}" effort="${win.effort.timeLabel}" priority="${win.priority}"${severityAttr}${confidenceAttr}>`,
    );
    lines.push(`      <description>${escapeXml(win.issue.message)}</description>`);
    if (win.impact) {
      lines.push(...formatImpactXml(win.impact, 6));
    }
    if (win.gitContext) {
      lines.push(...formatGitContextXml(win.gitContext, 6));
    }
    if (win.suggestion) {
      lines.push(...formatSuggestionXml(win.suggestion, 6));
    }
    if (win.codeContext) {
      const codeContextXml = formatCodeContextAsXml(win.codeContext, 6);
      if (codeContextXml) {
        lines.push(codeContextXml);
      }
    }
    lines.push('    </issue>');
  }

  lines.push('  </quick-wins>');
  lines.push('');
  return lines;
}

export function formatXmlActionPlan(actionPlan: AIReport['actionPlan']): string[] {
  if (!actionPlan || actionPlan.length === 0) return [];

  const lines: string[] = [];
  const severityMap: Record<string, string> = {
    critical: 'must-fix',
    high: 'should-fix',
    medium: 'nit',
    low: 'optional',
  };

  lines.push('  <action-plan>');

  for (const step of actionPlan) {
    const loc = step.line ? `:${step.line}` : '';
    const severity = severityMap[step.priority] ?? 'nit';
    lines.push(
      `    <step id="${step.id}" action="${step.action}" file="${step.file}${loc}" effort="${step.effort.timeLabel}" severity="${severity}">`,
    );
    lines.push(`      <description>${escapeXml(step.description)}</description>`);

    if (step.suggestion) {
      lines.push(...formatXmlStepSuggestion(step.suggestion));
    }
    if (step.codeContext) {
      const codeContextXml = formatCodeContextAsXml(step.codeContext, 6);
      if (codeContextXml) {
        lines.push(codeContextXml);
      }
    }
    lines.push('    </step>');
  }

  lines.push('  </action-plan>');
  return lines;
}

export function formatXmlStepSuggestion(
  suggestion: NonNullable<ActionStep['suggestion']>,
): string[] {
  const lines: string[] = [];
  lines.push(`      <suggestion reason="${escapeXml(suggestion.reason)}">`);
  if (suggestion.before) {
    lines.push(`        <before><![CDATA[${suggestion.before}]]></before>`);
  }
  lines.push(`        <after><![CDATA[${suggestion.after}]]></after>`);

  if (suggestion.typeContext) {
    const tc = suggestion.typeContext;
    lines.push(
      `        <type-inference inferred="${escapeXml(tc.inferredType)}" confidence="${tc.confidence}%">`,
    );
    if (tc.evidence.length > 0) {
      lines.push('          <evidence>');
      for (const e of tc.evidence.slice(0, 5)) {
        const lineAttr = e.line ? ` line="${e.line}"` : '';
        lines.push(
          `            <usage type="${e.type}"${lineAttr}>${escapeXml(e.description)}</usage>`,
        );
      }
      lines.push('          </evidence>');
    }
    lines.push('        </type-inference>');
  }

  lines.push('      </suggestion>');
  return lines;
}

export function formatXmlRanking(ranking: AIReport['ranking']): string[] {
  if (!ranking || !ranking.hotspots || ranking.hotspots.length === 0) return [];

  const lines: string[] = [];
  lines.push('');
  lines.push('  <!-- RANKING - PageRank-based dependency analysis -->');
  lines.push(
    `  <ranking modules="${ranking.stats.nodeCount}" edges="${ranking.stats.edgeCount}" cycles="${ranking.stats.cycleCount}">`,
  );

  lines.push(`    <hotspots count="${ranking.hotspots.length}">`);
  for (const hotspot of ranking.hotspots.slice(0, 10)) {
    lines.push(
      `      <hotspot path="${escapeXml(hotspot.path)}" percentile="${hotspot.percentile}" risk="${hotspot.risk}">`,
    );
    lines.push(
      `        <metrics pagerank="${hotspot.pageRank.toFixed(4)}" ca="${hotspot.coupling.afferent}" ce="${hotspot.coupling.efferent}" instability="${hotspot.coupling.instability.toFixed(2)}" />`,
    );
    lines.push('      </hotspot>');
  }
  lines.push('    </hotspots>');

  if (ranking.safeOrder && ranking.safeOrder.length > 0) {
    lines.push(`    <safe-order phases="${ranking.safeOrder.length}">`);
    for (const phase of ranking.safeOrder.slice(0, 5)) {
      const modules = phase.modules.join(', ');
      lines.push(
        `      <phase order="${phase.order}" modules="${phase.modules.length}" risk="${phase.risk}">${modules}</phase>`,
      );
    }
    lines.push('    </safe-order>');
  }

  if (ranking.cycles && ranking.cycles.length > 0) {
    lines.push(`    <cycles count="${ranking.cycles.length}">`);
    for (const cycle of ranking.cycles.slice(0, 3)) {
      lines.push(`      <cycle>${cycle.join(' → ')}</cycle>`);
    }
    lines.push('    </cycles>');
  }

  if (ranking.leafNodes && ranking.leafNodes.length > 0) {
    lines.push(
      `    <leaf-nodes hint="safe to refactor first">${ranking.leafNodes.slice(0, 5).join(', ')}</leaf-nodes>`,
    );
  }
  if (ranking.coreNodes && ranking.coreNodes.length > 0) {
    lines.push(`    <core-nodes hint="refactor last">${ranking.coreNodes.join(', ')}</core-nodes>`);
  }

  lines.push('    <hint>Run: krolik refactor for full analysis and migration plan</hint>');
  lines.push('  </ranking>');

  return lines;
}

export function formatXmlBackwardsCompat(files: AIReport['backwardsCompatFiles']): string[] {
  if (!files || files.length === 0) return [];

  const lines: string[] = [];
  lines.push('');
  lines.push('  <!-- BACKWARDS-COMPAT - Deprecated shim files that should be deleted -->');
  lines.push(`  <backwards-compat count="${files.length}" action="delete">`);

  for (const file of files) {
    lines.push(
      `    <shim path="${escapeXml(file.path)}" confidence="${file.confidence}%"${file.movedTo ? ` target="${escapeXml(file.movedTo)}"` : ''}>`,
    );
    lines.push(`      <reason>${escapeXml(file.reason)}</reason>`);
    lines.push(`      <suggestion>${escapeXml(file.suggestion)}</suggestion>`);
    lines.push('    </shim>');
  }

  lines.push('    <hint>Delete these files and update imports to use the new locations</hint>');
  lines.push('  </backwards-compat>');

  return lines;
}

export function formatXmlRecommendations(recommendations: AIReport['recommendations']): string[] {
  if (!recommendations || recommendations.length === 0) return [];

  const lines: string[] = [];
  lines.push('');
  lines.push('  <!-- RECOMMENDATIONS - Top refactoring priorities -->');
  lines.push(`  <recommendations count="${recommendations.length}">`);

  for (const rec of recommendations) {
    lines.push(
      `    <rec priority="${rec.priority}" category="${rec.category}" effort="${rec.effort}" auto="${rec.autoFixable}">`,
    );
    lines.push(`      <title>${escapeXml(rec.title)}</title>`);
    lines.push(`      <description>${escapeXml(rec.description)}</description>`);
    if (rec.affectedFiles.length > 0) {
      lines.push(`      <files>${rec.affectedFiles.map((f) => escapeXml(f)).join(', ')}</files>`);
    }
    lines.push('    </rec>');
  }

  lines.push('  </recommendations>');
  return lines;
}

export function formatXmlDuplicates(duplicates: AIReport['duplicates']): string[] {
  if (!duplicates || duplicates.totalGroups === 0) return [];

  const lines: string[] = [];
  lines.push('');
  lines.push('  <!-- DUPLICATES - Function duplicates summary -->');
  lines.push(
    `  <duplicates total="${duplicates.totalGroups}" merge="${duplicates.mergeCount}" rename="${duplicates.renameCount}">`,
  );

  for (const dup of duplicates.topDuplicates.slice(0, 5)) {
    lines.push(
      `    <dup name="${escapeXml(dup.name)}" similarity="${(dup.similarity * 100).toFixed(0)}%" locations="${dup.locationCount}" action="${dup.recommendation}">`,
    );
    lines.push(`      <files>${dup.files.map((f) => escapeXml(f)).join(', ')}</files>`);
    lines.push('    </dup>');
  }

  lines.push('    <hint>Run: krolik refactor for full duplicate analysis</hint>');
  lines.push('  </duplicates>');

  return lines;
}

export function formatXmlReadability(readability: AIReport['readability']): string[] {
  if (!readability) return [];

  const lines: string[] = [];
  lines.push('');
  lines.push('  <!-- READABILITY - Code readability analysis (Chromium Tricorder-style) -->');
  lines.push(`  <readability overall="${readability.overall}" grade="${readability.grade}">`);
  lines.push(`    <naming>${readability.naming}</naming>`);
  lines.push(`    <structure>${readability.structure}</structure>`);
  lines.push(`    <comments>${readability.comments}</comments>`);
  lines.push(`    <cognitive>${readability.cognitive}</cognitive>`);
  if (readability.issueCount > 0) {
    lines.push(`    <issue-count>${readability.issueCount}</issue-count>`);
  }
  lines.push('  </readability>');

  return lines;
}

export function formatXmlCodeStyle(
  recommendations: AIReport['codeStyleRecommendations'],
): string[] {
  if (!recommendations || recommendations.length === 0) return [];

  const lines: string[] = [];
  lines.push('');
  lines.push('  <!-- CODE-STYLE - Best practices recommendations (Google/Airbnb style guides) -->');
  lines.push(`  <code-style count="${recommendations.length}">`);

  const byCategory = new Map<string, typeof recommendations>();
  for (const rec of recommendations) {
    const list = byCategory.get(rec.category) ?? [];
    list.push(rec);
    byCategory.set(rec.category, list);
  }

  for (const [category, recs] of byCategory) {
    lines.push(`    <category name="${category}">`);
    for (const rec of recs) {
      lines.push(`      <rec id="${rec.id}" severity="${rec.severity}" count="${rec.count}">`);
      lines.push(`        <title>${escapeXml(rec.title)}</title>`);
      lines.push(`        <description>${escapeXml(rec.description)}</description>`);
      if (rec.file) {
        const lineAttr = rec.line ? ` line="${rec.line}"` : '';
        const snippetContent = rec.snippet ? escapeXml(rec.snippet) : '';
        if (snippetContent) {
          lines.push(
            `        <example file="${escapeXml(rec.file)}"${lineAttr}>${snippetContent}</example>`,
          );
        } else {
          lines.push(`        <example file="${escapeXml(rec.file)}"${lineAttr} />`);
        }
      }
      if (rec.fix) {
        lines.push(`        <before>${escapeXml(rec.fix.before)}</before>`);
        lines.push(`        <after>${escapeXml(rec.fix.after)}</after>`);
      }
      lines.push('      </rec>');
    }
    lines.push('    </category>');
  }

  lines.push('  </code-style>');
  return lines;
}
