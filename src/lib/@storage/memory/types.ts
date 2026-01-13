/**
 * @module lib/@storage/memory/types
 * @description Memory system type definitions
 *
 * Supports hybrid memory architecture:
 * - Project-scoped: decisions, bugfixes, features, observations
 * - Global-scoped: patterns, library docs, snippets, anti-patterns
 */

import type { Priority } from '@/types/severity';

// ============================================================================
// MEMORY TYPES
// ============================================================================

/**
 * Project-scoped memory types (stored per-project, context-specific)
 */
export type ProjectMemoryType = 'observation' | 'decision' | 'bugfix' | 'feature';

/**
 * Global memory types (stored globally, reusable across projects)
 */
export type GlobalMemoryType = 'pattern' | 'library' | 'snippet' | 'anti-pattern';

/**
 * All memory types
 */
export type MemoryType = ProjectMemoryType | GlobalMemoryType;

/**
 * Memory scope - determines where the memory is stored
 */
export type MemoryScope = 'project' | 'global';

/**
 * Memory source - where this knowledge came from
 */
export type MemorySource = 'manual' | 'context7' | 'ai-generated' | 'promoted';

/**
 * Importance levels (alias for shared Priority type)
 */
export type MemoryImportance = Priority;

// ============================================================================
// MEMORY RECORD
// ============================================================================

/**
 * Memory record
 */
export interface Memory {
  id: string;
  type: MemoryType;
  title: string;
  description: string;
  importance: MemoryImportance;
  project: string;
  branch?: string | undefined;
  commit?: string | undefined;
  tags: string[];
  files?: string[] | undefined;
  features?: string[] | undefined;
  createdAt: string;
  metadata?: Record<string, unknown> | undefined;
  /** Memory scope: project-specific or global */
  scope?: MemoryScope | undefined;
  /** Source of this memory */
  source?: MemorySource | undefined;
  /** Usage count for relevance tracking */
  usageCount?: number | undefined;
  /** Last time this memory was retrieved */
  lastUsedAt?: string | undefined;
  /** Original project (for promoted memories) */
  originalProject?: string | undefined;
  /** Original memory ID (for promoted memories) */
  originalId?: number | undefined;
}

// ============================================================================
// SAVE OPTIONS
// ============================================================================

/**
 * Memory save options
 */
export interface MemorySaveOptions {
  type: MemoryType;
  title: string;
  description: string;
  importance?: MemoryImportance | undefined;
  tags?: string[] | undefined;
  files?: string[] | undefined;
  features?: string[] | undefined;
  metadata?: Record<string, unknown> | undefined;
  /** Override default scope (auto-detected from type) */
  scope?: MemoryScope | undefined;
  /** Source of this memory */
  source?: MemorySource | undefined;
}

/**
 * Options for saving global memory
 */
export interface GlobalMemorySaveOptions {
  type: GlobalMemoryType;
  title: string;
  description: string;
  importance?: MemoryImportance | undefined;
  tags?: string[] | undefined;
  source?: MemorySource | undefined;
  metadata?: Record<string, unknown> | undefined;
}

// ============================================================================
// SEARCH OPTIONS
// ============================================================================

/**
 * Memory search options
 */
export interface MemorySearchOptions {
  query?: string | undefined;
  type?: MemoryType | undefined;
  importance?: MemoryImportance | undefined;
  project?: string | undefined;
  tags?: string[] | undefined;
  features?: string[] | undefined;
  limit?: number | undefined;
  /** Filter by scope */
  scope?: MemoryScope | undefined;
  /** Include global memories in project search (default: true) */
  includeGlobal?: boolean | undefined;
  /** Filter by source */
  source?: MemorySource | undefined;
}

/**
 * Memory search result
 */
export interface MemorySearchResult {
  memory: Memory;
  relevance: number;
}

// ============================================================================
// CONTEXT
// ============================================================================

/**
 * Memory context from project
 */
export interface MemoryContext {
  project: string;
  branch?: string | undefined;
  commit?: string | undefined;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Check if a memory type is global-scoped by default
 */
export function isGlobalType(type: MemoryType): type is GlobalMemoryType {
  return type === 'pattern' || type === 'library' || type === 'snippet' || type === 'anti-pattern';
}

/**
 * Check if a memory type is project-scoped by default
 */
export function isProjectType(type: MemoryType): type is ProjectMemoryType {
  return type === 'observation' || type === 'decision' || type === 'bugfix' || type === 'feature';
}

/**
 * Infer scope from memory type
 */
export function inferScope(type: MemoryType): MemoryScope {
  return isGlobalType(type) ? 'global' : 'project';
}

/**
 * All project memory types
 */
export const PROJECT_MEMORY_TYPES: readonly ProjectMemoryType[] = [
  'observation',
  'decision',
  'bugfix',
  'feature',
] as const;

/**
 * All global memory types
 */
export const GLOBAL_MEMORY_TYPES: readonly GlobalMemoryType[] = [
  'pattern',
  'library',
  'snippet',
  'anti-pattern',
] as const;

/**
 * All memory types
 */
export const ALL_MEMORY_TYPES: readonly MemoryType[] = [
  ...PROJECT_MEMORY_TYPES,
  ...GLOBAL_MEMORY_TYPES,
] as const;
