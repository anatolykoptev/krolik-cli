/**
 * @module commands/refactor/output/sections/domains.section
 * @description Domains classification section for the registry-based architecture
 *
 * Shows domain classification, coherence scores, and file movement suggestions.
 */

import { escapeXml } from '../../../../lib/@format';
import type { DomainInfo } from '../../core/types-ai';
import type { Section, SectionContext } from '../registry';

// ============================================================================
// SECTION DEFINITION
// ============================================================================

/**
 * Domains classification section
 *
 * Renders domain boundaries, coherence scores, and improvement suggestions.
 */
export const domainsSection: Section = {
  metadata: {
    id: 'domains',
    name: 'Domain Classification',
    description: 'Shows domain boundaries and coherence',
    order: 50, // After architecture
    requires: ['domains'],
    showWhen: 'has-data',
  },

  shouldRender(ctx: SectionContext): boolean {
    const result = ctx.results.get('domains');
    return result?.status === 'success' && Array.isArray(result.data) && result.data.length > 0;
  },

  render(lines: string[], ctx: SectionContext): void {
    const result = ctx.results.get('domains');

    // Handle error case
    if (result?.status === 'error') {
      lines.push('  <domains status="error">');
      lines.push(`    <error>${escapeXml(result.error ?? 'Unknown error')}</error>`);
      lines.push('  </domains>');
      lines.push('');
      return;
    }

    const domains = result?.data as DomainInfo[] | undefined;

    // Handle no data
    if (!domains || domains.length === 0) {
      lines.push('  <domains status="no-data" />');
      lines.push('');
      return;
    }

    // Calculate average coherence
    const avgCoherence = domains.reduce((sum, d) => sum + d.coherence, 0) / domains.length;
    const lowCoherenceDomains = domains.filter((d) => d.coherence < 0.6);

    lines.push('  <!-- DOMAIN CLASSIFICATION - Logical boundaries in the codebase -->');
    lines.push(
      `  <domains count="${domains.length}" avg-coherence="${(avgCoherence * 100).toFixed(0)}%">`,
    );

    // Show domains with suggestions
    for (const domain of domains.slice(0, 15)) {
      const hasIssues = domain.shouldMove.length > 0;
      const coherencePercent = (domain.coherence * 100).toFixed(0);

      lines.push(
        `    <domain name="${escapeXml(domain.name)}" category="${domain.category}" files="${domain.files}" coherence="${coherencePercent}%"${hasIssues ? '' : ' /'}>`,
      );

      if (hasIssues) {
        if (domain.suggestion) {
          lines.push(`      <suggestion>${escapeXml(domain.suggestion)}</suggestion>`);
        }
        if (domain.shouldMove.length > 0) {
          lines.push(`      <should-move count="${domain.shouldMove.length}">`);
          for (const move of domain.shouldMove.slice(0, 3)) {
            lines.push(
              `        <file path="${escapeXml(move.file)}" target="${escapeXml(move.suggestedDomain)}" />`,
            );
          }
          if (domain.shouldMove.length > 3) {
            lines.push(`        <!-- +${domain.shouldMove.length - 3} more files -->`);
          }
          lines.push('      </should-move>');
        }
        lines.push('    </domain>');
      }
    }

    if (domains.length > 15) {
      lines.push(`    <!-- +${domains.length - 15} more domains -->`);
    }

    // Summary for low coherence domains
    if (lowCoherenceDomains.length > 0) {
      lines.push('    <low-coherence-summary>');
      lines.push(
        `      <!-- ${lowCoherenceDomains.length} domains have coherence below 60% and need attention -->`,
      );
      lines.push('    </low-coherence-summary>');
    }

    lines.push('  </domains>');
    lines.push('');
  },
};
