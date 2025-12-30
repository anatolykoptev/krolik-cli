/**
 * @module lib/@core/registry/registry
 * @description Generic Registry class for managing named items
 *
 * Provides a base implementation for registry patterns with:
 * - Type-safe item registration and lookup
 * - Bulk registration
 * - Iteration and listing
 * - Clear and size operations
 *
 * @example
 * ```typescript
 * import { Registry } from '@/lib/@core';
 *
 * interface Plugin {
 *   id: string;
 *   name: string;
 *   execute(): void;
 * }
 *
 * class PluginRegistry extends Registry<Plugin> {
 *   protected getId(item: Plugin): string {
 *     return item.id;
 *   }
 * }
 *
 * const registry = new PluginRegistry();
 * registry.register(myPlugin);
 * const plugin = registry.get('my-plugin');
 * ```
 */

/**
 * Options for registry registration behavior
 */
export interface RegistryOptions {
  /**
   * Behavior when registering an item with duplicate ID
   * - 'warn': Log warning and overwrite (default)
   * - 'throw': Throw an error
   * - 'skip': Silently skip registration
   * - 'overwrite': Silently overwrite
   */
  onDuplicate?: 'warn' | 'throw' | 'skip' | 'overwrite';
}

/**
 * Generic Registry class for managing named items.
 *
 * Provides common registry operations:
 * - register/registerAll - add items
 * - get/has - lookup items
 * - all/names - iterate items
 * - clear/size - manage registry
 *
 * Subclasses must implement `getId(item)` to extract the unique identifier.
 *
 * @typeParam T - The type of items stored in the registry
 */
export abstract class Registry<T> {
  /** Internal storage for registered items */
  protected readonly items = new Map<string, T>();

  /** Registry configuration options */
  protected readonly options: Required<RegistryOptions>;

  /**
   * Creates a new Registry instance.
   *
   * @param options - Registry configuration options
   */
  constructor(options: RegistryOptions = {}) {
    this.options = {
      onDuplicate: options.onDuplicate ?? 'warn',
    };
  }

  /**
   * Extract the unique identifier from an item.
   * Must be implemented by subclasses.
   *
   * @param item - The item to get ID from
   * @returns The unique identifier string
   */
  protected abstract getId(item: T): string;

  /**
   * Register an item with the registry.
   *
   * @param item - The item to register
   */
  register(item: T): void {
    const id = this.getId(item);

    if (this.items.has(id)) {
      switch (this.options.onDuplicate) {
        case 'throw':
          throw new Error(`Item with id "${id}" is already registered`);
        case 'skip':
          return;
        case 'warn':
          console.warn(`Item '${id}' is already registered, overwriting`);
          break;
        case 'overwrite':
          // Silently overwrite
          break;
      }
    }

    this.items.set(id, item);
  }

  /**
   * Register multiple items at once.
   *
   * @param items - Array of items to register
   */
  registerAll(items: T[]): void {
    for (const item of items) {
      this.register(item);
    }
  }

  /**
   * Get an item by its ID.
   *
   * @param id - The item ID to look up
   * @returns The item if found, undefined otherwise
   */
  get(id: string): T | undefined {
    return this.items.get(id);
  }

  /**
   * Check if an item with the given ID exists.
   *
   * @param id - The item ID to check
   * @returns true if the item exists
   */
  has(id: string): boolean {
    return this.items.has(id);
  }

  /**
   * Get all registered items.
   *
   * @returns Array of all registered items
   */
  all(): T[] {
    return Array.from(this.items.values());
  }

  /**
   * Get all registered item IDs/names.
   *
   * @returns Array of all item IDs
   */
  names(): string[] {
    return Array.from(this.items.keys());
  }

  /**
   * Clear all registered items.
   * Useful for testing.
   */
  clear(): void {
    this.items.clear();
  }

  /**
   * Get the number of registered items.
   */
  get size(): number {
    return this.items.size;
  }

  /**
   * Iterate over all registered items.
   * Implements the Iterable protocol.
   */
  *[Symbol.iterator](): Iterator<T> {
    yield* this.items.values();
  }

  /**
   * Iterate over all entries as [id, item] pairs.
   */
  *entries(): Generator<[string, T]> {
    yield* this.items.entries();
  }
}
