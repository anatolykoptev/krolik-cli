/**
 * @module lib/claude/sections/executor
 * @description Section executor with dependency resolution
 *
 * Provides:
 * - DependencyGraph for topological sorting
 * - orderSections for sorting by priority and dependencies
 * - executeSections for rendering sections with dependency resolution
 *
 * @example
 * ```ts
 * import { executeSections, orderSections, DependencyGraph } from './executor';
 *
 * // Order sections by priority and dependencies
 * const ordered = orderSections(providers);
 *
 * // Execute all sections
 * const results = await executeSections(ctx);
 *
 * // Use DependencyGraph directly
 * const graph = new DependencyGraph();
 * graph.addSection('git', ['task']);
 * graph.addSection('task');
 * const order = graph.getOrder(); // ['task', 'git']
 * ```
 */

import { getAllSections, getSection } from './registry';
import type { SectionContext, SectionId, SectionProvider, SectionResult } from './types';

// ============================================================================
// DEPENDENCY GRAPH
// ============================================================================

/**
 * Dependency graph for topological sorting of sections
 *
 * Supports:
 * - Adding sections with optional dependencies
 * - Topological sort to determine execution order
 * - Circular dependency detection
 * - Missing dependency validation
 */
export class DependencyGraph {
  private nodes = new Map<string, Set<string>>();
  private allDependencies = new Set<string>();

  /**
   * Add a section to the graph
   * @param id - Section identifier
   * @param dependencies - Optional array of dependency section IDs
   */
  addSection(id: string, dependencies?: readonly string[]): void {
    if (!this.nodes.has(id)) {
      this.nodes.set(id, new Set());
    }

    if (dependencies) {
      const deps = this.nodes.get(id)!;
      for (const dep of dependencies) {
        deps.add(dep);
        this.allDependencies.add(dep);
      }
    }
  }

  /**
   * Get topologically sorted order of sections
   * @returns Array of section IDs in execution order
   * @throws Error if circular dependency detected
   */
  getOrder(): string[] {
    const sorted: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (id: string): void => {
      // Already processed
      if (visited.has(id)) return;

      // Circular dependency detected
      if (visiting.has(id)) {
        const cycle = Array.from(visiting).concat(id).join(' -> ');
        throw new Error(`Circular dependency detected: ${cycle}`);
      }

      visiting.add(id);

      // Visit dependencies first
      const deps = this.nodes.get(id);
      if (deps) {
        for (const dep of Array.from(deps)) {
          if (this.nodes.has(dep)) {
            visit(dep);
          }
        }
      }

      visiting.delete(id);
      visited.add(id);
      sorted.push(id);
    };

    // Visit all nodes
    for (const id of Array.from(this.nodes.keys())) {
      visit(id);
    }

    return sorted;
  }

  /**
   * Validate that all dependencies exist
   * @param available - Set of available section IDs
   * @returns Array of error messages for missing dependencies
   */
  validateDependencies(available: Set<string>): string[] {
    const errors: string[] = [];

    for (const [sectionId, deps] of Array.from(this.nodes.entries())) {
      for (const dep of Array.from(deps)) {
        if (!available.has(dep)) {
          errors.push(`Section '${sectionId}' depends on non-existent section '${dep}'`);
        }
      }
    }

    return errors;
  }

  /**
   * Check if graph has any nodes
   */
  isEmpty(): boolean {
    return this.nodes.size === 0;
  }

  /**
   * Get all section IDs
   */
  getSectionIds(): string[] {
    return Array.from(this.nodes.keys());
  }

  /**
   * Clear the graph
   */
  clear(): void {
    this.nodes.clear();
    this.allDependencies.clear();
  }
}

// ============================================================================
// SECTION ORDERING
// ============================================================================

/**
 * Order sections by priority and dependency order
 *
 * Sorting rules:
 * 1. First sort by priority (lower = earlier)
 * 2. Then sort by dependency order (dependencies before dependents)
 *
 * @param providers - Array of section providers to order
 * @returns Ordered array of section providers
 * @throws Error if circular or missing dependencies detected
 */
export function orderSections(providers: SectionProvider[]): SectionProvider[] {
  if (providers.length === 0) return [];

  // Build dependency graph
  const graph = new DependencyGraph();
  const providerMap = new Map<string, SectionProvider>();

  for (const provider of providers) {
    graph.addSection(provider.id, provider.dependencies);
    providerMap.set(provider.id, provider);
  }

  // Validate all dependencies exist
  const available = new Set(providers.map((p) => p.id));
  const errors = graph.validateDependencies(available);

  if (errors.length > 0) {
    throw new Error(`Dependency validation failed:\n${errors.join('\n')}`);
  }

  // Get topological order
  const order = graph.getOrder();

  // Create ordered list from topological sort
  const ordered: SectionProvider[] = [];
  for (const id of order) {
    const provider = providerMap.get(id);
    if (provider) {
      ordered.push(provider);
    }
  }

  // Stable sort by priority (preserves topological order for same priority)
  ordered.sort((a, b) => {
    const priorityA = a.priority ?? 100;
    const priorityB = b.priority ?? 100;
    return priorityA - priorityB;
  });

  return ordered;
}

// ============================================================================
// SECTION EXECUTION
// ============================================================================

/**
 * Normalize render result to SectionResult
 * Handles both string returns and SectionResult objects
 */
function normalizeResult(result: SectionResult | string): SectionResult {
  if (typeof result === 'string') {
    return { content: result };
  }
  return result;
}

/**
 * Execute all sections and collect results
 *
 * Process:
 * 1. Get all sections from registry
 * 2. Filter by shouldRender()
 * 3. Order sections by priority and dependencies
 * 4. Execute render() for each section
 * 5. Store metadata in ctx.cache
 * 6. Return results map
 *
 * @param ctx - Section context with data, mode, options, and cache
 * @returns Map of section ID to section result
 */
