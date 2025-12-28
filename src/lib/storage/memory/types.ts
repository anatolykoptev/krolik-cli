/**
 * @module lib/storage/memory/types
 * @description Memory system type definitions
 */

import type { Priority } from '@/types/severity';

/**
 * Memory types
 */
export type MemoryType = 'observation' | 'decision' | 'pattern' | 'bugfix' | 'feature';

/**
 * Importance levels (alias for shared Priority type)
 */
export type MemoryImportance = Priority;

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
}

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
}

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
}

/**
 * Memory search result
 */
export interface MemorySearchResult {
  memory: Memory;
  relevance: number;
}

/**
 * Memory context from project
 */
export interface MemoryContext {
  project: string;
  branch?: string | undefined;
  commit?: string | undefined;
}
