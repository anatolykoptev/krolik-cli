/**
 * @module lib/claude/sections/providers/context-cache
 * @description Context cache section provider
 *
 * Static content about .krolik/CONTEXT.xml usage.
 * Includes mode table and refresh instructions.
 */

import type { SectionContext, SectionProvider, SectionResult } from '../types';
import { SectionPriority } from '../types';

/**
 * Static context cache documentation
 */
const CONTEXT_CACHE_CONTENT = `### Context Cache

**FIRST:** Read \`.krolik/CONTEXT.xml\` — if missing, run \`krolik_context -q\`

\`\`\`xml
<context mode="quick|deep|full" generated="ISO-timestamp">
\`\`\`

| Mode | Sections | Use |
|------|----------|-----|
| \`quick\` | architecture, git, tree, schema, routes | Fast overview |
| \`deep\` | imports, types, env, contracts | Heavy analysis |
| \`full\` | all sections | Complete context |

**Refresh if:** file missing, stale (>1h), or wrong mode`;

/**
 * Context cache section provider
 *
 * Priority 200 - renders after session startup
 */
export const contextCacheProvider: SectionProvider = {
  id: 'context-cache',
  name: 'Context Cache',
  priority: SectionPriority.CONTEXT_CACHE,

  render(_ctx: SectionContext): SectionResult {
    return {
      content: CONTEXT_CACHE_CONTENT,
    };
  },
};