export async function executeSections(ctx: SectionContext): Promise<Map<SectionId, SectionResult>> {
  const results = new Map<SectionId, SectionResult>();

  // Get all enabled sections from registry
  const allProviders = getAllSections(false);

  if (allProviders.length === 0) {
    return results;
  }

  // Filter by shouldRender
  const activeProviders = allProviders.filter((provider) => {
    // If no shouldRender defined, always render
    if (!provider.shouldRender) return true;
    return provider.shouldRender(ctx);
  });

  if (activeProviders.length === 0) {
    return results;
  }

  // Order sections by priority and dependencies
  const orderedProviders = orderSections(activeProviders);

  // Execute each section
  for (const provider of orderedProviders) {
    try {
      // Execute render (may be sync or async)
      const rawResult = await Promise.resolve(provider.render(ctx));
      const result = normalizeResult(rawResult);

      // Skip sections that return skip: true
      if (result.skip) {
        // Store skipped metadata in cache for debugging
        ctx.cache.set(`section:${provider.id}:skipped`, true);
        continue;
      }

      // Store result
      results.set(provider.id, result);

      // Store metadata in cache
      ctx.cache.set(`section:${provider.id}:rendered`, true);
      if (result.metadata) {
        ctx.cache.set(`section:${provider.id}:metadata`, result.metadata);
      }
    } catch (error) {
      // Store error in cache
      const errorMessage = error instanceof Error ? error.message : String(error);
      ctx.cache.set(`section:${provider.id}:error`, errorMessage);

      // Create error result
      const errorResult: SectionResult = {
        content: `<!-- Section '${provider.id}' failed: ${errorMessage} -->`,
        metadata: { error: errorMessage },
      };
      results.set(provider.id, errorResult);
    }
  }

  return results;
}

/**
 * Execute sections from an array of providers (standalone usage)
 *
 * Use this when you have a custom list of providers instead of using the registry.
 *
 * @param providers - Array of section providers to execute
 * @param ctx - Section context
 * @returns Map of section ID to section result
 */
export async function executeSectionsFromProviders(
  providers: SectionProvider[],
  ctx: SectionContext,
): Promise<Map<SectionId, SectionResult>> {
  const results = new Map<SectionId, SectionResult>();

  if (providers.length === 0) {
    return results;
  }

  // Filter by shouldRender
  const activeProviders = providers.filter((provider) => {
    if (!provider.shouldRender) return true;
    return provider.shouldRender(ctx);
  });

  if (activeProviders.length === 0) {
    return results;
  }

  // Order sections by priority and dependencies
  const orderedProviders = orderSections(activeProviders);

  // Execute each section
  for (const provider of orderedProviders) {
    try {
      const rawResult = await Promise.resolve(provider.render(ctx));
      const result = normalizeResult(rawResult);

      if (result.skip) {
        ctx.cache.set(`section:${provider.id}:skipped`, true);
        continue;
      }

      results.set(provider.id, result);
      ctx.cache.set(`section:${provider.id}:rendered`, true);

      if (result.metadata) {
        ctx.cache.set(`section:${provider.id}:metadata`, result.metadata);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      ctx.cache.set(`section:${provider.id}:error`, errorMessage);

      const errorResult: SectionResult = {
        content: `<!-- Section '${provider.id}' failed: ${errorMessage} -->`,
        metadata: { error: errorMessage },
      };
      results.set(provider.id, errorResult);
    }
  }

  return results;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Execute a single section by ID
 * @param id - Section ID to execute
 * @param ctx - Section context
 * @returns Section result or null if not found/skipped
 */
export async function executeSection(
  id: SectionId,
  ctx: SectionContext,
): Promise<SectionResult | null> {
  const provider = getSection(id);

  if (!provider) {
    return null;
  }

  // Check shouldRender
  if (provider.shouldRender && !provider.shouldRender(ctx)) {
    return null;
  }

  try {
    const rawResult = await Promise.resolve(provider.render(ctx));
    const result = normalizeResult(rawResult);

    if (result.skip) {
      return null;
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: `<!-- Section '${id}' failed: ${errorMessage} -->`,
      metadata: { error: errorMessage },
    };
  }
}

/**
 * Get section IDs that will be rendered for a given context
 * @param ctx - Section context
 * @returns Array of section IDs that will be rendered
 */
export function getActiveSectionIds(ctx: SectionContext): SectionId[] {
  const allProviders = getAllSections(false);

  const activeProviders = allProviders.filter((provider) => {
    if (!provider.shouldRender) return true;
    return provider.shouldRender(ctx);
  });

  const orderedProviders = orderSections(activeProviders);

  return orderedProviders.map((p) => p.id);
}

/**
 * Validate section dependencies without executing
 * @param providers - Optional array of providers to validate (uses registry if not provided)
 * @returns Array of error messages (empty if valid)
 */
export function validateSectionDependencies(providers?: SectionProvider[]): string[] {
  const allProviders = providers ?? getAllSections(false);
  const graph = new DependencyGraph();

  for (const provider of allProviders) {
    graph.addSection(provider.id, provider.dependencies);
  }

  const available = new Set(allProviders.map((p) => p.id));
  const errors = graph.validateDependencies(available);

  // Also check for circular dependencies
  try {
    graph.getOrder();
  } catch (error) {
    if (error instanceof Error) {
      errors.push(error.message);
    }
  }

  return errors;
}

/**
 * Create a new section context with cache
 * @param base - Base context properties
 * @returns Complete section context with cache
 */
export function createSectionContext(base: Omit<SectionContext, 'cache'>): SectionContext {
  return {
    ...base,
    cache: new Map<string, unknown>(),
  };
}
