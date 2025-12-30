/**
 * @module commands/refactor/output/sections/project-context.section
 * @description Project context section for the registry-based architecture
 *
 * Shows detected project type, tech stack, entry points, and import conventions.
 * Provides foundational context for AI understanding of the codebase.
 */

import { escapeXml } from '../../../../lib/@format';
import type { ProjectContext } from '../../core/types-ai';
import type { Section, SectionContext } from '../registry';

// ============================================================================
// SECTION DEFINITION
// ============================================================================

/**
 * Project context section
 *
 * Renders project type, tech stack, and entry points.
 * Always shown as it provides essential context for AI.
 */
export const projectContextSection: Section = {
  metadata: {
    id: 'project-context',
    name: 'Project Context',
    description: 'Shows project type, tech stack, and entry points',
    order: 5, // Very early - foundational context
    requires: ['project-context'],
    showWhen: 'always',
  },

  shouldRender(ctx: SectionContext): boolean {
    const result = ctx.results.get('project-context');
    return result?.status !== 'skipped';
  },

  render(lines: string[], ctx: SectionContext): void {
    const result = ctx.results.get('project-context');

    // Handle error case
    if (result?.status === 'error') {
      lines.push('  <project-context status="error">');
      lines.push(`    <error>${escapeXml(result.error ?? 'Unknown error')}</error>`);
      lines.push('  </project-context>');
      lines.push('');
      return;
    }

    const data = result?.data as ProjectContext | undefined;

    // Handle no data
    if (!data) {
      lines.push('  <project-context status="no-data" />');
      lines.push('');
      return;
    }

    // Normal rendering
    lines.push('  <!-- PROJECT CONTEXT - Understanding the project structure -->');
    lines.push(`  <project-context type="${data.type}" name="${escapeXml(data.name)}">`);

    // Tech stack
    lines.push('    <tech-stack>');
    if (data.techStack.framework) {
      lines.push(`      <framework>${escapeXml(data.techStack.framework)}</framework>`);
    }
    lines.push(`      <runtime>${data.techStack.runtime}</runtime>`);
    lines.push(`      <language>${data.techStack.language}</language>`);
    if (data.techStack.ui) {
      lines.push(`      <ui>${escapeXml(data.techStack.ui)}</ui>`);
    }
    if (data.techStack.stateManagement.length > 0) {
      lines.push(
        `      <state-management>${data.techStack.stateManagement.join(', ')}</state-management>`,
      );
    }
    if (data.techStack.database.length > 0) {
      lines.push(`      <database>${data.techStack.database.join(', ')}</database>`);
    }
    if (data.techStack.testing.length > 0) {
      lines.push(`      <testing>${data.techStack.testing.join(', ')}</testing>`);
    }
    if (data.techStack.styling.length > 0) {
      lines.push(`      <styling>${data.techStack.styling.join(', ')}</styling>`);
    }
    lines.push('    </tech-stack>');

    // Entry points
    lines.push('    <entry-points>');
    if (data.entryPoints.main) {
      lines.push(`      <main>${escapeXml(data.entryPoints.main)}</main>`);
    }
    if (data.entryPoints.apiRoutes) {
      lines.push(`      <api-routes>${escapeXml(data.entryPoints.apiRoutes)}</api-routes>`);
    }
    if (data.entryPoints.pages) {
      lines.push(`      <pages>${escapeXml(data.entryPoints.pages)}</pages>`);
    }
    if (data.entryPoints.components) {
      lines.push(`      <components>${escapeXml(data.entryPoints.components)}</components>`);
    }
    lines.push('    </entry-points>');

    // Import conventions
    if (data.importAlias || data.srcDir) {
      lines.push('    <conventions>');
      if (data.importAlias) {
        lines.push(`      <import-alias>${escapeXml(data.importAlias)}</import-alias>`);
      }
      if (data.srcDir) {
        lines.push(`      <src-dir>${escapeXml(data.srcDir)}</src-dir>`);
      }
      lines.push('    </conventions>');
    }

    lines.push('  </project-context>');
    lines.push('');
  },
};
