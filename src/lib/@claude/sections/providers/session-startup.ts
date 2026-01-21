/**
 * @module lib/@claude/sections/providers/session-startup
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
function renderSessionStartup(_ctx: SectionContext): string {
  const lines: string[] = [];
  lines.push('### Session Startup');
  lines.push('');
  lines.push('**FIRST:** Call tools at session start:');
  lines.push('');
  lines.push('1. `krolik_status` `fast: true`');
  lines.push('2. `krolik_mem_recent` `limit: 5`');
  lines.push(
    '3. `krolik_context` `feature: "..."` or `issue: "123"` (if working on specific feature)',
  );
  lines.push('');
  lines.push('> All tools are available via MCP. Use tool descriptions to find what you need.');

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
