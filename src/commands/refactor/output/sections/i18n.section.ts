/**
 * @module commands/refactor/output/sections/i18n.section
 * @description I18n hardcoded strings section for refactor output
 *
 * Shows hardcoded Russian text that should be extracted for i18n.
 * Uses the simplified I18nAnalysisResult from the registry-based analyzer.
 */

import { escapeXml } from '../../../../lib/@format';
import type { I18nAnalysisResult } from '../../analyzers/modules/i18n.analyzer';
import type { Section, SectionContext } from '../registry';

// ============================================================================
// SECTION DEFINITION
// ============================================================================

/**
 * I18n section
 *
 * Renders hardcoded strings that need to be extracted for internationalization.
 * Critical for multi-language support.
 */
export const i18nSection: Section = {
  metadata: {
    id: 'i18n',
    name: 'I18n Hardcoded Strings',
    description: 'Shows hardcoded text that needs i18n extraction',
    order: 65, // After recommendations, before api
    requires: ['i18n'],
    showWhen: 'has-issues',
  },

  shouldRender(ctx: SectionContext): boolean {
    const result = ctx.results.get('i18n');
    if (result?.status === 'skipped') return false;
    if (result?.status === 'error') return true;

    const data = result?.data as I18nAnalysisResult | undefined;
    return !!data && data.totalStrings > 0;
  },

  render(lines: string[], ctx: SectionContext): void {
    const result = ctx.results.get('i18n');

    // Handle error case
    if (result?.status === 'error') {
      lines.push('  <i18n status="error">');
      lines.push(`    <error>${escapeXml(result.error ?? 'Unknown error')}</error>`);
      lines.push('  </i18n>');
      lines.push('');
      return;
    }

    const data = result?.data as I18nAnalysisResult | undefined;

    // Handle no data
    if (!data) {
      lines.push('  <i18n status="no-data" />');
      lines.push('');
      return;
    }

    const { files, totalStrings, totalFiles } = data;

    // No hardcoded strings found
    if (totalStrings === 0) {
      lines.push('  <!-- I18n: no hardcoded strings found -->');
      lines.push('  <i18n strings="0" status="clean" />');
      lines.push('');
      return;
    }

    // Render with strings found
    lines.push('  <!-- I18N - Hardcoded strings that need extraction -->');
    lines.push(`  <i18n strings="${totalStrings}" files="${totalFiles}">`);

    // Summary
    lines.push('    <summary>');
    lines.push(`      <total-strings>${totalStrings}</total-strings>`);
    lines.push(`      <affected-files>${totalFiles}</affected-files>`);
    lines.push('    </summary>');

    // Files with hardcoded strings (sorted by count, top 10)
    if (files.length > 0) {
      lines.push('    <!-- Files with hardcoded Russian strings (sorted by count) -->');
      lines.push(`    <files count="${files.length}">`);

      for (const file of files.slice(0, 10)) {
        lines.push(
          `      <file path="${escapeXml(file.file)}" strings="${file.count}" lines="${file.lines.slice(0, 5).join(',')}"${file.lines.length > 5 ? ` more="${file.lines.length - 5}"` : ''} />`,
        );
      }

      if (files.length > 10) {
        lines.push(`      <!-- +${files.length - 10} more files -->`);
      }

      lines.push('    </files>');
    }

    // Action items
    lines.push('    <action-items>');
    lines.push(
      `      <action priority="high">Extract ${totalStrings} Russian strings to i18n translation keys</action>`,
    );
    lines.push(
      '      <action priority="medium">Use i18next-cli for automated extraction: npx i18next-scanner</action>',
    );
    lines.push('    </action-items>');

    lines.push('  </i18n>');
    lines.push('');
  },
};
