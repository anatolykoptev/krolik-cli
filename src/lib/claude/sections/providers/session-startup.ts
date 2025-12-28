/**
 * @module lib/claude/sections/providers/session-startup
 * @description Session startup section provider
 *
 * Generates ordered list of tools to call at session start.
 * Filters tools with workflow.trigger === 'session_start' and sorts by order.
 */

import type { SectionContext, SectionProvider, SectionResult } from '../types';
import { SectionPriority } from '../types';

/**
 * Format session startup instructions
 */
function renderSessionStartup(ctx: SectionContext): string {
  const { tools } = ctx;

  // Filter session_start tools and sort by order
  const sessionStartTools = [...tools]
    .filter((t) => t.workflow?.trigger === 'session_start')
    .sort((a, b) => (a.workflow?.order ?? 99) - (b.workflow?.order ?? 99));

  // Find krolik_context tool for special handling
  const contextTool = tools.find((t) => t.name === 'krolik_context');

  const lines: string[] = [];
  lines.push('### Session Startup');
  lines.push('');
  lines.push('**FIRST:** Call these tools at session start:');
  lines.push('');

  let order = 1;
  for (const tool of sessionStartTools) {
    const params = tool.template?.params ?? '—';
    lines.push(`${order}. \`${tool.name}\` ${params}`);
    order++;
  }

  // Add krolik_context at the end (not session_start trigger, but useful)
  if (contextTool) {
    const params = contextTool.template?.params ?? '—';
    lines.push(`${order}. \`${contextTool.name}\` ${params} (if working on specific feature)`);
  }

  return lines.join('\n');
}

/**
 * Session startup section provider
 *
 * Priority 100 - renders first in the document
 */
export const sessionStartupProvider: SectionProvider = {
  id: 'session-startup',
  name: 'Session Startup',
  priority: SectionPriority.SESSION_STARTUP,

  render(ctx: SectionContext): SectionResult {
    return {
      content: renderSessionStartup(ctx),
    };
  },
};
