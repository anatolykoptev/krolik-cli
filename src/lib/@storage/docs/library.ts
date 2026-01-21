/**
 * @module lib/@storage/docs/library
 * @description Library CRUD operations
 */

import { getDatabase } from '../database';
import { getExpirationEpoch } from './constants';
import { rowToLibrary } from './converters';
import type { CachedLibrary, DocumentType } from './types';

/**
 * Save library metadata with 7-day TTL
 */
export function saveLibrary(
  libraryId: string,
  name: string,
  version?: string,
  documentType?: DocumentType,
  jurisdiction?: string,
): CachedLibrary {
  const db = getDatabase();
  const now = new Date();
  const nowEpoch = now.getTime();
  const expiresAtEpoch = getExpirationEpoch();

  // Check if library already exists
  const existing = db.prepare('SELECT id FROM library_docs WHERE library_id = ?').get(libraryId) as
    | { id: number }
    | undefined;

  if (existing) {
    // Update existing library and refresh expiration
    db.prepare(
      `UPDATE library_docs
       SET library_name = ?, version = ?, fetched_at = ?, fetched_at_epoch = ?, expires_at_epoch = ?,
           document_type = ?, jurisdiction = ?
       WHERE library_id = ?`,
    ).run(
      name,
      version ?? null,
      now.toISOString(),
      nowEpoch,
      expiresAtEpoch,
      documentType ?? null,
      jurisdiction ?? null,
      libraryId,
    );

    // Get updated total snippets
    const totalRow = db
      .prepare('SELECT COUNT(*) as count FROM doc_sections WHERE library_id = ?')
      .get(libraryId) as { count: number };

    return {
      id: existing.id,
      libraryId,
      name,
      ...(version ? { version } : {}),
      fetchedAt: now.toISOString(),
      expiresAt: new Date(expiresAtEpoch).toISOString(),
      totalSnippets: totalRow.count,
      isExpired: false,
      ...(documentType ? { documentType } : {}),
      ...(jurisdiction ? { jurisdiction } : {}),
    };
  }

  // Insert new library
  const stmt = db.prepare(`
    INSERT INTO library_docs (library_id, library_name, version, fetched_at, fetched_at_epoch, expires_at_epoch, total_snippets, document_type, jurisdiction)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
  `);

  const result = stmt.run(
    libraryId,
    name,
    version ?? null,
    now.toISOString(),
    nowEpoch,
    expiresAtEpoch,
    documentType ?? null,
    jurisdiction ?? null,
  );

  return {
    id: Number(result.lastInsertRowid),
    libraryId,
    name,
    ...(version ? { version } : {}),
    fetchedAt: now.toISOString(),
    expiresAt: new Date(expiresAtEpoch).toISOString(),
    totalSnippets: 0,
    isExpired: false,
    ...(documentType ? { documentType } : {}),
    ...(jurisdiction ? { jurisdiction } : {}),
  };
}

/**
 * Get library by Context7 ID
 */
export function getLibrary(libraryId: string): CachedLibrary | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM library_docs WHERE library_id = ?').get(libraryId) as
    | Record<string, unknown>
    | undefined;

  if (!row) return null;
  return rowToLibrary(row);
}

/**
 * Get library by display name (case-insensitive)
 */
export function getLibraryByName(name: string): CachedLibrary | null {
  const db = getDatabase();
  const row = db
    .prepare('SELECT * FROM library_docs WHERE LOWER(library_name) = LOWER(?)')
    .get(name) as Record<string, unknown> | undefined;

  if (!row) return null;
  return rowToLibrary(row);
}

/**
 * List all cached libraries with expiry status
 */
export function listLibraries(): CachedLibrary[] {
  const db = getDatabase();

  const rows = db.prepare('SELECT * FROM library_docs ORDER BY fetched_at DESC').all() as Array<
    Record<string, unknown>
  >;

  return rows.map(rowToLibrary);
}
