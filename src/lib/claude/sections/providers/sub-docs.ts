/**
 * @module lib/claude/sections/providers/sub-docs
 * @description Sub-documentation section provider
 *
 * Lists discovered sub-documentation files from monorepo packages.
 * Returns skip: true if no sub-docs are found.
 */

import type { SectionContext, SectionProvider, SectionResult } from '../types';
import { SectionPriority } from '../types';

/**
 * Format sub-docs as a compact list
 */
function renderSubDocs(ctx: SectionContext): string {
  const { subDocs } = ctx;

  if (!subDocs || subDocs.length === 0) {
    return '> No sub-documentation files found.';
  }

  const items = subDocs.map((doc) => `- ${doc.label}: \`${doc.path}\``).join('\n');
  return `### Sub-docs\n\n${items}`;
}

/**
 * Sub-documentation section provider
 *
 * Priority 300 - renders after context cache
 */
export const subDocsProvider: SectionProvider = {
  id: 'sub-docs',
  name: 'Sub-docs',
  priority: SectionPriority.SUB_DOCS,

  render(ctx: SectionContext): SectionResult {
    const content = renderSubDocs(ctx);

    // Return skip: true if empty (renders placeholder message instead)
    return {
      content,
      skip: !ctx.subDocs || ctx.subDocs.length === 0,
    };
  },
};
