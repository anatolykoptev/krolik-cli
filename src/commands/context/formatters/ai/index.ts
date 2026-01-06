/**
 * @module commands/context/formatters/ai
 * @description AI-friendly XML formatter for context output
 *
 * Context Modes:
 * - minimal: Ultra-compact (~1500 tokens) - summary, git (no diff), memory only
 * - quick: Compact (~3500 tokens) - adds repo-map, schema-highlights, routes-summary
 * - deep: Heavy analysis - imports, types, env, contracts, limited full sections
 * - full: All sections combined with both summaries and full details
 *
 * Token Budget Optimization (Phase 4):
 * | Mode  | Max Files | Sigs/File | Routes          | Schema          |
 * |-------|-----------|-----------|-----------------|-----------------|
 * | quick | 30        | 5         | summary only    | highlights only |
 * | deep  | 40        | 8         | top 5 full      | top 4 full      |
 * | full  | 50        | 10        | summary + top10 | highlights + 8  |
 *
 * Domain-Scoped Filtering (Phase 5):
 * When --feature booking is used, ALL sections are filtered to show only
 * booking-related data. This provides ~40% token reduction:
 * - Files: ~15 (instead of 50)
 * - Models: ~4 (instead of 78)
 * - Routers: ~8 (instead of 83)
 *
 * Section priority for optimal AI processing:
 * P0 (Critical ~200 tokens): summary, constraints, task
 * P1 (High - core understanding): git, repo-map, schema, routes
 * P2 (Medium - context enrichment): memory, lib-modules, architecture
 * P3 (Low - details on demand): tree, github-issues, library-docs, etc.
 */

import { optimizeXml } from '../../../../lib/@format';
import { getDomainKeywords } from '../../../../lib/domains';
import type { AiContextData } from '../../types';
import { getModeLimits } from './constants';
import { matchesDomain, modelMatchesDomain, routerMatchesDomain } from './filters';
import {
  formatApiContractsSection,
  formatApproachSection,
  formatArchitectureSection,
  // formatComponentsSection - REMOVED: just lists names without usage context
  formatConstraintsSection,
  formatDataFlowSection,
  formatDbRelationsSection,
  formatEntryPointsSection,
  formatEnvVarsSection,
  formatFilesSection,
  formatGitHubIssuesSection,
  formatGitSection,
  formatHintsSection,
  formatImportGraphSection,
  // formatImportsSection - REMOVED: too verbose, import-graph covers hot-files
  formatIoSchemasSection,
  formatLibModulesSection,
  formatLibraryDocsSection,
  formatMemorySection,
  formatNextActionsSection,
  formatPreCommitSection,
  formatQualitySection,
  formatQuickRefSection,
  formatRepoMapSection,
  formatRoutesSection,
  formatRoutesSummarySection,
  formatSchemaHighlightsSection,
  formatSchemaSection,
  formatSearchResultsSection,
  formatSummarySection,
  formatTaskSection,
  formatTestsSection,
  formatTodosSection,
  formatTreeSection,
  formatTypesSection,
} from './sections';

/**
 * Apply domain-scoped filtering to context data (Phase 5)
 *
 * When domains are detected (e.g., from --feature booking), this filters
 * ALL sections to show only domain-related data for ~40% token reduction.
 *
 * @param data - Original context data
 * @returns Domain-filtered context data (mutates data in place for efficiency)
 */
function applyDomainFiltering(data: AiContextData): AiContextData {
  const domains = data.context.domains;
  if (domains.length === 0) {
    return data;
  }

  // Filter schema models by domain
  if (data.schema) {
    data.schema = {
      ...data.schema,
      models: data.schema.models.filter((m) => modelMatchesDomain(m, domains)),
    };
  }

  // Filter routes routers by domain
  if (data.routes) {
    data.routes = {
      ...data.routes,
      routers: data.routes.routers.filter((r) => routerMatchesDomain(r, domains)),
    };
  }

  // Filter related files by domain
  if (data.context.relatedFiles) {
    data.context = {
      ...data.context,
      relatedFiles: data.context.relatedFiles.filter((f) => matchesDomain(f, domains)),
    };
  }

  // Filter import graph nodes by domain
  if (data.importGraph) {
    data.importGraph = {
      ...data.importGraph,
      nodes: data.importGraph.nodes.filter((n) => matchesDomain(n.file, domains)),
    };
  }

  // Filter dbRelations models and relations by domain
  if (data.dbRelations) {
    const filteredModels = data.dbRelations.models.filter((m) =>
      domains.some((d) => m.toLowerCase().includes(d.toLowerCase())),
    );
    const filteredRelations = data.dbRelations.relations.filter(
      (r) =>
        domains.some((d) => r.from.toLowerCase().includes(d.toLowerCase())) ||
        domains.some((d) => r.to.toLowerCase().includes(d.toLowerCase())),
    );
    data.dbRelations = {
      ...data.dbRelations,
      models: filteredModels,
      relations: filteredRelations,
    };
  }

  // Filter apiContracts by domain
  if (data.apiContracts) {
    data.apiContracts = data.apiContracts.filter((c) =>
      domains.some((d) => c.name.toLowerCase().includes(d.toLowerCase())),
    );
  }

  return data;
}

