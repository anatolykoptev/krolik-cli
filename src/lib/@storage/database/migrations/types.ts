/**
 * @module lib/@storage/database/migrations/types
 * @description Migration-specific types and constants
 */

/**
 * Memory types allowed in the database
 *
 * SINGLE SOURCE OF TRUTH for memory type CHECK constraint.
 * Update this array when adding new memory types.
 */
export const MEMORY_TYPES = [
  // Project-scoped types
  'observation',
  'decision',
  'bugfix',
  'feature',
  // Global types
  'pattern',
  'library',
  'snippet',
  'anti-pattern',
  // Special types
  'legal-case',
  'personal-note',
  'agent',
] as const;

export type MemoryType = (typeof MEMORY_TYPES)[number];

/**
 * Generate SQL CHECK constraint for memory types
 */
export function getMemoryTypeConstraint(): string {
  const types = MEMORY_TYPES.map((t) => `'${t}'`).join(', ');
  return `CHECK(type IN (${types}))`;
}

/**
 * Importance levels for memories
 */
export const IMPORTANCE_LEVELS = ['low', 'medium', 'high', 'critical'] as const;

export type ImportanceLevel = (typeof IMPORTANCE_LEVELS)[number];

/**
 * Generate SQL CHECK constraint for importance
 */
export function getImportanceConstraint(): string {
  const levels = IMPORTANCE_LEVELS.map((l) => `'${l}'`).join(', ');
  return `CHECK(importance IN (${levels}))`;
}

/**
 * Document types for docs cache
 */
export const DOCUMENT_TYPES = ['legal', 'technical', 'general', 'personal'] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/**
 * Generate SQL CHECK constraint for document types
 */
export function getDocumentTypeConstraint(): string {
  const types = DOCUMENT_TYPES.map((t) => `'${t}'`).join(', ');
  return `CHECK(document_type IN (${types}))`;
}

/**
 * Model names for agents
 */
export const MODEL_NAMES = ['sonnet', 'opus', 'haiku', 'inherit'] as const;

export type ModelName = (typeof MODEL_NAMES)[number];

/**
 * Generate SQL CHECK constraint for model names
 */
export function getModelConstraint(): string {
  const models = MODEL_NAMES.map((m) => `'${m}'`).join(', ');
  return `CHECK(model IN (${models}))`;
}
