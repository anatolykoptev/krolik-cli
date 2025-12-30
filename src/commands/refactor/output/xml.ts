/**
 * @module commands/refactor/output/xml
 * @description Basic XML output formatter
 */

import { escapeXml } from '../../../lib/@format';
import type { RefactorAnalysis } from '../core/types';

// ============================================================================
// MAIN FORMATTER
// ============================================================================

/**
 * Format refactor analysis as XML
 */
export function formatRefactorXml(analysis: RefactorAnalysis): string {
  const duplicatesXml = analysis.duplicates
    .map(
      (d) => `
    <duplicate similarity="${d.similarity.toFixed(2)}" recommendation="${d.recommendation}">
      <name>${escapeXml(d.name)}</name>
      <locations>
        ${d.locations.map((l) => `<location file="${escapeXml(l.file)}" line="${l.line}" exported="${l.exported}" />`).join('\n        ')}
      </locations>
    </duplicate>`,
    )
    .join('');

  const issuesXml = analysis.structure.issues
    .map(
      (i) => `
    <issue type="${i.type}" severity="${i.severity}">
      <message>${escapeXml(i.message)}</message>
      <files>${i.files.map((f) => `<file>${escapeXml(f)}</file>`).join('')}</files>
      ${i.fix ? `<fix>${escapeXml(i.fix)}</fix>` : ''}
    </issue>`,
    )
    .join('');

  const actionsXml = analysis.migration.actions
    .map(
      (a) => `
    <action type="${a.type}" risk="${a.risk}">
      <source>${escapeXml(a.source)}</source>
      ${a.target ? `<target>${escapeXml(a.target)}</target>` : ''}
      <affectedImports count="${a.affectedImports.length}" />
    </action>`,
    )
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<refactor-analysis timestamp="${analysis.timestamp}">
  <path>${escapeXml(analysis.path)}</path>

  <duplicates count="${analysis.duplicates.length}">${duplicatesXml}
  </duplicates>

  <structure score="${analysis.structure.score}">
    <flatFiles count="${analysis.structure.flatFiles.length}">
      ${analysis.structure.flatFiles.map((f) => `<file>${escapeXml(f)}</file>`).join('\n      ')}
    </flatFiles>
    <namespacedFolders count="${analysis.structure.namespacedFolders.length}">
      ${analysis.structure.namespacedFolders.map((f) => `<folder>${escapeXml(f)}</folder>`).join('\n      ')}
    </namespacedFolders>
    <doubleNested count="${analysis.structure.doubleNested.length}">
      ${analysis.structure.doubleNested.map((f) => `<path>${escapeXml(f)}</path>`).join('\n      ')}
    </doubleNested>
    <issues count="${analysis.structure.issues.length}">${issuesXml}
    </issues>
  </structure>

  <migration filesAffected="${analysis.migration.filesAffected}" importsToUpdate="${analysis.migration.importsToUpdate}">
    <riskSummary safe="${analysis.migration.riskSummary.safe}" medium="${analysis.migration.riskSummary.medium}" risky="${analysis.migration.riskSummary.risky}" />
    <actions count="${analysis.migration.actions.length}">${actionsXml}
    </actions>
  </migration>
</refactor-analysis>`;
}
