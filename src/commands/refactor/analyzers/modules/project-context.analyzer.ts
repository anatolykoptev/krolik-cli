/**
 * @module commands/refactor/analyzers/modules/project-context.analyzer
 * @description Project Context Analyzer for the registry-based architecture
 *
 * Detects project type, tech stack, entry points, and import conventions.
 * This is a foundational analyzer that other analyzers depend on for context.
 *
 * Detects:
 * - Project type (cli, web-app, api, library, monorepo, mobile)
 * - Tech stack (framework, runtime, language, UI, state management, database, testing)
 * - Entry points (main, API routes, pages, components, configs, tests)
 * - Import conventions (aliases, barrel exports)
 *
 * @example
 * ```typescript
 * import { projectContextAnalyzer } from './modules/project-context.analyzer';
 * import { analyzerRegistry } from '../registry';
 *
 * // Register the analyzer
 * analyzerRegistry.register(projectContextAnalyzer);
 *
 * // Run with context
 * const results = await analyzerRegistry.runAll(ctx);
 * const contextResult = results.get('project-context');
 * ```
 */

import type { ProjectContext } from '../../core/types-ai';
import { detectProjectContext } from '../context/context';
import type { Analyzer } from '../registry';

// ============================================================================
// PROJECT CONTEXT ANALYZER
// ============================================================================

/**
 * Analyzer for detecting project context and tech stack.
 *
 * This analyzer provides foundational information that other analyzers
 * can use to make context-aware decisions. It runs independently
 * without any dependencies.
 *
 * Features:
 * - Runs independently (no dependencies)
 * - Always enabled by default
 * - Returns success even if detection is partial
 * - Never fails - always provides at least basic context
 */
export const projectContextAnalyzer: Analyzer<ProjectContext> = {
  metadata: {
    id: 'project-context',
    name: 'Project Context Detection',
    description: 'Detects project type, tech stack, entry points, and import conventions',
    defaultEnabled: true,
    // No dependencies - foundational analyzer
  },

  /**
   * Determines if the analyzer should run.
   *
   * Project context is always needed for other analyzers,
   * so this analyzer always runs unless explicitly disabled.
   *
   * @param ctx - The analyzer context
   * @returns true (always runs unless disabled)
   */
  shouldRun(ctx) {
    return ctx.options.includeProjectContext !== false;
  },

  /**
   * Performs project context detection.
   *
   * Analyzes package.json, tsconfig.json, and directory structure
   * to determine project characteristics.
   *
   * @param ctx - The analyzer context
   * @returns Promise resolving to the analysis result
   */
  async analyze(ctx) {
    const projectContext = detectProjectContext(ctx.projectRoot);

    // ALWAYS return success - project context detection never fails
    // Even if we can't detect everything, we return what we found
    return {
      status: 'success',
      data: projectContext,
    };
  },
};
