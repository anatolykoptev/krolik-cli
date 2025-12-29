/**
 * @module commands/refactor/output/registry/types
 * @description Type definitions for the SectionRegistry system
 *
 * Provides a unified interface for registering and rendering output sections
 * with dependency management, metadata, and conditional rendering.
 */

import type { AnalyzerResult } from '../../analyzers/registry/types';
import type { SectionLimits } from '../limits';

// ============================================================================
// OUTPUT LEVEL
// ============================================================================

/**
 * Output verbosity level for section rendering.
 *
 * Controls how much detail is included in the output:
 * - 'summary': Minimal output with only critical insights (~10K tokens)
 * - 'standard': Balanced output for most use cases (~25K tokens)
 * - 'full': Complete output with all available data (unlimited)
 */
export type OutputLevel = 'summary' | 'standard' | 'full';

// ============================================================================
// SECTION CONTEXT
// ============================================================================

/**
 * Context provided to sections during rendering.
 *
 * Contains all necessary information for a section to render
 * its output, including analyzer results, limits, and configuration.
 */
export interface SectionContext {
  /** Map of analyzer ID to its result */
  results: Map<string, AnalyzerResult<unknown>>;

  /** Section limits based on output level */
  limits: SectionLimits;

  /** Current output verbosity level */
  outputLevel: OutputLevel;

  /** Additional section-specific configuration options */
  options?: Record<string, unknown>;
}

// ============================================================================
// SECTION VISIBILITY
// ============================================================================

/**
 * Conditions for when a section should be rendered.
 *
 * - 'always': Section is always rendered regardless of data availability
 * - 'has-data': Section renders only when its required analyzers have data
 * - 'has-issues': Section renders only when issues/problems are detected
 * - 'on-success': Section renders only when all required analyzers succeeded
 */
export type ShowWhen = 'always' | 'has-data' | 'has-issues' | 'on-success';

// ============================================================================
// SECTION METADATA
// ============================================================================

/**
 * Metadata describing a section.
 *
 * Used by the registry to manage section lifecycle,
 * resolve dependencies, and control rendering order.
 */
export interface SectionMetadata {
  /** Unique identifier for the section (e.g., 'stats', 'duplicates') */
  id: string;

  /** Human-readable name (e.g., 'Stats Summary') */
  name: string;

  /** Brief description of what the section renders */
  description?: string;

  /**
   * Rendering order (lower = earlier).
   * Sections are sorted by this value before rendering.
   *
   * Suggested ranges:
   * - 0-99: Header/summary sections
   * - 100-199: Core analysis sections
   * - 200-299: Detailed sections
   * - 300+: Footer/auxiliary sections
   */
  order: number;

  /**
   * IDs of analyzers this section requires.
   * Section is skipped if any required analyzer failed or was skipped.
   */
  requires?: string[];

  /**
   * Condition for when to show this section.
   * Defaults to 'has-data' if not specified.
   */
  showWhen?: ShowWhen;
}

// ============================================================================
// SECTION INTERFACE
// ============================================================================

/**
 * Interface for sections that can be registered with the SectionRegistry.
 *
 * Sections are responsible for rendering specific parts of the output.
 * They can declare dependencies on analyzers and control their rendering
 * based on the available data.
 *
 * @example
 * ```typescript
 * const statsSection: Section = {
 *   metadata: {
 *     id: 'stats',
 *     name: 'Stats Summary',
 *     description: 'Renders summary statistics',
 *     order: 10,
 *     showWhen: 'always',
 *   },
 *   shouldRender: (ctx) => true,
 *   render: (lines, ctx) => {
 *     lines.push('<stats ... />');
 *   },
 * };
 * ```
 */
export interface Section {
  /** Section metadata for registration and configuration */
  metadata: SectionMetadata;

  /**
   * Determines whether this section should render given the current context.
   *
   * Called after analyzer requirements are checked.
   * Use this for conditional rendering based on data availability.
   *
   * @param ctx - The section context
   * @returns true if the section should render, false to skip
   */
  shouldRender(ctx: SectionContext): boolean;

  /**
   * Renders the section content by appending lines to the output array.
   *
   * @param lines - The output lines array to append to
   * @param ctx - The section context
   */
  render(lines: string[], ctx: SectionContext): void;
}
