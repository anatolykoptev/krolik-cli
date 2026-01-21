# Migration 14 Bug Fixes - Lessons Learned

## 1. SQLite Migrations Must Be Idempotent

**Problem:** Migration 14 failed with "duplicate column name: document_type" because column already existed from manual testing.

**Root Cause:** `ALTER TABLE ADD COLUMN` fails if column exists. SQLite doesn't have `IF NOT EXISTS` for ALTER TABLE.

**Solution:** Check column existence before adding:
```typescript
const columns = db.pragma('table_info(library_docs)') as Array<{ name: string }>;
const hasColumn = columns.some((col) => col.name === 'document_type');
if (!hasColumn) {
  db.exec(`ALTER TABLE library_docs ADD COLUMN document_type TEXT...`);
}
```

**Files:** `src/lib/@storage/database.ts:966-991`

---

## 2. Clear Statement Cache After Migrations

**Problem:** After migrations, cached prepared statements still reference old schema, causing "duplicate column name" or "no such column" errors.

**Root Cause:** `prepareStatement()` caches statements by SQL. When schema changes, cached statements become stale.

**Solution:** Call `clearStatementCache()` immediately after `runMigrations()`:
```typescript
runMigrations(db);
clearStatementCache();  // Invalidate all cached statements
dbInstances.set(dbPath, db);
```

**Files:** `src/lib/@storage/database.ts:165-166`

---

## 3. FTS5 Standalone vs Content Mode

**Problem:** FTS5 with `content=memories` failed with "no such column: T.tags_text" because tags_text is a virtual column.

**Root Cause:** FTS5 `content=` option requires columns to exist in source table. Virtual FTS columns (formatted from JSON) don't exist in source.

**Solution:** Use standalone FTS5 (no `content=`) and manually populate:
```typescript
CREATE VIRTUAL TABLE memories_fts USING fts5(
  title, description, tags_text, features_text,
  tokenize='porter unicode61'
  -- NO content=memories
);

INSERT INTO memories_fts(rowid, title, description, tags_text, features_text)
SELECT id, title, description,
  REPLACE(REPLACE(tags, '[', ''), ']', ''),
  REPLACE(REPLACE(features, '[', ''), ']', '')
FROM memories;
```

**Files:** `src/lib/@storage/database.ts:1066-1085`

---

## 4. krolik_docs Now Project-Agnostic with DocumentType

**Decision:** Added `document_type` column to `library_docs` with 4 types:
- `legal`: State laws, regulations, compliance
- `technical`: Library API docs (Next.js, React, etc.)
- `general`: General documentation
- `personal`: Personal notes

**Usage:**
```bash
krolik docs search "mini-WARN" --document-type legal  # Only legal docs
krolik docs search "app router"                        # All types
```

**Rationale:** Enables global documentation search by type instead of project. Legal docs (state laws) searchable separately from technical docs.

**Files:**
- `src/lib/@storage/database.ts:966-976` (migration)
- `src/lib/@storage/docs/search.ts:48-51` (filter)
- `src/commands/docs/index.ts:39` (interface)
- `src/cli/commands/docs.ts:63` (CLI option)

---

## 5. Migration 15: Fixed Lost Columns from Migration 14 ✅

**BUGS FIXED:**

1. **Missing columns** - Migration 14 accidentally didn't include these columns in memories_v14:
   - `metadata` (TEXT, default '{}')
   - `created_at_epoch` (INTEGER)

2. **Missing updated_at in INSERT** - Migration 14 added `updated_at` as NOT NULL but forgot to update CRUD functions.

**Migration 15 Solution:**
```typescript
// Check column existence (idempotent)
const memoriesColumns = db.pragma('table_info(memories)');
const hasMetadata = memoriesColumns.some(col => col.name === 'metadata');
const hasCreatedAtEpoch = memoriesColumns.some(col => col.name === 'created_at_epoch');

if (!hasMetadata) {
  db.exec(`ALTER TABLE memories ADD COLUMN metadata TEXT DEFAULT '{}';`);
}

if (!hasCreatedAtEpoch) {
  db.exec(`
    ALTER TABLE memories ADD COLUMN created_at_epoch INTEGER;
    UPDATE memories SET created_at_epoch = unixepoch(created_at) WHERE created_at_epoch IS NULL;
  `);
}
```

**Also Fixed in crud.ts:**
```typescript
// Both save() and saveGlobal() now include updated_at:
INSERT INTO memories (..., updated_at) VALUES (..., ?)
stmt.run(..., now.toISOString());
```

**Verification:**
- Direct SQL: ✅ Working
- CLI save: ✅ Working
- Schema version: 15 ✅

**Files:**
- `src/lib/@storage/database.ts:1125-1157` (Migration 15)
- `src/lib/@storage/memory/crud.ts:45-66` (save fix)
- `src/lib/@storage/memory/crud.ts:115-131` (saveGlobal fix)

---

**Date:** 2026-01-21 (updated)
**Context:** Fixed krolik_docs duplicate column errors, made migrations idempotent, added documentType classification, fixed Migration 14 bugs with Migration 15
