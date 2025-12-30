/**
 * @module commands/fix/core/registry
 * @description Fixer Registry - central registration point for all fixers
 *
 * Provides:
 * - Auto-discovery of fixers
 * - CLI flag generation from metadata
 * - Filtering by category, difficulty, tags
 *
 * @example
 * ```ts
 * import { registry } from './core/registry';
 *
 * // Register a fixer
 * registry.register(consoleFixer);
 *
 * // Get all fixers
 * const all = registry.all();
 *
 * // Get fixers by category
 * const lintFixers = registry.byCategory('lint');
 *
 * // Get enabled fixers based on CLI options
 * const enabled = registry.getEnabled(options);
 * ```
 */

import { Registry } from '@/lib/@core';
import type { FixDifficulty, Fixer, FixerMetadata, QualityCategory } from './types';

/**
 * CLI option generated from fixer metadata
 */
export interface CLIOption {
  flag: string;
  negateFlag?: string | undefined;
  description: string;
  fixerId: string;
}

/**
 * Filter options for registry queries
 */
export interface FixerFilter {
  category?: QualityCategory;
  difficulty?: FixDifficulty;
  tags?: string[];
  ids?: string[];
}

/**
 * Fixer Registry class
 *
 * Extends the generic Registry with fixer-specific functionality:
 * - Filtering by category, difficulty, tags
 * - CLI flag generation
 * - Enabled fixer resolution based on CLI options
 */
export class FixerRegistry extends Registry<Fixer> {
  constructor() {
    super({ onDuplicate: 'warn' });
  }

  /**
   * Extract ID from fixer metadata
   */
  protected getId(fixer: Fixer): string {
    return fixer.metadata.id;
  }

  /**
   * Get all fixer IDs (alias for names())
   */
  ids(): string[] {
    return this.names();
  }

  /**
   * Get fixers by category
   */
  byCategory(category: QualityCategory): Fixer[] {
    return this.all().filter((f) => f.metadata.category === category);
  }

  /**
   * Get fixers by difficulty
   */
  byDifficulty(difficulty: FixDifficulty): Fixer[] {
    return this.all().filter((f) => f.metadata.difficulty === difficulty);
  }

  /**
   * Get fixers by tag
   */
  byTag(tag: string): Fixer[] {
    return this.all().filter((f) => f.metadata.tags?.includes(tag));
  }

  /**
   * Get trivial fixers (safe to auto-apply)
   */
  trivial(): Fixer[] {
    return this.byDifficulty('trivial');
  }

  /**
   * Filter fixers by multiple criteria
   */
  filter(filter: FixerFilter): Fixer[] {
    let result = this.all();

    if (filter.ids?.length) {
      result = result.filter((f) => filter.ids?.includes(f.metadata.id));
    }

    if (filter.category) {
      result = result.filter((f) => f.metadata.category === filter.category);
    }

    if (filter.difficulty) {
      result = result.filter((f) => f.metadata.difficulty === filter.difficulty);
    }

    if (filter.tags?.length) {
      result = result.filter((f) => filter.tags?.some((tag) => f.metadata.tags?.includes(tag)));
    }

    return result;
  }

  /**
   * Get enabled fixers based on CLI options
   *
   * Logic:
   * - If no fixer flags are set, all fixers are enabled
   * - If any --fix-X flag is set, only those fixers are enabled
   * - Individual --no-X flags disable specific fixers
   */
  getEnabled(options: Record<string, unknown>): Fixer[] {
    const allFixers = this.all();

    // Build map of fixer id -> enabled status
    const enabledMap = new Map<string, boolean>();

    // Check if any explicit flags are set
    let hasExplicitFlags = false;

    for (const fixer of allFixers) {
      const flagKey = this.flagToOptionKey(fixer.metadata.cliFlag);
      const negateKey = fixer.metadata.negateFlag
        ? this.flagToOptionKey(fixer.metadata.negateFlag)
        : undefined;

      // Check for explicit enable
      if (options[flagKey] === true) {
        hasExplicitFlags = true;
        enabledMap.set(fixer.metadata.id, true);
      }

      // Check for explicit disable
      if (negateKey && options[negateKey] === true) {
        enabledMap.set(fixer.metadata.id, false);
      }
    }

    // Apply logic
    return allFixers.filter((fixer) => {
      const explicit = enabledMap.get(fixer.metadata.id);

      // If explicitly disabled, skip
      if (explicit === false) return false;

      // If explicitly enabled, include
      if (explicit === true) return true;

      // If no explicit flags, include all
      // If some explicit flags, exclude non-explicit
      return !hasExplicitFlags;
    });
  }

  /**
   * Generate CLI options from fixer metadata
   */
  getCLIOptions(): CLIOption[] {
    return this.all().map((fixer) => ({
      flag: fixer.metadata.cliFlag,
      negateFlag: fixer.metadata.negateFlag,
      description: fixer.metadata.description,
      fixerId: fixer.metadata.id,
    }));
  }

  /**
   * Get metadata for all fixers (for help text generation)
   */
  getMetadata(): FixerMetadata[] {
    return this.all().map((f) => f.metadata);
  }

  /**
   * Convert CLI flag to option key
   * e.g., "--fix-console" -> "fixConsole"
   */
  private flagToOptionKey(flag: string): string {
    // Remove leading dashes
    let key = flag.replace(/^-+/, '');

    // Handle negation prefix
    if (key.startsWith('no-')) {
      key = key.replace('no-', '');
      // Convert to camelCase with 'no' prefix would need different handling
      // For now, just convert fix-X to fixX
    }

    // Convert kebab-case to camelCase
    return key.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
  }
}

/**
 * Global fixer registry instance
 */
export const registry = new FixerRegistry();

/**
 * Helper to create fixer metadata
 */
export function createFixerMetadata(
  id: string,
  name: string,
  category: QualityCategory,
  options: Partial<Omit<FixerMetadata, 'id' | 'name' | 'category'>> = {},
): FixerMetadata {
  return {
    id,
    name,
    category,
    description: options.description ?? `Fix ${name.toLowerCase()} issues`,
    difficulty: options.difficulty ?? 'safe',
    cliFlag: options.cliFlag ?? `--fix-${id}`,
    negateFlag: options.negateFlag,
    tags: options.tags,
  };
}
