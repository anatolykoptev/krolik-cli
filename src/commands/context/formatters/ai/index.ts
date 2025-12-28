/**
 * @module commands/context/formatters/ai
 * @description AI-friendly XML formatter for context output
 */

import { getDomainKeywords } from '../../../../lib/domains';
import type { AiContextData } from '../../types';
import {
  formatApiContractsSection,
  formatApproachSection,
  formatArchitectureSection,
  formatComponentsSection,
  formatDbRelationsSection,
  formatEnvVarsSection,
  formatFilesSection,
  formatGitHubIssuesSection,
  formatGitSection,
  formatHintsSection,
  formatImportGraphSection,
  formatImportsSection,
  formatIoSchemasSection,
  formatLibModulesSection,
  formatLibraryDocsSection,
  formatMemorySection,
  formatNextActionsSection,
  formatPreCommitSection,
  formatQualitySection,
  formatRoutesSection,
  formatSchemaSection,
  formatTaskSection,
  formatTestsSection,
  formatTodosSection,
  formatTreeSection,
  formatTypesSection,
} from './sections';

/**
 * Format context as AI-ready structured XML prompt
 */
export function formatAiPrompt(data: AiContextData): string {
  const lines: string[] = [];
  const domainKeywords = getDomainKeywords(data.context.domains, data.config);

  // Root element with mode and timestamp for AI reference
  lines.push(`<context mode="${data.mode}" generated="${data.generatedAt}">`);

  // Memory from previous sessions (first for context)
  formatMemorySection(lines, data);

  // Library documentation from Context7 (auto-fetched)
  formatLibraryDocsSection(lines, data);

  // Core sections
  formatTaskSection(lines, data);
  formatGitSection(lines, data);
  formatGitHubIssuesSection(lines, data);
  formatTreeSection(lines, data);

  // Architecture patterns (from --architecture)
  formatArchitectureSection(lines, data);

  // Lib modules from src/lib/@* (included in all modes)
  formatLibModulesSection(lines, data);

  // Data sections (filtered by keywords)
  formatSchemaSection(lines, data, domainKeywords);
  formatRoutesSection(lines, data, domainKeywords);
  formatFilesSection(lines, data);
  formatIoSchemasSection(lines, data);

  // TypeScript types and dependencies
  formatTypesSection(lines, data);
  formatImportsSection(lines, data);

  // Advanced analysis sections
  formatImportGraphSection(lines, data);
  formatDbRelationsSection(lines, data);
  formatApiContractsSection(lines, data);
  formatEnvVarsSection(lines, data);

  // Detail sections
  formatComponentsSection(lines, data);
  formatTestsSection(lines, data);
  formatHintsSection(lines, data);
  formatApproachSection(lines, data);

  // Quality issues (from --with-audit)
  formatQualitySection(lines, data);

  // TODO comments
  formatTodosSection(lines, data);

  formatPreCommitSection(lines);

  // Next actions guidance for AI
  formatNextActionsSection(lines, data);

  lines.push('</context>');
  lines.push('');
  lines.push('<!-- Copy this context to Claude/GPT for AI-assisted development -->');

  return lines.join('\n');
}
