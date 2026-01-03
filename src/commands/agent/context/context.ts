/**
 * @module commands/agent/context/context
 * @description Main context building and formatting for agents
 */

import type { AgentContext, AgentOptions } from '../types';
import {
  enrichWithFeature,
  enrichWithGitInfo,
  enrichWithMemories,
  enrichWithRoutes,
  enrichWithSchema,
  enrichWithTargetFile,
} from './enrichers';

/**
 * Build agent context from project
 */
export async function buildAgentContext(
  projectRoot: string,
  options: AgentOptions,
): Promise<AgentContext> {
  const context: AgentContext = { projectRoot };

  enrichWithSchema(context, projectRoot, options.includeSchema !== false);
  enrichWithRoutes(context, projectRoot, options.includeRoutes !== false);
  enrichWithGitInfo(context, projectRoot, options.includeGit !== false);
  enrichWithTargetFile(context, projectRoot, options.file);
  enrichWithFeature(context, projectRoot, options.feature);
  enrichWithMemories(context, projectRoot, options.feature, options.includeMemory);

  return context;
}

// ============================================================================
// PROMPT FORMATTING HELPERS
// ============================================================================

/**
 * Format target file section
 */
function formatTargetFileSection(context: AgentContext): string | null {
  if (!context.targetFile || !context.targetContent) return null;
  return `<target-file path="${context.targetFile}">
${context.targetContent}
</target-file>`;
}

/**
 * Format library docs section
 */
function formatLibraryDocsSection(context: AgentContext): string | null {
  if (!context.libraryDocs || context.libraryDocs.length === 0) return null;

  const docsContent = context.libraryDocs
    .map(
      (doc) => `<doc library="${doc.library}" title="${doc.title}">
${doc.snippet}
</doc>`,
    )
    .join('\n');

  return `<library-docs>
${docsContent}
</library-docs>`;
}

/**
 * Format memories section
 */
function formatMemoriesSection(context: AgentContext): string | null {
  if (!context.memories || context.memories.length === 0) return null;

  const memoriesContent = context.memories
    .map(
      (mem) => `<memory type="${mem.type}" importance="${mem.importance}">
  <title>${mem.title}</title>
  <description>${mem.description}</description>${mem.tags.length > 0 ? `\n  <tags>${mem.tags.join(', ')}</tags>` : ''}${mem.features && mem.features.length > 0 ? `\n  <features>${mem.features.join(', ')}</features>` : ''}
</memory>`,
    )
    .join('\n');

  return `<memories>
${memoriesContent}
</memories>`;
}

/**
 * Format context for agent prompt
 */
export function formatContextForPrompt(context: AgentContext): string {
  const sections: string[] = [];

  sections.push(`<project-root>${context.projectRoot}</project-root>`);

  if (context.feature) {
    sections.push(`<feature>${context.feature}</feature>`);
  }

  const targetFile = formatTargetFileSection(context);
  if (targetFile) sections.push(targetFile);

  if (context.schema) {
    sections.push(`<database-schema>
${context.schema}
</database-schema>`);
  }

  if (context.routes) {
    sections.push(`<api-routes>
${context.routes}
</api-routes>`);
  }

  if (context.gitStatus) {
    sections.push(`<git-status>
${context.gitStatus}
</git-status>`);
  }

  if (context.gitDiff) {
    sections.push(`<git-diff>
${context.gitDiff}
</git-diff>`);
  }

  const libraryDocs = formatLibraryDocsSection(context);
  if (libraryDocs) sections.push(libraryDocs);

  const memories = formatMemoriesSection(context);
  if (memories) sections.push(memories);

  return `<project-context>
${sections.join('\n\n')}
</project-context>`;
}
