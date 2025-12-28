/**
 * @module lib/claude/sections/context
 * @description Factory for creating SectionContext instances
 *
 * Creates the context object passed to section providers during rendering.
 * Handles defaults and validation.
 */

import type { SubDocInfo } from '@/lib/discovery';
import type { MCPToolDefinition } from '@/mcp/tools';
import type { SectionContext } from './types';

// ============================================================================
// CONTEXT OPTIONS
// ============================================================================

/**
 * Options for creating a section context
 */
export interface CreateSectionContextOptions {
  /** Absolute path to project root */
  projectRoot: string;

  /** MCP tool definitions (defaults to empty array) */
  tools?: readonly MCPToolDefinition[] | MCPToolDefinition[];

  /** Discovered sub-documentation files (defaults to empty array) */
  subDocs?: readonly SubDocInfo[] | SubDocInfo[];

  /** Template version string */
  version: string;

  /**
   * Pre-populated cache values
   * Useful for passing computed data to sections
   */
  initialCache?: Record<string, unknown>;
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a new SectionContext instance
 *
 * @param options - Context options
 * @returns Immutable SectionContext
 *
 * @example
 * ```typescript
 * import { getAllTools } from '@/mcp/tools';
 * import { findSubDocs } from '@/lib/discovery';
 * import { TEMPLATE_VERSION } from '@/version';
 *
 * const context = createSectionContext({
 *   projectRoot: '/path/to/project',
 *   tools: getAllTools(),
 *   subDocs: findSubDocs('/path/to/project'),
 *   version: TEMPLATE_VERSION,
 * });
 * ```
 */
export function createSectionContext(options: CreateSectionContextOptions): SectionContext {
  const { projectRoot, tools = [], subDocs = [], version, initialCache = {} } = options;

  // Validate required fields
  if (!projectRoot) {
    throw new Error('projectRoot is required for SectionContext');
  }

  if (!version) {
    throw new Error('version is required for SectionContext');
  }

  // Create cache with initial values
  const cache = new Map<string, unknown>(Object.entries(initialCache));

  // Return frozen context (immutable)
  const context: SectionContext = {
    projectRoot,
    tools: Object.freeze([...tools]) as readonly MCPToolDefinition[],
    subDocs: Object.freeze([...subDocs]) as readonly SubDocInfo[],
    version,
    cache, // cache is mutable by design (for inter-section communication)
  };

  return context;
}

// ============================================================================
// CONTEXT HELPERS
// ============================================================================

/**
 * Create a minimal context for testing
 *
 * @param overrides - Values to override in the default context
 * @returns Test SectionContext
 *
 * @example
 * ```typescript
 * const testCtx = createTestContext({
 *   tools: [mockTool],
 * });
 * ```
 */
export function createTestContext(
  overrides: Partial<CreateSectionContextOptions> = {},
): SectionContext {
  return createSectionContext({
    projectRoot: '/test/project',
    version: '0.0.0-test',
    tools: [],
    subDocs: [],
    ...overrides,
  });
}

/**
 * Clone a context with modifications
 *
 * Creates a new context with the same values, optionally overriding some.
 * The cache is shared between original and clone (by design).
 *
 * @param ctx - Original context
 * @param overrides - Values to override
 * @returns New SectionContext
 */
export function cloneContext(
  ctx: SectionContext,
  overrides: Partial<Omit<CreateSectionContextOptions, 'initialCache'>> = {},
): SectionContext {
  return {
    projectRoot: overrides.projectRoot ?? ctx.projectRoot,
    tools: overrides.tools
      ? (Object.freeze([...overrides.tools]) as readonly MCPToolDefinition[])
      : ctx.tools,
    subDocs: overrides.subDocs
      ? (Object.freeze([...overrides.subDocs]) as readonly SubDocInfo[])
      : ctx.subDocs,
    version: overrides.version ?? ctx.version,
    cache: ctx.cache, // shared cache
  };
}

/**
 * Get a typed value from the context cache
 *
 * @param ctx - Section context
 * @param key - Cache key
 * @param defaultValue - Default if key not found
 * @returns Cached value or default
 *
 * @example
 * ```typescript
 * const toolCount = getCacheValue<number>(ctx, 'tool-count', 0);
 * ```
 */
export function getCacheValue<T>(ctx: SectionContext, key: string, defaultValue: T): T {
  const value = ctx.cache.get(key);
  return value !== undefined ? (value as T) : defaultValue;
}

/**
 * Set a typed value in the context cache
 *
 * @param ctx - Section context
 * @param key - Cache key
 * @param value - Value to cache
 */
export function setCacheValue<T>(ctx: SectionContext, key: string, value: T): void {
  ctx.cache.set(key, value);
}
