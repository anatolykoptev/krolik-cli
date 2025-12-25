/**
 * @module lib/@docs/template
 * @description Krolik documentation template for CLAUDE.md injection
 *
 * MINIMAL: Only includes info NOT available through MCP tool definitions:
 * - Quick Start workflow (order of operations)
 * - Context cache location
 * - Sub-docs paths
 *
 * Tools descriptions, params, "when to use" are available via MCP toolset.
 */

import { findSubDocs, type SubDocInfo } from '@/lib/@discovery';
import { getAllTools } from '@/mcp/tools';
import { KROLIK_VERSION, TEMPLATE_VERSION } from '@/version';

// Re-export for backwards compatibility
export { KROLIK_VERSION, TEMPLATE_VERSION as DOCS_VERSION } from '@/version';

/** Start/end markers for krolik section in CLAUDE.md */
export const KROLIK_SECTION_START = '<!-- krolik:start -->';
export const KROLIK_SECTION_END = '<!-- krolik:end -->';

/**
 * Generate Quick Start from session_start workflow + context
 */
function formatQuickStart(): string {
  const tools = getAllTools();
  const sessionStart = tools
    .filter((t) => t.workflow?.trigger === 'session_start')
    .sort((a, b) => (a.workflow?.order ?? 99) - (b.workflow?.order ?? 99));

  const contextTool = tools.find((t) => t.name === 'krolik_context');

  if (sessionStart.length === 0) return '';

  const steps = sessionStart.map((t) => t.name);
  if (contextTool) steps.push(contextTool.name);

  return steps.join(' → ');
}

/**
 * Format Sub-docs as compact list
 */
function formatSubDocs(subDocs: SubDocInfo[]): string {
  if (subDocs.length === 0) return '';

  const items = subDocs.map((doc) => `- ${doc.label}: \`${doc.path}\``).join('\n');
  return `**Sub-docs:**
${items}`;
}

/**
 * Generate minimal krolik documentation for CLAUDE.md
 * Only includes info NOT available through MCP
 */
export function generateKrolikDocs(projectRoot?: string): string {
  const subDocs = projectRoot ? findSubDocs(projectRoot) : [];
  const quickStart = formatQuickStart();
  const subDocsSection = formatSubDocs(subDocs);

  return `${KROLIK_SECTION_START}
<!-- krolik: ${KROLIK_VERSION} | template: ${TEMPLATE_VERSION} -->

## 🐰 Krolik

**Start:** ${quickStart}

**Context:** \`.krolik/CONTEXT.xml\` (missing? run \`krolik_context -q\`)

${subDocsSection}

${KROLIK_SECTION_END}`;
}

/**
 * Minimal CLAUDE.md template for projects without one
 */
export function generateMinimalClaudeMd(projectName: string, projectRoot?: string): string {
  return `# CLAUDE.md — ${projectName}

> AI instructions for this project.

---

${generateKrolikDocs(projectRoot)}

---

## Project Notes

Add your project-specific instructions here.
`;
}