/**
 * Format context as AI-ready structured XML prompt
 *
 * Sections are ordered by priority for optimal AI token efficiency:
 * - P0 sections provide critical context in ~200 tokens
 * - P1 sections give core understanding of codebase
 * - P2 sections enrich with patterns and memory
 * - P3 sections provide details as needed
 *
 * Mode-based section selection:
 * - quick: summaries INSTEAD of full (saves ~600 tokens)
 * - deep: full sections only with reduced limits
 * - full: BOTH summaries AND full sections
 */
export function formatAiPrompt(data: AiContextData): string {
  // Use minimal formatter for minimal mode
  if (data.mode === 'minimal') {
    return formatMinimalPrompt(applyDomainFiltering(data));
  }

  // Apply domain-scoped filtering (Phase 5) - ~40% token reduction when feature is specified
  const filteredData = applyDomainFiltering(data);

  const lines: string[] = [];
  const domainKeywords = getDomainKeywords(filteredData.context.domains, filteredData.config);

  // Get mode-based limits for section selection
  const limits = getModeLimits(filteredData.mode);

  // Root element with mode and timestamp for AI reference
  lines.push(`<context mode="${filteredData.mode}" generated="${filteredData.generatedAt}">`);

  // ═══════════════════════════════════════════════════════════════════════════
  // P0: QUICK-REF (~150 tokens) - FIRST section for immediate agent guidance
  // ═══════════════════════════════════════════════════════════════════════════

  // Quick reference: hot files, git summary, memory highlights, next actions
  formatQuickRefSection(lines, filteredData);

  // ═══════════════════════════════════════════════════════════════════════════
  // P0: CRITICAL (~200 tokens each) - Read first for task understanding
  // ═══════════════════════════════════════════════════════════════════════════

  // Executive summary - compact overview of task, changes, issues
  formatSummarySection(lines, filteredData);

  // Critical constraints - hard requirements (cascade, concurrency, validation)
  formatConstraintsSection(lines, filteredData);

  // Task details - what needs to be done (skip in quick mode - already in summary)
  if (filteredData.mode !== 'quick') {
    formatTaskSection(lines, filteredData);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // P1: HIGH - Core understanding of codebase structure
  // ═══════════════════════════════════════════════════════════════════════════

  // Git status - changed files list (critical for understanding scope)
  formatGitSection(lines, filteredData);

  // Search results - from --search option (shows code matching pattern)
  formatSearchResultsSection(lines, filteredData);

  // Smart context: PageRank-ranked files (key for understanding codebase)
  formatRepoMapSection(lines, filteredData);

  // Schema section: mode-based output
  // - quick: highlights ONLY (summaryOnly=true in formatSchemaSection will skip full)
  // - deep: full section only (top 4 models)
  // - full: BOTH highlights AND full section
  if (limits.schema.highlightsOnly) {
    // Quick mode: use highlights INSTEAD of full schema
    formatSchemaHighlightsSection(lines, filteredData, limits.schema.highlightsLimit);
  } else {
    // Deep/Full mode: show full schema (with mode-based limits)
    formatSchemaSection(lines, filteredData, domainKeywords);
    // Full mode: also show highlights for quick overview
    if (filteredData.mode === 'full') {
      formatSchemaHighlightsSection(lines, filteredData, limits.schema.highlightsLimit);
    }
  }

  // Routes section: mode-based output
  // - quick: summary ONLY (summaryOnly=true in formatRoutesSection will skip full)
  // - deep: full section only (top 5 routers)
  // - full: BOTH summary AND full section
  if (limits.routes.summaryOnly) {
    // Quick mode: use summary INSTEAD of full routes
    formatRoutesSummarySection(lines, filteredData, limits.routes.summaryLimit);
  } else {
    // Deep/Full mode: show full routes (with mode-based limits)
    formatRoutesSection(lines, filteredData, domainKeywords);
    // Full mode: also show summary for quick overview
    if (filteredData.mode === 'full') {
      formatRoutesSummarySection(lines, filteredData, limits.routes.summaryLimit);
    }
  }

  // Entry points and data flow (~250 tokens total)
  // Shows WHERE to start reading code and HOW data moves through the system
  formatEntryPointsSection(lines, filteredData);
  formatDataFlowSection(lines, filteredData);

  // ═══════════════════════════════════════════════════════════════════════════
  // P2: MEDIUM - Context enrichment from memory and patterns
  // ═══════════════════════════════════════════════════════════════════════════

  // Memory from previous sessions
  formatMemorySection(lines, filteredData);

  // Lib modules from src/lib/@* (included in all modes)
  formatLibModulesSection(lines, filteredData);

  // Architecture patterns (from --architecture)
  formatArchitectureSection(lines, filteredData);

  // ═══════════════════════════════════════════════════════════════════════════
  // P3: LOW - Details on demand
  // ═══════════════════════════════════════════════════════════════════════════

  // Directory tree structure
  formatTreeSection(lines, filteredData);

  // GitHub issues context
  formatGitHubIssuesSection(lines, filteredData);

  // Library documentation from Context7 (auto-fetched)
  formatLibraryDocsSection(lines, filteredData);

  // ═══════════════════════════════════════════════════════════════════════════
  // P4: SUPPLEMENTARY - Additional context sections
  // ═══════════════════════════════════════════════════════════════════════════

  // File contents and IO schemas
  formatFilesSection(lines, filteredData);
  formatIoSchemasSection(lines, filteredData);

  // TypeScript types
  formatTypesSection(lines, filteredData);
  // NOTE: formatImportsSection removed - <dependencies> was too verbose
  // Use <import-graph> instead (shows hot-files + circular deps)

  // Advanced analysis sections
  formatImportGraphSection(lines, filteredData);
  formatDbRelationsSection(lines, filteredData);
  formatApiContractsSection(lines, filteredData);
  formatEnvVarsSection(lines, filteredData);

  // Detail sections (components removed - just listed names without context)
  formatTestsSection(lines, filteredData);
  formatHintsSection(lines, filteredData);
  formatApproachSection(lines, filteredData);

  // Quality issues (from --with-audit)
  formatQualitySection(lines, filteredData);

  // TODO comments
  formatTodosSection(lines, filteredData);

  formatPreCommitSection(lines);

  // Next actions guidance for AI
  formatNextActionsSection(lines, filteredData);

  lines.push('</context>');

  // Apply aggressive optimization (33%+ token savings, <1% info loss)
  return optimizeXml(lines.join('\n'), { level: 'aggressive' }).output;
}

/**
 * Format minimal prompt using standard output + minify-xml
 *
 * Uses the same XML structure as other modes, but applies
 * minification to reduce token count. Uses reduced limits
 * for summary sections.
 */
function formatMinimalPrompt(data: AiContextData): string {
  const lines: string[] = [];
  const limits = getModeLimits('minimal');

  // Same structure as full mode
  lines.push(`<context mode="minimal" generated="${data.generatedAt}">`);

  // P0: Quick-ref FIRST for immediate guidance
  formatQuickRefSection(lines, data);

  // P0: Critical sections
  formatSummarySection(lines, data);

  // P0: Critical constraints (only show critical severity in minimal mode)
  formatConstraintsSection(lines, data);

  // P1: Core understanding - use summary versions for compact output
  formatGitSection(lines, data);
  formatSchemaHighlightsSection(lines, data, limits.schema.highlightsLimit);
  formatRoutesSummarySection(lines, data, limits.routes.summaryLimit);

  // P2: Context enrichment
  formatMemorySection(lines, data);

  lines.push('</context>');

  // Apply aggressive optimization
  return optimizeXml(lines.join('\n'), { level: 'aggressive' }).output;
}
