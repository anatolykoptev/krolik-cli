/**
 * @module commands/refactor/output/ai-native
 * @description AI-native XML formatter using registry-based architecture
 *
 * Converts EnhancedRefactorAnalysis to SectionContext and uses
 * SectionRegistry for rendering. This is an adapter layer that
 * bridges the legacy analysis interface with the new registry system.
 *
 * Output levels control verbosity and token budget:
 * - summary: ~10K tokens (critical insights only)
 * - standard: ~25K tokens (balanced for most use cases)
 * - full: unlimited (complete analysis)
 */

import { optimizeXml } from '../../../lib/@format';
import type { DuplicatesAnalysis } from '../analyzers/modules/duplicates.analyzer';
import type { RecommendationsAnalysis } from '../analyzers/modules/recommendations.analyzer';
import type { AnalyzerResult } from '../analyzers/registry';
import type { EnhancedRefactorAnalysis } from '../core';
import { getLimits, type OutputLevel, selectOutputLevel } from './limits';
import { type SectionContext, sectionRegistry } from './registry';

// Import modules to trigger auto-registration
import './sections/modules';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Analysis mode for XML output
 */
export type AnalysisMode = 'quick' | 'default' | 'deep';

/**
 * Options for AI-native XML formatting
 */
export interface AiNativeXmlOptions {
  /** Analysis mode (quick/default/deep) */
  mode?: AnalysisMode;
  /** Execution time in milliseconds */
  executionTimeMs?: number;
  /** Explicit output level (summary/standard/full) */
  outputLevel?: OutputLevel;
  /** Token budget for auto-selecting output level */
  tokenBudget?: number;
}

// ============================================================================
// ADAPTER: EnhancedRefactorAnalysis → SectionContext
// ============================================================================

/**
 * Mapping from analyzer IDs to EnhancedRefactorAnalysis fields
 */
const ANALYZER_FIELD_MAP: Record<string, keyof EnhancedRefactorAnalysis> = {
  'project-context': 'projectContext',
  architecture: 'archHealth',
  domains: 'domains',
  navigation: 'aiNavigation',
  migration: 'enhancedMigration',
  recommendations: 'recommendations',
  reusable: 'reusableModules',
  'file-size': 'fileSizeAnalysis',
  ranking: 'rankingAnalysis',
  duplicates: 'duplicates', // Special handling needed
  i18n: 'i18nAnalysis', // Hardcoded strings
  api: 'apiAnalysis', // API routes
};

/**
 * Convert EnhancedRefactorAnalysis to SectionContext.
 *
 * This adapter creates AnalyzerResult wrappers for each piece of data,
 * allowing sections to consume the data through the standard registry interface.
 */
function analysisToSectionContext(
  analysis: EnhancedRefactorAnalysis,
  outputLevel: OutputLevel,
  executionTimeMs?: number,
): SectionContext {
  const results = new Map<string, AnalyzerResult<unknown>>();

  // Convert each analysis field to an AnalyzerResult
  for (const [analyzerId, field] of Object.entries(ANALYZER_FIELD_MAP)) {
    const data = analysis[field];

    if (data !== undefined && data !== null) {
      // Handle special cases
      if (analyzerId === 'duplicates') {
        // Convert duplicates to DuplicatesAnalysis format
        const duplicatesData: DuplicatesAnalysis = {
          functions: analysis.duplicates ?? [],
          types: analysis.typeDuplicates ?? [],
          totalCount: (analysis.duplicates?.length ?? 0) + (analysis.typeDuplicates?.length ?? 0),
        };
        results.set(analyzerId, { status: 'success', data: duplicatesData });
      } else if (analyzerId === 'recommendations') {
        // Convert recommendations to RecommendationsAnalysis format
        const recs = analysis.recommendations ?? [];
        const byCategory = {
          architecture: 0,
          duplication: 0,
          structure: 0,
          naming: 0,
          documentation: 0,
        };
        let totalExpectedImprovement = 0;
        for (const rec of recs) {
          byCategory[rec.category]++;
          totalExpectedImprovement += rec.expectedImprovement;
        }
        const recsData: RecommendationsAnalysis = {
          recommendations: recs,
          byCategory,
          autoFixableCount: recs.filter((r) => r.autoFixable).length,
          totalExpectedImprovement,
        };
        results.set(analyzerId, { status: 'success', data: recsData });
      } else {
        results.set(analyzerId, { status: 'success', data });
      }
    } else {
      results.set(analyzerId, { status: 'skipped' });
    }
  }

  // Create section context
  const limits = getLimits(outputLevel);

  return {
    results,
    limits,
    outputLevel,
    options: {
      mode: 'default',
      executionTimeMs,
      path: analysis.path,
      timestamp: analysis.timestamp,
    },
  };
}

// ============================================================================
// MAIN FORMATTER
// ============================================================================

/**
 * Format enhanced analysis as AI-native XML using registry.
 *
 * @param analysis - Enhanced refactor analysis data
 * @param options - Formatting options including output level control
 * @returns Optimized XML string for AI consumption
 */
export function formatAiNativeXml(
  analysis: EnhancedRefactorAnalysis,
  options: AiNativeXmlOptions = {},
): string {
  const mode = options.mode ?? 'default';

  // Determine output level: explicit > auto-select from budget > default 'standard'
  const outputLevel: OutputLevel = options.outputLevel ?? selectOutputLevel(options.tokenBudget);

  // Convert analysis to section context
  const ctx = analysisToSectionContext(analysis, outputLevel, options.executionTimeMs);

  // Build output
  const lines: string[] = [];

  // XML header
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<!--');
  lines.push('  AI-NATIVE REFACTOR ANALYSIS');
  lines.push('  This output is optimized for AI agents like Claude Code.');
  lines.push(`  Output level: ${outputLevel}`);
  lines.push(
    '  Structure: stats -> context -> ai-config -> architecture -> ranking -> recommendations -> [domains] -> duplicates -> migration -> modules -> files -> [navigation]',
  );
  lines.push('  Sections in brackets are conditional based on output level.');
  lines.push('-->');
  lines.push('');

  // Root element
  lines.push(
    `<refactor-analysis mode="${mode}" level="${outputLevel}" timestamp="${analysis.timestamp}" path="${analysis.path}">`,
  );

  // Render all sections using registry
  const sectionLines = sectionRegistry.formatAll(ctx);
  lines.push(...sectionLines);

  // Close root element
  lines.push('</refactor-analysis>');

  return optimizeXml(lines.join('\n'), { level: 'aggressive' }).output;
}
