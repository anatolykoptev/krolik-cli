/**
 * @module lib/@storage/docs/converters
 * @description Database row to object converters
 */

import type { CachedLibrary, DocSection } from './types';

/**
 * Convert database row to CachedLibrary object
 */
export function rowToLibrary(row: Record<string, unknown>): CachedLibrary {
  const expiresAtEpoch = Number(row.expires_at_epoch);
  const now = Date.now();
  const version = row.version as string | null;
  const documentType = row.document_type as 'legal' | 'technical' | 'general' | null;
  const jurisdiction = row.jurisdiction as string | null;

  return {
    id: Number(row.id),
    libraryId: row.library_id as string,
    name: row.library_name as string,
    ...(version ? { version } : {}),
    fetchedAt: row.fetched_at as string,
    expiresAt: new Date(expiresAtEpoch).toISOString(),
    totalSnippets: Number(row.total_snippets ?? 0),
    isExpired: expiresAtEpoch < now,
    ...(documentType ? { documentType } : {}),
    ...(jurisdiction ? { jurisdiction } : {}),
  };
}

/**
 * Convert database row to DocSection object
 */
export function rowToSection(row: Record<string, unknown>): DocSection {
  const topic = row.topic as string | null;

  return {
    id: Number(row.id),
    libraryId: row.library_id as string,
    ...(topic ? { topic } : {}),
    title: row.title as string,
    content: row.content as string,
    codeSnippets: JSON.parse((row.code_snippets as string) || '[]'),
    pageNumber: Number(row.page_number ?? 1),
  };
}
