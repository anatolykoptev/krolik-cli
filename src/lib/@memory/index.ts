/**
 * @module lib/@memory
 * @description SQLite-based memory system for persistent AI context
 */

export { closeDatabase, getDatabase, getDatabasePath, getDatabaseStats } from './database';

export {
  getById,
  getProjects,
  recent,
  remove,
  save,
  search,
  searchByFeatures,
  stats,
  update,
} from './storage';
export type {
  Memory,
  MemoryContext,
  MemoryImportance,
  MemorySaveOptions,
  MemorySearchOptions,
  MemorySearchResult,
  MemoryType,
} from './types';
