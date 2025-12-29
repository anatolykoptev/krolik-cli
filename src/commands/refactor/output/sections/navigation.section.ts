/**
 * @module commands/refactor/output/sections/navigation.section
 * @description AI Navigation section for registry-based architecture
 *
 * Shows navigation hints for AI assistants about where to add new code.
 */

import type { AiNavigation } from '../../core';
import type { Section, SectionContext } from '../registry';

// ============================================================================
// SECTION DEFINITION
// ============================================================================

/**
 * AI Navigation section
 *
 * Renders navigation hints for AI assistants:
 * - Where to add new code
 * - File patterns
 * - Import conventions
 * - Naming conventions
 *
 * Order: 95 (at the end, conditional)
 */
export const navigationSection: Section = {
  metadata: {
    id: 'navigation',
    name: 'AI Navigation',
    description: 'Shows navigation hints for AI assistants',
    order: 95, // At the end
    requires: ['navigation'],
    showWhen: 'has-data',
  },

  shouldRender(ctx: SectionContext): boolean {
    // Only show in full output level
    if (!ctx.limits.includeStaticSections) {
      return false;
    }
    const result = ctx.results.get('navigation');
    return result?.status === 'success' && result.data != null;
  },

  render(lines: string[], ctx: SectionContext): void {
    const result = ctx.results.get('navigation');
    const navigation = result?.data as AiNavigation | undefined;

    if (!navigation) {
      lines.push('  <ai-navigation status="no-data" />');
      lines.push('');
      return;
    }

    lines.push('  <!-- AI-NAVIGATION - Where to add new code -->');
    lines.push('  <ai-navigation>');

    // Where to add new code
    lines.push('    <add-new-code>');
    lines.push(`      <server-logic>${navigation.addNewCode.serverLogic}</server-logic>`);
    lines.push(`      <client-hook>${navigation.addNewCode.clientHook}</client-hook>`);
    lines.push(`      <utility>${navigation.addNewCode.utility}</utility>`);
    lines.push(`      <constant>${navigation.addNewCode.constant}</constant>`);
    lines.push(`      <integration>${navigation.addNewCode.integration}</integration>`);
    lines.push(`      <component>${navigation.addNewCode.component}</component>`);
    lines.push(`      <api-route>${navigation.addNewCode.apiRoute}</api-route>`);
    lines.push(`      <test>${navigation.addNewCode.test}</test>`);
    lines.push('    </add-new-code>');

    // File patterns
    lines.push('    <file-patterns>');
    for (const fp of navigation.filePatterns) {
      lines.push(
        `      <pattern type="${fp.pattern}" meaning="${fp.meaning}" example="${fp.example}" />`,
      );
    }
    lines.push('    </file-patterns>');

    // Import conventions
    lines.push('    <import-conventions>');
    lines.push(
      `      <absolute-imports>${navigation.importConventions.absoluteImports}</absolute-imports>`,
    );
    if (navigation.importConventions.alias) {
      lines.push(`      <alias>${navigation.importConventions.alias}</alias>`);
    }
    lines.push(
      `      <barrel-exports>${navigation.importConventions.barrelExports}</barrel-exports>`,
    );
    lines.push('      <preferred-order>');
    for (const order of navigation.importConventions.preferredOrder) {
      lines.push(`        <item>${order}</item>`);
    }
    lines.push('      </preferred-order>');
    lines.push('    </import-conventions>');

    // Naming conventions
    lines.push('    <naming-conventions>');
    lines.push(`      <files>${navigation.namingConventions.files}</files>`);
    lines.push(`      <components>${navigation.namingConventions.components}</components>`);
    lines.push(`      <hooks>${navigation.namingConventions.hooks}</hooks>`);
    lines.push(`      <utilities>${navigation.namingConventions.utilities}</utilities>`);
    lines.push(`      <constants>${navigation.namingConventions.constants}</constants>`);
    lines.push(`      <types>${navigation.namingConventions.types}</types>`);
    lines.push('    </naming-conventions>');

    lines.push('  </ai-navigation>');
    lines.push('');
  },
};
