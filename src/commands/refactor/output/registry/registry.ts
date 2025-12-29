/**
 * @module commands/refactor/output/registry/registry
 * @description SectionRegistry for managing output sections
 *
 * Provides a centralized registry for sections with:
 * - Registration and lookup of sections
 * - Dependency checking against analyzer results
 * - Ordered rendering with conditional skipping
 */

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
 * Provides centralized section management with:
 * - Section registration and lookup
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
export class SectionRegistry {
  /** Registered sections by ID */
  private sections = new Map<string, Section>();

  /**
   * Register a section with the registry.
   *
   * @param section - The section to register
   */
  register(section: Section): void {
    this.sections.set(section.metadata.id, section);
  }

  /**
   * Register multiple sections at once.
   *
   * @param sections - Array of sections to register
   */
  registerAll(sections: Section[]): void {
    for (const section of sections) {
      this.register(section);
    }
  }

  /**
   * Get a section by ID.
   *
   * @param id - Section ID to look up
   * @returns The section if found, undefined otherwise
   */
  get(id: string): Section | undefined {
    return this.sections.get(id);
  }

  /**
   * Check if a section with the given ID exists.
   *
   * @param id - Section ID to check
   * @returns true if the section exists
   */
  has(id: string): boolean {
    return this.sections.has(id);
  }

  /**
   * Get all registered sections.
   *
   * @returns Array of all registered sections
   */
  all(): Section[] {
    return Array.from(this.sections.values());
  }

  /**
   * Get all registered section IDs.
   *
   * @returns Array of all section IDs
   */
  ids(): string[] {
    return Array.from(this.sections.keys());
  }

  /**
   * Clear all registered sections.
   *
   * Primarily used for testing.
   */
  clear(): void {
    this.sections.clear();
  }

  /**
   * Get the number of registered sections.
   */
  get size(): number {
    return this.sections.size;
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
