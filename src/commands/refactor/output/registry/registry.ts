/**
 * @module commands/refactor/output/registry/registry
 * @description SectionRegistry for managing output sections
 *
 * Provides a centralized registry for sections with:
 * - Registration and lookup of sections
 * - Dependency checking against analyzer results
 * - Ordered rendering with conditional skipping
 */

import { Registry } from '@/lib/@core';
import type { Section, SectionContext } from './types';

// ============================================================================
// REQUIREMENT CHECK RESULT
// ============================================================================

/**
 * Result of checking section requirements.
 */
export interface RequirementCheckResult {
  /** Whether all requirements are met */
  met: boolean;

  /** List of missing or failed analyzer IDs (if any) */
  missing?: string[];
}

// ============================================================================
// SECTION REGISTRY
// ============================================================================

/**
 * Registry for managing and rendering output sections.
 *
 * Extends the generic Registry with section-specific functionality:
 * - Dependency checking against analyzer results
 * - Ordered rendering with conditional skipping
 * - XML comments for skipped sections explaining why
 *
 * @example
 * ```typescript
 * // Register sections
 * sectionRegistry.register(statsSection);
 * sectionRegistry.registerAll([duplicatesSection, migrationSection]);
 *
 * // Render all sections
 * const lines = sectionRegistry.formatAll(context);
 * ```
 */
export class SectionRegistry extends Registry<Section> {
  constructor() {
    super({ onDuplicate: 'overwrite' });
  }

  /**
   * Extract ID from section metadata
   */
  protected getId(section: Section): string {
    return section.metadata.id;
  }

  /**
   * Get all registered section IDs (alias for names())
   */
  ids(): string[] {
    return this.names();
  }

  /**
   * Check if a section's analyzer requirements are met.
   *
   * @param section - The section to check
   * @param ctx - The section context with analyzer results
   * @returns Result indicating if requirements are met and which are missing
   */
  checkRequirements(section: Section, ctx: SectionContext): RequirementCheckResult {
    const requires = section.metadata.requires;

    // No requirements means requirements are met
    if (!requires || requires.length === 0) {
      return { met: true };
    }

    const missing: string[] = [];

    for (const analyzerId of requires) {
      const result = ctx.results.get(analyzerId);

      // Requirement is not met if:
      // - Analyzer was not run (result is undefined)
      // - Analyzer failed or was skipped (status !== 'success')
      if (!result || result.status !== 'success') {
        missing.push(analyzerId);
      }
    }

    if (missing.length > 0) {
      return { met: false, missing };
    }

    return { met: true };
  }

  /**
   * Format all registered sections into output lines.
   *
   * Sections are:
   * 1. Sorted by metadata.order
   * 2. Checked for analyzer requirements
   * 3. Checked for shouldRender()
   * 4. Rendered or skipped with explanatory XML comment
   *
   * @param ctx - The section context
   * @returns Array of output lines
   */
  formatAll(ctx: SectionContext): string[] {
    const lines: string[] = [];

    // Sort sections by order
    const sortedSections = this.all().sort((a, b) => a.metadata.order - b.metadata.order);

    for (const section of sortedSections) {
      const { id, name } = section.metadata;

      // Check analyzer requirements first
      const requirements = this.checkRequirements(section, ctx);
      if (!requirements.met) {
        lines.push(
          `  <!-- Section "${name}" (${id}) skipped: required analyzers not available [${requirements.missing?.join(', ')}] -->`,
        );
        lines.push('');
        continue;
      }

      // Check if section wants to render
      if (!section.shouldRender(ctx)) {
        lines.push(`  <!-- Section "${name}" (${id}) skipped: shouldRender returned false -->`);
        lines.push('');
        continue;
      }

      // Render the section
      section.render(lines, ctx);
    }

    return lines;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/**
 * Default singleton instance of SectionRegistry.
 *
 * Use this for most cases. Create separate instances
 * only for testing or isolated use cases.
 */
export const sectionRegistry = new SectionRegistry();
