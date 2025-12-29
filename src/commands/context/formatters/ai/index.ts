/**
 * @module commands/context/formatters/ai
 * @description AI-friendly XML formatter for context output
 *
 * Context Modes:
 * - minimal: Ultra-compact (~1500 tokens) - summary, git (no diff), memory only
 * - quick: Compact (~3500 tokens) - adds repo-map, schema, routes, architecture
 * - deep: Heavy analysis - imports, types, env, contracts
 * - full: All sections combined
 *
 * Section priority for optimal AI processing:
 * P0 (Critical ~200 tokens): summary, task
 * P1 (High - core understanding): git, repo-map, schema, routes
 * P2 (Medium - context enrichment): memory, lib-modules, architecture
 * P3 (Low - details on demand): tree, github-issues, library-docs, etc.
 */

import { optimizeXml } from '../../../../lib/@format';
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
  formatRepoMapSection,
  formatRoutesSection,
  formatSchemaSection,
  formatSummarySection,
  formatTaskSection,
  formatTestsSection,
  formatTodosSection,
  formatTreeSection,
  formatTypesSection,
} from './sections';

/**
 * Format context as AI-ready structured XML prompt
 *
 * Sections are ordered by priority for optimal AI token efficiency:
 * - P0 sections provide critical context in ~200 tokens
 * - P1 sections give core understanding of codebase
 * - P2 sections enrich with patterns and memory
 * - P3 sections provide details as needed
 */
export function formatAiPrompt(data: AiContextData): string {
  // Use minimal formatter for minimal mode
  if (data.mode === 'minimal') {
    return formatMinimalPrompt(data);
  }

  const lines: string[] = [];
  const domainKeywords = getDomainKeywords(data.context.domains, data.config);

  // Root element with mode and timestamp for AI reference
  lines.push(`<context mode="${data.mode}" generated="${data.generatedAt}">`);

  // ═══════════════════════════════════════════════════════════════════════════
  // P0: CRITICAL (~200 tokens each) - Read first for task understanding
  // ═══════════════════════════════════════════════════════════════════════════

  // Executive summary - compact overview of task, changes, issues
  formatSummarySection(lines, data);

  // Task details - what needs to be done (skip in quick mode - already in summary)
  if (data.mode !== 'quick') {
    formatTaskSection(lines, data);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // P1: HIGH - Core understanding of codebase structure
  // ═══════════════════════════════════════════════════════════════════════════

  // Git status - changed files list (critical for understanding scope)
  formatGitSection(lines, data);

  // Smart context: PageRank-ranked files (key for understanding codebase)
  formatRepoMapSection(lines, data);

  // Data sections (filtered by domain keywords)
  formatSchemaSection(lines, data, domainKeywords);
  formatRoutesSection(lines, data, domainKeywords);

  // ═══════════════════════════════════════════════════════════════════════════
  // P2: MEDIUM - Context enrichment from memory and patterns
  // ═══════════════════════════════════════════════════════════════════════════

  // Memory from previous sessions
  formatMemorySection(lines, data);

  // Lib modules from src/lib/@* (included in all modes)
  formatLibModulesSection(lines, data);

  // Architecture patterns (from --architecture)
  formatArchitectureSection(lines, data);

  // ═══════════════════════════════════════════════════════════════════════════
  // P3: LOW - Details on demand
  // ═══════════════════════════════════════════════════════════════════════════

  // Directory tree structure
  formatTreeSection(lines, data);

  // GitHub issues context
  formatGitHubIssuesSection(lines, data);

  // Library documentation from Context7 (auto-fetched)
  formatLibraryDocsSection(lines, data);

  // ═══════════════════════════════════════════════════════════════════════════
  // P4: SUPPLEMENTARY - Additional context sections
  // ═══════════════════════════════════════════════════════════════════════════

  // File contents and IO schemas
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

  // Apply aggressive optimization (33%+ token savings, <1% info loss)
  return optimizeXml(lines.join('\n'), { level: 'aggressive' }).output;
}

/**
 * Format minimal prompt using standard output + minify-xml
 *
 * Uses the same XML structure as other modes, but applies
 * minification to reduce token count.
 */
function formatMinimalPrompt(data: AiContextData): string {
  const lines: string[] = [];
  const domainKeywords = getDomainKeywords(data.context.domains, data.config);

  // Same structure as full mode
  lines.push(`<context mode="minimal" generated="${data.generatedAt}">`);

  // P0: Critical sections
  formatSummarySection(lines, data);

  // P1: Core understanding
  formatGitSection(lines, data);
  formatSchemaSection(lines, data, domainKeywords);
  formatRoutesSection(lines, data, domainKeywords);

  // P2: Context enrichment
  formatMemorySection(lines, data);

  lines.push('</context>');

  // Apply aggressive optimization
  return optimizeXml(lines.join('\n'), { level: 'aggressive' }).output;
}
