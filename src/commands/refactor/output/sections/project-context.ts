/**
 * @module commands/refactor/output/sections/project-context
 * @description Project context section formatter
 */

import { escapeXml } from '../../../../lib/@formatters';
import type { EnhancedRefactorAnalysis } from '../../core';

/**
 * Format project context section
 */
export function formatProjectContext(lines: string[], analysis: EnhancedRefactorAnalysis): void {
  const { projectContext } = analysis;

  lines.push('  <project-context>');
  lines.push(`    <type>${projectContext.type}</type>`);
  lines.push(`    <name>${escapeXml(projectContext.name)}</name>`);

  lines.push('    <tech-stack>');
  lines.push(`      <framework>${projectContext.techStack.framework || 'none'}</framework>`);
  lines.push(`      <runtime>${projectContext.techStack.runtime}</runtime>`);
  lines.push(`      <language>${projectContext.techStack.language}</language>`);
  lines.push(`      <ui>${projectContext.techStack.ui || 'none'}</ui>`);
  if (projectContext.techStack.database.length > 0) {
    lines.push(`      <database>${projectContext.techStack.database.join(', ')}</database>`);
  }
  if (projectContext.techStack.stateManagement.length > 0) {
    lines.push(
      `      <state-management>${projectContext.techStack.stateManagement.join(', ')}</state-management>`,
    );
  }
  lines.push('    </tech-stack>');

  lines.push('    <entry-points>');
  if (projectContext.entryPoints.main) {
    lines.push(`      <main>${projectContext.entryPoints.main}</main>`);
  }
  if (projectContext.entryPoints.apiRoutes) {
    lines.push(`      <api-routes>${projectContext.entryPoints.apiRoutes}</api-routes>`);
  }
  if (projectContext.entryPoints.pages) {
    lines.push(`      <pages>${projectContext.entryPoints.pages}</pages>`);
  }
  if (projectContext.entryPoints.components) {
    lines.push(`      <components>${projectContext.entryPoints.components}</components>`);
  }
  lines.push('    </entry-points>');

  if (projectContext.importAlias) {
    lines.push(`    <import-alias>${projectContext.importAlias}</import-alias>`);
  }

  lines.push('  </project-context>');
  lines.push('');
}
