/**
 * @module commands/refactor/output/sections/duplicates
 * @description Duplicates section formatter with deduplication
 */

import { escapeXml } from '../../../../lib/@formatters';
import type { EnhancedRefactorAnalysis } from '../../core';
import { deduplicateDuplicates, sortBySimilarity } from '../helpers';

/**
 * Format duplicates section
 */
export function formatDuplicates(lines: string[], analysis: EnhancedRefactorAnalysis): void {
  const { duplicates, typeDuplicates } = analysis;
  const totalCount = duplicates.length + (typeDuplicates?.length ?? 0);

  if (totalCount === 0) {
    lines.push('  <duplicates count="0" />');
    lines.push('');
    return;
  }

  lines.push(`  <duplicates count="${totalCount}">`);

  // Function duplicates - deduplicated and sorted by similarity
  if (duplicates.length > 0) {
    const deduplicated = deduplicateDuplicates(duplicates);
    const sorted = sortBySimilarity(deduplicated);

    lines.push(
      `    <function-duplicates count="${sorted.length}" deduplicated="true" sorted-by="similarity">`,
    );

    for (const dup of sorted.slice(0, 10)) {
      const similarity = Math.round(dup.similarity * 100);
      lines.push(
        `      <duplicate name="${escapeXml(dup.name)}" similarity="${similarity}%" recommendation="${dup.recommendation}">`,
      );

      const canonical = dup.locations.find((l) => l.exported) || dup.locations[0];
      if (canonical) {
        lines.push(
          `        <canonical file="${canonical.file}" line="${canonical.line}" exported="${canonical.exported}" />`,
        );
      }

      lines.push('        <locations>');
      for (const loc of dup.locations) {
        if (loc !== canonical) {
          lines.push(
            `          <location file="${loc.file}" line="${loc.line}" exported="${loc.exported}" />`,
          );
        }
      }
      lines.push('        </locations>');
      lines.push('      </duplicate>');
    }

    if (sorted.length > 10) {
      lines.push(`      <!-- +${sorted.length - 10} more function duplicates -->`);
    }
    lines.push('    </function-duplicates>');
  }

  // Type duplicates - deduplicated and sorted by similarity
  if (typeDuplicates && typeDuplicates.length > 0) {
    const deduplicated = deduplicateDuplicates(typeDuplicates);
    const sorted = sortBySimilarity(deduplicated);

    lines.push(
      `    <type-duplicates count="${sorted.length}" deduplicated="true" sorted-by="similarity">`,
    );

    for (const dup of sorted.slice(0, 10)) {
      const similarity = Math.round(dup.similarity * 100);
      lines.push(
        `      <duplicate name="${escapeXml(dup.name)}" kind="${dup.kind}" similarity="${similarity}%" recommendation="${dup.recommendation}">`,
      );

      if (dup.commonFields && dup.commonFields.length > 0) {
        lines.push(`        <common-fields>${dup.commonFields.join(', ')}</common-fields>`);
      }
      if (dup.difference) {
        lines.push(`        <difference>${escapeXml(dup.difference)}</difference>`);
      }

      lines.push('        <locations>');
      for (const loc of dup.locations) {
        lines.push(
          `          <location file="${loc.file}" line="${loc.line}" name="${escapeXml(loc.name)}" exported="${loc.exported}" />`,
        );
      }
      lines.push('        </locations>');
      lines.push('      </duplicate>');
    }

    if (sorted.length > 10) {
      lines.push(`      <!-- +${sorted.length - 10} more type duplicates -->`);
    }
    lines.push('    </type-duplicates>');
  }

  lines.push('  </duplicates>');
  lines.push('');
}
