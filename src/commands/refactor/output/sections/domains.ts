/**
 * @module commands/refactor/output/sections/domains
 * @description Domain classification section formatter
 */

import { escapeXml } from '../../../../lib/@formatters';
import type { DomainInfo, EnhancedRefactorAnalysis } from '../../core';
import { deduplicateMisplacedFiles } from '../helpers';

/**
 * Format a single domain
 */
export function formatDomain(lines: string[], domain: DomainInfo): void {
  lines.push(
    `    <domain name="${domain.name}" category="${domain.category}" files="${domain.files}" coherence="${domain.coherence.toFixed(2)}">`,
  );
  lines.push(`      <description>${escapeXml(domain.description)}</description>`);

  if (domain.suggestion) {
    lines.push(`      <suggestion>${escapeXml(domain.suggestion)}</suggestion>`);
  }

  if (domain.shouldMove.length > 0) {
    // Deduplicate misplaced files
    const deduplicated = deduplicateMisplacedFiles(domain.shouldMove);

    lines.push(`      <misplaced-files deduplicated="true">`);
    for (const m of deduplicated.slice(0, 5)) {
      lines.push(`        <file name="${m.file}" suggested-domain="${m.suggestedDomain}" />`);
    }
    if (deduplicated.length > 5) {
      lines.push(`        <!-- +${deduplicated.length - 5} more files -->`);
    }
    lines.push('      </misplaced-files>');
  }

  lines.push('    </domain>');
}

/**
 * Format domains section
 */
export function formatDomains(lines: string[], analysis: EnhancedRefactorAnalysis): void {
  const { domains } = analysis;

  lines.push(`  <domains count="${domains.length}">`);
  for (const domain of domains) {
    formatDomain(lines, domain);
  }
  lines.push('  </domains>');
  lines.push('');
}
