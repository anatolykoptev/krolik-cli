/**
 * @module lib/@docs-cache/storage/sections
 * @description Documentation sections CRUD operations
 */

import { getDatabase } from '../../@memory/database';
import type { DocSection } from '../types';
import { rowToSection } from './converters';

/**
 * Save a documentation section
 */
export function saveSection(
  libraryId: string,
  topic: string | undefined,
  title: string,
  content: string,
  codeSnippets: string[],
  pageNumber: number,
): DocSection {
  const db = getDatabase();
  const now = new Date().toISOString();

  // Verify library exists
  const libRow = db.prepare('SELECT id FROM library_docs WHERE library_id = ?').get(libraryId) as
    | { id: number }
    | undefined;

  if (!libRow) {
    throw new Error(`Library ${libraryId} not found in cache`);
  }

  // Check if section already exists (by library + topic + title)
  const existing = db
    .prepare(
      "SELECT id FROM doc_sections WHERE library_id = ? AND COALESCE(topic, '') = COALESCE(?, '') AND title = ?",
    )
    .get(libraryId, topic ?? null, title) as { id: number } | undefined;

  if (existing) {
    // Update existing section
    db.prepare(
      `UPDATE doc_sections
       SET title = ?, content = ?, code_snippets = ?, created_at = ?
       WHERE id = ?`,
    ).run(title, content, JSON.stringify(codeSnippets), now, existing.id);

    return {
      id: existing.id,
      libraryId,
      ...(topic ? { topic } : {}),
      title,
      content,
      codeSnippets,
      pageNumber,
    };
  }

  // Insert new section
  const stmt = db.prepare(`
    INSERT INTO doc_sections (library_id, topic, title, content, code_snippets, page_number, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    libraryId,
    topic ?? null,
    title,
    content,
    JSON.stringify(codeSnippets),
    pageNumber,
    now,
  );

  // Update total snippets count
  const totalRow = db
    .prepare('SELECT COUNT(*) as count FROM doc_sections WHERE library_id = ?')
    .get(libraryId) as { count: number };

  db.prepare('UPDATE library_docs SET total_snippets = ? WHERE library_id = ?').run(
    totalRow.count,
    libraryId,
  );

  return {
    id: Number(result.lastInsertRowid),
    libraryId,
    ...(topic ? { topic } : {}),
    title,
    content,
    codeSnippets,
    pageNumber,
  };
}

/**
 * Get sections for a library, optionally filtered by topic
 */
export function getSectionsByLibrary(libraryId: string, topic?: string): DocSection[] {
  const db = getDatabase();
  const params: unknown[] = [libraryId];
  let sql = 'SELECT * FROM doc_sections WHERE library_id = ?';

  if (topic) {
    sql += ' AND topic = ?';
    params.push(topic);
  }

  sql += ' ORDER BY page_number ASC';

  const rows = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;
  return rows.map(rowToSection);
}
