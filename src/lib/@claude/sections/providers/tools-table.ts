/**
 * @module lib/@claude/sections/providers/tools-table
 * @description Tools table section provider
 *
 * Generates markdown table of tools with template config.
 * Filters tools that have template configuration (not excluded).
 * Sorts by category then by name.
 */

import type { MCPToolDefinition } from '@/mcp/tools/core/types';
import type { SectionContext, SectionProvider, SectionResult } from '../types';
import { SectionPriority } from '../types';

/** Category sort order */
const CATEGORY_ORDER: Record<string, number> = {
  start: 0,
  context: 1,
  code: 2,
  memory: 3,
  advanced: 4,
};

/**
 * Type guard for tools with template config
 */
function hasTemplate(
  tool: MCPToolDefinition,
): tool is MCPToolDefinition & { template: NonNullable<MCPToolDefinition['template']> } {
  return tool.template !== undefined && tool.template.exclude !== true;
}

/**
 * Format tools table as markdown
 */
function renderToolsTable(ctx: SectionContext): string {
  const { tools } = ctx;

  // Filter tools with template config (not excluded)
  // Copy to avoid mutating readonly array
  const withTemplate = [...tools].filter(hasTemplate);

  if (withTemplate.length === 0) {
    return '';
  }

  // Sort by category then by name
  const sorted = withTemplate.sort((a, b) => {
    const catA = CATEGORY_ORDER[a.category ?? 'advanced'] ?? 99;
    const catB = CATEGORY_ORDER[b.category ?? 'advanced'] ?? 99;

    if (catA !== catB) {
      return catA - catB;
    }

    return a.name.localeCompare(b.name);
  });

  const lines: string[] = [];
  lines.push('### Tools');
  lines.push('');
  lines.push('| When | Tool | Params |');
  lines.push('|------|------|--------|');

  for (const tool of sorted) {
    const when = tool.template.when;
    const name = `\`${tool.name}\``;
    const params = tool.template.params;
    lines.push(`| **${when}** | ${name} | ${params} |`);
  }

  return lines.join('\n');
}

/**
 * Tools table section provider
 *
 * Priority 400 - renders last in the document
 */
export const toolsTableProvider: SectionProvider = {
  id: 'tools-table',
  name: 'Tools',
  priority: SectionPriority.TOOLS,

  render(ctx: SectionContext): SectionResult {
    const content = renderToolsTable(ctx);

    return {
      content,
      skip: content === '',
    };
  },
};
