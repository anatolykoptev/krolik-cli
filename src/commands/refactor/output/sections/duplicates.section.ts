/**
 * @module commands/refactor/output/sections/duplicates.section
 * @description Duplicates section for the registry-based architecture
 *
 * Shows duplicate functions and types found across the codebase.
 */

import { escapeXml } from '../../../../lib/@format';
import type { DuplicatesAnalysis } from '../../analyzers/modules/duplicates.analyzer';
import type { DuplicateInfo, TypeDuplicateInfo } from '../../core';
import type { Section, SectionContext } from '../registry';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format a function duplicate as XML
 */
function formatFunctionDuplicate(lines: string[], dup: DuplicateInfo, indent: string): void {
  lines.push(
    `${indent}<duplicate name="${escapeXml(dup.name)}" similarity="${(dup.similarity * 100).toFixed(0)}%" recommendation="${dup.recommendation}">`,
  );
  for (const loc of dup.locations.slice(0, 5)) {
    lines.push(
      `${indent}  <location file="${escapeXml(loc.file)}" line="${loc.line}" exported="${loc.exported}" />`,
    );
  }
  if (dup.locations.length > 5) {
    lines.push(`${indent}  <!-- +${dup.locations.length - 5} more locations -->`);
  }
  lines.push(`${indent}</duplicate>`);
}

/**
 * Format a type duplicate as XML
 */
function formatTypeDuplicate(lines: string[], dup: TypeDuplicateInfo, indent: string): void {
  lines.push(
    `${indent}<type-duplicate name="${escapeXml(dup.name)}" kind="${dup.kind}" similarity="${(dup.similarity * 100).toFixed(0)}%" recommendation="${dup.recommendation}">`,
  );
  for (const loc of dup.locations.slice(0, 5)) {
    lines.push(
      `${indent}  <location file="${escapeXml(loc.file)}" line="${loc.line}" name="${escapeXml(loc.name)}" />`,
    );
  }
  if (dup.locations.length > 5) {
    lines.push(`${indent}  <!-- +${dup.locations.length - 5} more locations -->`);
  }
  lines.push(`${indent}</type-duplicate>`);
}

// ============================================================================
// SECTION DEFINITION
// ============================================================================

/**
 * Duplicates section
 *
 * Renders duplicate functions and types found in the codebase.
 * Critical for code consolidation efforts.
 */
export const duplicatesSection: Section = {
  metadata: {
    id: 'duplicates',
    name: 'Duplicates Detection',
    description: 'Shows duplicate functions and types',
    order: 80, // After domains, before file-size
    requires: ['duplicates'],
    showWhen: 'always',
  },

  shouldRender(ctx: SectionContext): boolean {
    const result = ctx.results.get('duplicates');
    return result?.status !== 'skipped';
  },

  render(lines: string[], ctx: SectionContext): void {
    const result = ctx.results.get('duplicates');

    // Handle error case
    if (result?.status === 'error') {
      lines.push('  <duplicates status="error">');
      lines.push(`    <error>${escapeXml(result.error ?? 'Unknown error')}</error>`);
      lines.push('  </duplicates>');
      lines.push('');
      return;
    }

    const data = result?.data as DuplicatesAnalysis | undefined;

    // Handle no data
    if (!data) {
      lines.push('  <duplicates status="no-data" />');
      lines.push('');
      return;
    }

    // No duplicates found
    if (data.totalCount === 0) {
      lines.push('  <!-- Duplicates: no duplicate functions or types found -->');
      lines.push('  <duplicates functions="0" types="0" status="clean" />');
      lines.push('');
      return;
    }

    // Normal rendering with duplicates
    lines.push('  <!-- DUPLICATES - Functions and types that can be consolidated -->');
    lines.push(
      `  <duplicates functions="${data.functions.length}" types="${data.types.length}" total="${data.totalCount}">`,
    );

    // Function duplicates
    if (data.functions.length > 0) {
      // Sort by similarity (highest first)
      const sortedFunctions = [...data.functions].sort((a, b) => b.similarity - a.similarity);

      lines.push('    <!-- FUNCTION DUPLICATES - Consider merging or extracting -->');
      lines.push(`    <function-duplicates count="${data.functions.length}">`);
      for (const dup of sortedFunctions.slice(0, 10)) {
        formatFunctionDuplicate(lines, dup, '      ');
      }
      if (sortedFunctions.length > 10) {
        lines.push(`      <!-- +${sortedFunctions.length - 10} more function duplicates -->`);
      }
      lines.push('    </function-duplicates>');
    }

    // Type duplicates
    if (data.types.length > 0) {
      // Sort by similarity (highest first)
      const sortedTypes = [...data.types].sort((a, b) => b.similarity - a.similarity);

      lines.push('    <!-- TYPE DUPLICATES - Consider consolidating -->');
      lines.push(`    <type-duplicates count="${data.types.length}">`);
      for (const dup of sortedTypes.slice(0, 10)) {
        formatTypeDuplicate(lines, dup, '      ');
      }
      if (sortedTypes.length > 10) {
        lines.push(`      <!-- +${sortedTypes.length - 10} more type duplicates -->`);
      }
      lines.push('    </type-duplicates>');
    }

    lines.push('  </duplicates>');
    lines.push('');
  },
};
