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
  enrichWithSkills,
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

  // Use plugin skills if provided, otherwise fall back to Felix guardrails
  if (options.pluginSkills && options.pluginSkills.length > 0) {
    context.pluginSkills = options.pluginSkills;
  } else {
    enrichWithSkills(context, projectRoot, options.includeSkills !== false);
  }

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
 * Format skills section
 */
function formatSkillsSection(context: AgentContext): string | null {
  if (!context.skills || context.skills.length === 0) return null;

  // Group by category for better readability
  const byCategory: Record<string, typeof context.skills> = {};
  for (const skill of context.skills) {
    if (!byCategory[skill.category]) {
      byCategory[skill.category] = [];
    }
    byCategory[skill.category]!.push(skill);
  }

  const sections: string[] = [];

  for (const [category, skills] of Object.entries(byCategory)) {
    sections.push(`  <category name="${category}">`);
    for (const skill of skills) {
      // Use CDATA for content to be safe
      sections.push(`    <skill severity="${skill.severity}" title="${skill.title}">`);
      sections.push(`      <problem><![CDATA[${skill.problem}]]></problem>`);
      sections.push(`      <solution><![CDATA[${skill.solution}]]></solution>`);
      if (skill.example) {
        sections.push(`      <example><![CDATA[${skill.example}]]></example>`);
      }
      sections.push(`    </skill>`);
    }
    sections.push(`  </category>`);
  }

  return `<agent-skills>
${sections.join('\n')}
</agent-skills>`;
}

/**
 * Format plugin skills section (skills from agent's plugin)
 */
function formatPluginSkillsSection(context: AgentContext): string | null {
  if (!context.pluginSkills || context.pluginSkills.length === 0) return null;

  const sections: string[] = [];

  for (const skill of context.pluginSkills) {
    sections.push(`  <skill name="${skill.name}" plugin="${skill.plugin}">`);
    sections.push(`    <description>${skill.description}</description>`);
    sections.push(`    <content><![CDATA[${skill.content}]]></content>`);
    sections.push(`  </skill>`);
  }

  return `<plugin-skills>
${sections.join('\n')}
</plugin-skills>`;
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

  // Plugin skills take priority over Felix guardrails
  const pluginSkills = formatPluginSkillsSection(context);
  if (pluginSkills) {
    sections.push(pluginSkills);
  } else {
    const skills = formatSkillsSection(context);
    if (skills) sections.push(skills);
  }

  return `<project-context>
${sections.join('\n\n')}
</project-context>`;
}
