/**
 * @module lib/@claude/template
 * @description Krolik documentation template for CLAUDE.md injection
 *
 * Uses the section system to generate modular, composable documentation.
 * Sections are registered and executed to produce the final output.
 */

import { findSubDocs } from '@/lib/@discovery';
import { getAllTools } from '@/mcp/tools';
import { TEMPLATE_VERSION } from '@/version';

// Import section system
import {
  createSectionContext,
  executeSections,
  getOrderedSections,
  registerBuiltinSections,
  registry,
} from './sections';

// Re-export for backwards compatibility
export { KROLIK_VERSION, TEMPLATE_VERSION as DOCS_VERSION } from '@/version';
export { TEMPLATE_VERSION };

/** Start/end markers for krolik section in CLAUDE.md */
export const KROLIK_SECTION_START = '<!-- krolik:start -->';
export const KROLIK_SECTION_END = '<!-- krolik:end -->';

export { registerSection } from './sections/registry';
// Re-export section system for external use
export * from './sections/types';

// ============================================================================
// INITIALIZATION
// ============================================================================

/** Track if builtin sections have been registered */
let builtinSectionsRegistered = false;

/**
 * Ensure builtin sections are registered (idempotent)
 */
function ensureBuiltinSections(): void {
  if (builtinSectionsRegistered) return;
  registerBuiltinSections(registry);
  builtinSectionsRegistered = true;
}

// ============================================================================
// ASYNC GENERATION (preferred)
// ============================================================================

/**
 * Generate krolik documentation for CLAUDE.md (async)
 *
 * Uses the section system to generate modular content.
 * Sections are executed in priority order with dependency resolution.
 *
 * @param projectRoot - Project root directory
 * @returns Generated markdown content
 */
export async function generateKrolikDocsAsync(projectRoot?: string): Promise<string> {
  ensureBuiltinSections();

  const root = projectRoot ?? process.cwd();

  const ctx = createSectionContext({
    projectRoot: root,
    tools: getAllTools(),
    subDocs: findSubDocs(root),
    version: TEMPLATE_VERSION,
  });

  const results = await executeSections(ctx);

  // Collect non-skipped content in order
  const sections: string[] = [];
  for (const result of results.values()) {
    if (!result.skip && result.content) {
      sections.push(result.content);
    }
  }

  return `${KROLIK_SECTION_START}
<!-- version: ${TEMPLATE_VERSION} | auto-updated -->

## 🐰 Krolik

${sections.join('\n\n')}

${KROLIK_SECTION_END}`;
}

// ============================================================================
// SYNC GENERATION (backwards compatibility)
// ============================================================================

/**
 * Generate krolik documentation for CLAUDE.md (sync)
 *
 * Synchronous version for backwards compatibility.
 * Uses ordered sections but renders synchronously.
 *
 * @param projectRoot - Project root directory
 * @returns Generated markdown content
 */
export function generateKrolikDocs(projectRoot?: string): string {
  ensureBuiltinSections();

  const root = projectRoot ?? process.cwd();
  const tools = getAllTools();
  const subDocs = findSubDocs(root);

  // Create context with cache
  const ctx = createSectionContext({
    projectRoot: root,
    tools,
    subDocs,
    version: TEMPLATE_VERSION,
  });

  // Get ordered sections
  const orderedSections = getOrderedSections();

  // Render sections synchronously
  const sections: string[] = [];

  for (const section of orderedSections) {
    // Check shouldRender
    if (section.shouldRender && !section.shouldRender(ctx)) {
      continue;
    }

    try {
      const result = section.render(ctx);

      // Handle string shorthand or SectionResult
      if (typeof result === 'string') {
        if (result) {
          sections.push(result);
        }
      } else if (!result.skip && result.content) {
        sections.push(result.content);
      }
    } catch (error) {
      // Log error but continue with other sections
      console.error(`Section "${section.id}" failed:`, error);
    }
  }

  return `${KROLIK_SECTION_START}
<!-- version: ${TEMPLATE_VERSION} | auto-updated -->

## 🐰 Krolik

${sections.join('\n\n')}

${KROLIK_SECTION_END}`;
}

// ============================================================================
// MINIMAL TEMPLATE
// ============================================================================

/**
 * Minimal CLAUDE.md template for projects without one
 *
 * @param projectName - Name of the project
 * @param projectRoot - Project root directory
 * @returns Complete CLAUDE.md content
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

/**
 * Minimal CLAUDE.md template (async version)
 *
 * @param projectName - Name of the project
 * @param projectRoot - Project root directory
 * @returns Complete CLAUDE.md content
 */
export async function generateMinimalClaudeMdAsync(
  projectName: string,
  projectRoot?: string,
): Promise<string> {
  const krolikDocs = await generateKrolikDocsAsync(projectRoot);

  return `# CLAUDE.md — ${projectName}

> AI instructions for this project.

---

${krolikDocs}

---

## Project Notes

Add your project-specific instructions here.
`;
}
