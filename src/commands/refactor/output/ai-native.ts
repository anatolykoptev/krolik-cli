/**
 * @module commands/refactor/output/ai-native
 * @description AI-native XML formatter for refactor analysis
 *
 * Orchestrates section formatters to produce structured XML output
 * optimized for AI agents:
 * - Dependency graphs for impact analysis
 * - Domain classification with coherence scores
 * - Migration ordering with prerequisites
 * - Prioritized recommendations
 * - Navigation hints for code placement
 *
 * Output levels control verbosity and token budget:
 * - summary: ~10K tokens (critical insights only)
 * - standard: ~25K tokens (balanced for most use cases)
 * - full: unlimited (complete analysis)
 *
 * Structure:
 * <refactor-analysis mode="..." level="..." timestamp="..." path="...">
 *   <stats />
 *   <project-context />
 *   <ai-config />
 *   <architecture-health />
 *   <ranking-analysis />
 *   <recommendations />       <!-- limited by outputLevel -->
 *   <domains />               <!-- skipped if !includeDomains -->
 *   <duplicates />            <!-- limited by outputLevel -->
 *   <migration />             <!-- limited by outputLevel -->
 *   <reusable-modules />
 *   <file-size-analysis />
 *   <ai-navigation />         <!-- skipped if !includeStaticSections -->
 * </refactor-analysis>
 */

import { optimizeXml } from '../../../lib/format';
import type { EnhancedRefactorAnalysis } from '../core';
import { getLimits, type OutputLevel, type SectionLimits, selectOutputLevel } from './limits';
import {
  formatAiConfig,
  formatAiNavigation,
  formatArchitectureHealth,
  formatDomains,
  formatDuplicates,
  formatFileSizeAnalysis,
  formatMigration,
  formatProjectContext,
  formatRankingAnalysis,
  formatRecommendations,
  formatReusableModules,
  formatStats,
} from './sections';

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

/**
 * Format enhanced analysis as AI-native XML
 *
 * @param analysis - Enhanced refactor analysis data
 * @param options - Formatting options including output level control
 * @returns Optimized XML string for AI consumption
 */
export function formatAiNativeXml(
  analysis: EnhancedRefactorAnalysis,
  options: AiNativeXmlOptions = {},
): string {
  const lines: string[] = [];
  const mode = options.mode ?? 'default';

  // Determine output level: explicit > auto-select from budget > default 'standard'
  const outputLevel: OutputLevel = options.outputLevel ?? selectOutputLevel(options.tokenBudget);
  const limits: SectionLimits = getLimits(outputLevel);

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

  lines.push(
    `<refactor-analysis mode="${mode}" level="${outputLevel}" timestamp="${analysis.timestamp}" path="${analysis.path}">`,
  );

  // Stats summary (with optional execution time)
  formatStats(lines, analysis, options.executionTimeMs);

  // Project context
  formatProjectContext(lines, analysis);

  // AI config (namespace definitions and patterns)
  formatAiConfig(lines, analysis);

  // Architecture health
  formatArchitectureHealth(lines, analysis);

  // PageRank-based ranking analysis (hotspots, coupling, safe order)
  // This is the most important section for AI agents - shows what to refactor first
  formatRankingAnalysis(lines, analysis);

  // Recommendations (prioritized by PageRank insights)
  formatRecommendations(lines, analysis, limits);

  // Domain classification (conditional based on output level)
  if (limits.includeDomains) {
    formatDomains(lines, analysis);
  }

  // Duplicates
  formatDuplicates(lines, analysis, limits);

  // Enhanced migration plan
  formatMigration(lines, analysis, limits);

  // Reusable modules
  formatReusableModules(lines, analysis);

  // File size analysis
  formatFileSizeAnalysis(lines, analysis);

  // AI navigation hints (conditional based on output level)
  if (limits.includeStaticSections) {
    formatAiNavigation(lines, analysis);
  }

  lines.push('</refactor-analysis>');

  return optimizeXml(lines.join('\n'), { level: 'aggressive' }).output;
}
