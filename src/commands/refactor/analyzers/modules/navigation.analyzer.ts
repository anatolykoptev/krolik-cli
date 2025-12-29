/**
 * @module commands/refactor/analyzers/modules/navigation.analyzer
 * @description AI Navigation analyzer for registry-based architecture
 *
 * Generates navigation hints for AI assistants about where to add new code.
 * Depends on: project-context analyzer.
 */

import type { AiNavigation, ProjectContext } from '../../core';
import { generateAiNavigation } from '../context/navigation';
import type { Analyzer, AnalyzerContext, AnalyzerResult } from '../registry';

// ============================================================================
// ANALYZER
// ============================================================================

/**
 * AI Navigation analyzer
 *
 * Generates hints for AI assistants:
 * - Where to add new code
 * - File patterns
 * - Import conventions
 * - Naming conventions
 */
export const navigationAnalyzer: Analyzer<AiNavigation> = {
  metadata: {
    id: 'navigation',
    name: 'AI Navigation',
    description: 'Generates navigation hints for AI assistants',
    defaultEnabled: true,
    dependsOn: ['project-context'],
  },

  shouldRun(ctx: AnalyzerContext): boolean {
    return ctx.options.includeNavigation !== false;
  },

  async analyze(ctx: AnalyzerContext): Promise<AnalyzerResult<AiNavigation>> {
    // Get project context from options (set by runner after first pass)
    const projectContext = ctx.options.projectContext as ProjectContext | undefined;

    if (!projectContext) {
      return {
        status: 'skipped',
        error: 'No project context available',
      };
    }

    // Generate navigation hints
    const navigation = generateAiNavigation(projectContext, ctx.targetPath);

    return {
      status: 'success',
      data: navigation,
    };
  },
};
