/**
 * @module lib/@memory/types
 * @description Memory system type definitions
 */

/**
 * Memory types
 */
export type MemoryType = 'observation' | 'decision' | 'pattern' | 'bugfix' | 'feature';

/**
 * Importance levels
 */
export type MemoryImportance = 'low' | 'medium' | 'high' | 'critical';

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
  branch?: string;
  commit?: string;
  tags: string[];
  files?: string[];
  features?: string[];
  createdAt: string;
  metadata?: Record<string, unknown>;
}

/**
 * Memory save options
 */
export interface MemorySaveOptions {
  type: MemoryType;
  title: string;
  description: string;
  importance?: MemoryImportance;
  tags?: string[];
  files?: string[];
  features?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Memory search options
 */
export interface MemorySearchOptions {
  query?: string;
  type?: MemoryType;
  importance?: MemoryImportance;
  project?: string;
  tags?: string[];
  features?: string[];
  limit?: number;
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
  branch?: string;
  commit?: string;
}
