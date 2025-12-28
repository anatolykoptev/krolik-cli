/**
 * @module lib/claude/sections/types
 * @description Core interfaces for the Section Registry system
 *
 * Provides type definitions for section providers that generate
 * dynamic content for CLAUDE.md documentation.
 */

import type { SubDocInfo } from '@/lib/discovery';
import type { MCPToolDefinition } from '@/mcp/tools';

// ============================================================================
// SECTION IDENTIFICATION
// ============================================================================

/**
 * Unique identifier for a section
 * Convention: lowercase-with-dashes (e.g., 'session-startup', 'tools-table')
 */
export type SectionId = string;

// ============================================================================
// PRIORITY CONSTANTS
// ============================================================================

/**
 * Standard priority levels for section ordering
 *
 * Lower values = rendered earlier in the document
 * Use these constants for consistent ordering across all sections.
 *
 * @example
 * ```typescript
 * const mySection: SectionProvider = {
 *   id: 'my-custom-section',
 *   name: 'My Custom Section',
 *   priority: SectionPriority.CUSTOM,
 *   render: (ctx) => '## My Section Content'
 * };
 * ```
 */
export const SectionPriority = {
  /** Session startup instructions (first) */
  SESSION_STARTUP: 100,
  /** Context cache information */
  CONTEXT_CACHE: 200,
  /** Sub-documentation links */
  SUB_DOCS: 300,
  /** Lib modules documentation */
  LIB_MODULES: 350,
  /** Tools reference table */
  TOOLS: 400,
  /** Alias for TOOLS for backwards compatibility */
  TOOLS_TABLE: 400,
  /** Custom user-defined sections */
  CUSTOM: 500,
  /** Footer content (last) */
  FOOTER: 900,
} as const;

/** Type for priority values */
export type SectionPriorityValue = (typeof SectionPriority)[keyof typeof SectionPriority];

// ============================================================================
// SECTION CONTEXT
// ============================================================================

/**
 * Context passed to section providers during rendering
 *
 * Contains all information needed to generate dynamic content.
 * The cache Map can be used to share data between sections.
 */
export interface SectionContext {
  /** Absolute path to project root */
  readonly projectRoot: string;

  /** All registered MCP tool definitions */
  readonly tools: readonly MCPToolDefinition[];

  /** Discovered sub-documentation files */
  readonly subDocs: readonly SubDocInfo[];

  /** Current template version (from version.ts) */
  readonly version: string;

  /**
   * Shared cache for inter-section data sharing
   *
   * @example
   * ```typescript
   * // In first section
   * ctx.cache.set('computed-data', { foo: 'bar' });
   *
   * // In later section
   * const data = ctx.cache.get('computed-data');
   * ```
   */
  readonly cache: Map<string, unknown>;
}

// ============================================================================
// SECTION RESULT
// ============================================================================

/**
 * Result returned by a section's render function
 */
export interface SectionResult {
  /** Markdown content to include in the document */
  content: string;

  /**
   * Skip this section entirely
   * Use when the section has no content to render
   */
  skip?: boolean;

  /**
   * Optional metadata for debugging or post-processing
   *
   * @example
   * ```typescript
   * {
   *   content: '## Tools Table\n...',
   *   metadata: {
   *     toolCount: 12,
   *     renderTimeMs: 5
   *   }
   * }
   * ```
   */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// SECTION PROVIDER
// ============================================================================

/**
 * Provider interface for a documentation section
 *
 * Each section is responsible for rendering a specific part of the
 * CLAUDE.md documentation. Sections are rendered in priority order.
 *
 * @example
 * ```typescript
 * const sessionStartupSection: SectionProvider = {
 *   id: 'session-startup',
 *   name: 'Session Startup',
 *   priority: SectionPriority.SESSION_STARTUP,
 *
 *   shouldRender: (ctx) => ctx.tools.some(t => t.workflow?.trigger === 'session_start'),
 *
 *   render: (ctx) => {
 *     const startupTools = ctx.tools.filter(t => t.workflow?.trigger === 'session_start');
 *     return {
 *       content: `## Session Startup\n\n${formatTools(startupTools)}`,
 *       metadata: { toolCount: startupTools.length }
 *     };
 *   }
 * };
 * ```
 */
export interface SectionProvider {
  /** Unique identifier for this section */
  readonly id: SectionId;

  /** Human-readable name for display/debugging */
  readonly name: string;

  /**
   * Render priority (lower = earlier in document)
   * Use SectionPriority constants for standard positions
   */
  readonly priority: number;

  /**
   * Other section IDs that must be rendered before this one
   *
   * @example
   * ```typescript
   * dependencies: ['session-startup', 'context-cache']
   * ```
   */
  readonly dependencies?: readonly SectionId[];

  /**
   * Determine if this section should be rendered
   * Return false to skip the section entirely
   *
   * @param ctx - Section context with project info
   * @returns true to render, false to skip
   */
  shouldRender?(ctx: SectionContext): boolean;

  /**
   * Render the section content
   *
   * Can return either:
   * - A string (shorthand for { content: string })
   * - A SectionResult object for more control
   *
   * @param ctx - Section context with project info
   * @returns Markdown content or SectionResult
   */
  render(ctx: SectionContext): SectionResult | string;
}

// ============================================================================
// REGISTRATION OPTIONS
// ============================================================================

/**
 * Options for registering a section
 */
export interface SectionRegistrationOptions {
  /**
   * Replace existing section with same ID
   * Default: false (throws error on duplicate)
   */
  replace?: boolean;

  /**
   * Disable this section (can be re-enabled later)
   * Default: false
   */
  disabled?: boolean;
}

// ============================================================================
// TYPE ALIASES & REGISTRY INTERFACE
// ============================================================================

/**
 * Alias for SectionContext for backwards compatibility
 * Used in render function signatures
 */
export type SectionRenderContext = SectionContext;

/**
 * Section registry interface for managing section providers
 */
export interface SectionRegistry {
  /** Register a new section provider */
  register(provider: SectionProvider, options?: SectionRegistrationOptions): void;

  /** Get a section provider by ID */
  get(id: SectionId): SectionProvider | undefined;

  /** Get all registered section providers */
  all(): SectionProvider[];

  /** Check if a section is registered */
  has(id: SectionId): boolean;

  /** Unregister a section */
  unregister(id: SectionId): boolean;

  /** Clear all registered sections */
  clear(): void;

  /** Get count of registered sections */
  size(): number;
}
