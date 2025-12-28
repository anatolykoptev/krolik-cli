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
 */

import type { EnhancedRefactorAnalysis } from '../core';
import {
  formatAiConfig,
  formatAiNavigation,
  formatArchitectureHealth,
  formatDomains,
  formatDuplicates,
  formatFileSizeAnalysis,
  formatMigration,
  formatProjectContext,
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
}

/**
 * Format enhanced analysis as AI-native XML
 */
export function formatAiNativeXml(
  analysis: EnhancedRefactorAnalysis,
  options: AiNativeXmlOptions = {},
): string {
  const lines: string[] = [];
  const mode = options.mode ?? 'default';

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<!--');
  lines.push('  AI-NATIVE REFACTOR ANALYSIS');
  lines.push('  This output is optimized for AI agents like Claude Code.');
  lines.push(
    '  Structure: stats -> context -> ai-config -> architecture -> domains -> duplicates -> migration -> recommendations -> navigation',
  );
  lines.push('-->');
  lines.push('');

  lines.push(
    `<refactor-analysis mode="${mode}" timestamp="${analysis.timestamp}" path="${analysis.path}">`,
  );

  // Stats summary (with optional execution time)
  formatStats(lines, analysis, options.executionTimeMs);

  // Project context
  formatProjectContext(lines, analysis);

  // AI config (namespace definitions and patterns)
  formatAiConfig(lines, analysis);

  // Architecture health
  formatArchitectureHealth(lines, analysis);

  // Domain classification
  formatDomains(lines, analysis);

  // Duplicates
  formatDuplicates(lines, analysis);

  // Enhanced migration plan
  formatMigration(lines, analysis);

  // Recommendations
  formatRecommendations(lines, analysis);

  // Reusable modules
  formatReusableModules(lines, analysis);

  // File size analysis
  formatFileSizeAnalysis(lines, analysis);

  // AI navigation hints
  formatAiNavigation(lines, analysis);

  lines.push('</refactor-analysis>');

  return lines.join('\n');
}
