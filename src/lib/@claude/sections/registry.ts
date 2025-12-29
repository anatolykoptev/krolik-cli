/**
 * @module lib/@claude/sections/registry
 * @description Singleton registry for documentation sections
 *
 * Manages section providers for CLAUDE.md generation.
 * Uses a singleton pattern to ensure consistent registration across the app.
 */

import type {
  SectionId,
  SectionProvider,
  SectionRegistrationOptions,
  SectionRegistry,
} from './types';

// ============================================================================
// REGISTRY STATE
// ============================================================================

/** Internal storage for registered sections */
const sections = new Map<SectionId, SectionProvider>();

/** Set of disabled section IDs */
const disabledSections = new Set<SectionId>();

// ============================================================================
// REGISTRATION
// ============================================================================

/**
 * Register a section provider
 *
 * @param provider - Section provider to register
 * @param options - Registration options
 * @throws Error if section with same ID already exists (unless replace: true)
 *
 * @example
 * ```typescript
 * registerSection({
 *   id: 'my-section',
 *   name: 'My Section',
 *   priority: SectionPriority.CUSTOM,
 *   render: (ctx) => '## My Content'
 * });
 * ```
 */
export function registerSection(
  provider: SectionProvider,
  options: SectionRegistrationOptions = {},
): void {
  const { replace = false, disabled = false } = options;

  if (sections.has(provider.id) && !replace) {
    throw new Error(
      `Section "${provider.id}" is already registered. Use { replace: true } to override.`,
    );
  }

  sections.set(provider.id, provider);

  if (disabled) {
    disabledSections.add(provider.id);
  } else {
    disabledSections.delete(provider.id);
  }
}

/**
 * Unregister a section by ID
 *
 * @param id - Section ID to unregister
 * @returns true if section was removed, false if not found
 */
export function unregisterSection(id: SectionId): boolean {
  disabledSections.delete(id);
  return sections.delete(id);
}

// ============================================================================
// ENABLE/DISABLE
// ============================================================================

/**
 * Disable a section (keeps it registered but excluded from rendering)
 *
 * @param id - Section ID to disable
 * @returns true if section exists, false otherwise
 */
export function disableSection(id: SectionId): boolean {
  if (!sections.has(id)) {
    return false;
  }
  disabledSections.add(id);
  return true;
}

/**
 * Enable a previously disabled section
 *
 * @param id - Section ID to enable
 * @returns true if section exists, false otherwise
 */
export function enableSection(id: SectionId): boolean {
  if (!sections.has(id)) {
    return false;
  }
  disabledSections.delete(id);
  return true;
}

/**
 * Check if a section is disabled
 *
 * @param id - Section ID to check
 * @returns true if disabled, false otherwise
 */
export function isSectionDisabled(id: SectionId): boolean {
  return disabledSections.has(id);
}

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Check if a section is registered
 *
 * @param id - Section ID to check
 * @returns true if registered, false otherwise
 */
export function hasSection(id: SectionId): boolean {
  return sections.has(id);
}

/**
 * Get a section by ID
 *
 * @param id - Section ID to get
 * @returns Section provider or undefined
 */
export function getSection(id: SectionId): SectionProvider | undefined {
  return sections.get(id);
}

/**
 * Get all registered sections (unordered)
 *
 * @param includeDisabled - Include disabled sections (default: false)
 * @returns Array of all registered section providers
 */
export function getAllSections(includeDisabled = false): SectionProvider[] {
  const allSections = Array.from(sections.values());

  if (includeDisabled) {
    return allSections;
  }

  return allSections.filter((s) => !disabledSections.has(s.id));
}

/**
 * Get all enabled (non-disabled) sections
 * Alias for getAllSections(false)
 *
 * @returns Array of enabled section providers
 */
export function getEnabledSections(): SectionProvider[] {
  return getAllSections(false);
}

/**
 * Get sections ordered by priority (respecting dependencies)
 *
 * Sections are sorted by:
 * 1. Priority (lower = first)
 * 2. Dependencies (dependent sections come after their dependencies)
 * 3. Alphabetical by ID (for stable ordering)
 *
 * @param includeDisabled - Include disabled sections (default: false)
 * @returns Array of sections in render order
 */
export function getOrderedSections(includeDisabled = false): SectionProvider[] {
  const enabledSections = getAllSections(includeDisabled);

  // Build dependency graph
  const dependencyMap = new Map<SectionId, Set<SectionId>>();
  for (const section of enabledSections) {
    const deps = new Set(section.dependencies ?? []);
    dependencyMap.set(section.id, deps);
  }

  // Topological sort with priority as secondary sort key
  const result: SectionProvider[] = [];
  const visited = new Set<SectionId>();
  const visiting = new Set<SectionId>();

  function visit(section: SectionProvider): void {
    if (visited.has(section.id)) return;

    if (visiting.has(section.id)) {
      throw new Error(`Circular dependency detected involving section "${section.id}"`);
    }

    visiting.add(section.id);

    // Visit dependencies first
    const deps = dependencyMap.get(section.id) ?? new Set();
    for (const depId of deps) {
      const depSection = sections.get(depId);
      if (depSection && !disabledSections.has(depId)) {
        visit(depSection);
      }
    }

    visiting.delete(section.id);
    visited.add(section.id);
    result.push(section);
  }

  // Sort by priority first, then alphabetically for stable order
  const sortedSections = [...enabledSections].sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return a.id.localeCompare(b.id);
  });

  // Visit all sections
  for (const section of sortedSections) {
    visit(section);
  }

  return result;
}

/**
 * Get all registered section IDs
 *
 * @returns Array of section IDs
 */
export function getSectionIds(): SectionId[] {
  return Array.from(sections.keys());
}

/**
 * Get count of registered sections
 *
 * @param includeDisabled - Include disabled sections (default: false)
 * @returns Number of registered sections
 */
export function getSectionCount(includeDisabled = false): number {
  if (includeDisabled) {
    return sections.size;
  }
  return sections.size - disabledSections.size;
}

// ============================================================================
// RESET (mainly for testing)
// ============================================================================

/**
 * Clear all registered sections
 * Mainly useful for testing
 */
export function clearSections(): void {
  sections.clear();
  disabledSections.clear();
}

// ============================================================================
// REGISTRY OBJECT (implements SectionRegistry interface)
// ============================================================================

/**
 * Singleton registry object implementing SectionRegistry interface
 *
 * Provides an object-oriented interface for section management.
 * Used by registerBuiltinSections() and other components.
 *
 * @example
 * ```typescript
 * import { registry } from './registry';
 *
 * registry.register(myProvider);
 * const all = registry.all();
 * ```
 */
export const registry: SectionRegistry = {
  register: registerSection,
  get: getSection,
  all: getAllSections,
  has: hasSection,
  unregister: unregisterSection,
  clear: clearSections,
  size: () => sections.size,
};
