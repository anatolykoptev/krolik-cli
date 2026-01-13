# Hybrid Memory Architecture for Krolik

## Overview

Enhanced memory system with:
1. **Semantic Search** — SQLite vec extension for embedding-based similarity
2. **Memory Graph** — Relationships between memories (caused, related, supersedes)
3. **Hybrid Scope** — Project-local + global knowledge base
4. **Smart Ranking** — Multi-factor relevance scoring

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Memory System                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   memories   │    │  embeddings  │    │ memory_links │       │
│  │   (FTS5)     │◄──►│  (vec0)      │    │  (graph)     │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│         │                   │                   │                │
│         └───────────────────┼───────────────────┘                │
│                             ▼                                    │
│                    ┌──────────────┐                              │
│                    │ Smart Search │                              │
│                    │  - BM25      │                              │
│                    │  - Cosine    │                              │
│                    │  - Graph     │                              │
│                    └──────────────┘                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Phase 1: Semantic Search with SQLite vec ✅ CURRENT

### Dependencies

```json
{
  "dependencies": {
    "sqlite-vec": "^0.1.0"
  }
}
```

### Database Schema

```sql
-- Embeddings table using sqlite-vec
CREATE VIRTUAL TABLE memory_embeddings USING vec0(
  memory_id INTEGER PRIMARY KEY,
  embedding FLOAT[384]  -- all-MiniLM-L6-v2 dimension
);

-- Index for fast similarity search
-- vec0 automatically creates HNSW index
```

### Embedding Generation

Using `@xenova/transformers` for local inference (no API calls):

```typescript
// lib/@storage/memory/embeddings.ts
import { pipeline } from '@xenova/transformers';

let embedder: Pipeline | null = null;

/**
 * Initialize embedding model (lazy load)
 * Model: all-MiniLM-L6-v2 (~23MB, 384 dimensions)
 */
async function getEmbedder(): Promise<Pipeline> {
  if (!embedder) {
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return embedder;
}

/**
 * Generate embedding for text
 */
export async function generateEmbedding(text: string): Promise<Float32Array> {
  const model = await getEmbedder();
  const output = await model(text, { pooling: 'mean', normalize: true });
  return output.data as Float32Array;
}

/**
 * Batch embed multiple texts
 */
export async function generateEmbeddings(texts: string[]): Promise<Float32Array[]> {
  const model = await getEmbedder();
  const results: Float32Array[] = [];

  for (const text of texts) {
    const output = await model(text, { pooling: 'mean', normalize: true });
    results.push(output.data as Float32Array);
  }

  return results;
}
```

### Semantic Search Implementation

```typescript
// lib/@storage/memory/semantic-search.ts
import * as sqliteVec from 'sqlite-vec';
import { generateEmbedding } from './embeddings';

/**
 * Initialize sqlite-vec extension
 */
export function initVecExtension(db: Database.Database): void {
  sqliteVec.load(db);

  // Create embeddings table if not exists
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS memory_embeddings USING vec0(
      memory_id INTEGER PRIMARY KEY,
      embedding FLOAT[384]
    );
  `);
}

/**
 * Store embedding for a memory
 */
export async function storeEmbedding(
  db: Database.Database,
  memoryId: number,
  text: string
): Promise<void> {
  const embedding = await generateEmbedding(text);

  db.prepare(`
    INSERT OR REPLACE INTO memory_embeddings (memory_id, embedding)
    VALUES (?, ?)
  `).run(memoryId, embedding);
}

/**
 * Semantic search using cosine similarity
 */
export async function semanticSearch(
  db: Database.Database,
  query: string,
  limit: number = 10
): Promise<Array<{ memoryId: number; similarity: number }>> {
  const queryEmbedding = await generateEmbedding(query);

  const results = db.prepare(`
    SELECT
      memory_id,
      1 - vec_distance_cosine(embedding, ?) as similarity
    FROM memory_embeddings
    WHERE similarity > 0.5
    ORDER BY similarity DESC
    LIMIT ?
  `).all(queryEmbedding, limit) as Array<{ memory_id: number; similarity: number }>;

  return results.map(r => ({
    memoryId: r.memory_id,
    similarity: r.similarity,
  }));
}

/**
 * Hybrid search: combine BM25 + semantic
 */
export async function hybridSearch(
  db: Database.Database,
  query: string,
  options: {
    limit?: number;
    semanticWeight?: number;  // 0-1, default 0.5
    bm25Weight?: number;      // 0-1, default 0.5
  } = {}
): Promise<MemorySearchResult[]> {
  const { limit = 10, semanticWeight = 0.5, bm25Weight = 0.5 } = options;

  // Get BM25 results
  const bm25Results = searchWithBM25(db, query, limit * 2);

  // Get semantic results
  const semanticResults = await semanticSearch(db, query, limit * 2);

  // Merge and rerank
  const scoreMap = new Map<number, { bm25: number; semantic: number }>();

  for (const r of bm25Results) {
    scoreMap.set(r.memory.id, {
      bm25: r.relevance / 100,
      semantic: 0
    });
  }

  for (const r of semanticResults) {
    const existing = scoreMap.get(r.memoryId) ?? { bm25: 0, semantic: 0 };
    existing.semantic = r.similarity;
    scoreMap.set(r.memoryId, existing);
  }

  // Calculate combined score
  const combined = Array.from(scoreMap.entries())
    .map(([id, scores]) => ({
      memoryId: id,
      score: scores.bm25 * bm25Weight + scores.semantic * semanticWeight,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  // Fetch full memories
  return combined.map(c => ({
    memory: getMemoryById(db, c.memoryId)!,
    relevance: c.score * 100,
  }));
}
```

### Auto-embed on Save

```typescript
// Modify save() in crud.ts
export async function save(options: MemorySaveOptions): Promise<Memory> {
  const db = getDatabase();
  const memory = insertMemory(db, options);

  // Generate and store embedding
  const textToEmbed = `${memory.title} ${memory.description}`;
  await storeEmbedding(db, memory.id, textToEmbed);

  return memory;
}
```

---

## Phase 2: Memory Graph (Relationships)

### Schema

```sql
-- Memory relationships table
CREATE TABLE IF NOT EXISTS memory_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_id INTEGER NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  to_id INTEGER NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL CHECK(link_type IN (
    'caused',      -- This memory caused/led to the linked memory
    'related',     -- General relationship
    'supersedes',  -- This memory replaces the linked memory
    'implements',  -- This memory implements the linked decision
    'contradicts'  -- This memory contradicts the linked memory
  )),
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(from_id, to_id, link_type)
);

-- Index for efficient traversal
CREATE INDEX IF NOT EXISTS idx_memory_links_from ON memory_links(from_id);
CREATE INDEX IF NOT EXISTS idx_memory_links_to ON memory_links(to_id);
CREATE INDEX IF NOT EXISTS idx_memory_links_type ON memory_links(link_type);
```

### Link Operations

```typescript
// lib/@storage/memory/links.ts

export type LinkType = 'caused' | 'related' | 'supersedes' | 'implements' | 'contradicts';

/**
 * Create a link between two memories
 */
export function createLink(
  fromId: number,
  toId: number,
  linkType: LinkType
): void {
  const db = getDatabase();
  db.prepare(`
    INSERT OR IGNORE INTO memory_links (from_id, to_id, link_type)
    VALUES (?, ?, ?)
  `).run(fromId, toId, linkType);
}

/**
 * Get all memories linked from a memory
 */
export function getLinkedFrom(
  memoryId: number,
  linkType?: LinkType
): Array<{ memory: Memory; linkType: LinkType }> {
  const db = getDatabase();

  const sql = linkType
    ? `SELECT m.*, ml.link_type FROM memories m
       JOIN memory_links ml ON m.id = ml.to_id
       WHERE ml.from_id = ? AND ml.link_type = ?`
    : `SELECT m.*, ml.link_type FROM memories m
       JOIN memory_links ml ON m.id = ml.to_id
       WHERE ml.from_id = ?`;

  const params = linkType ? [memoryId, linkType] : [memoryId];
  const rows = db.prepare(sql).all(...params);

  return rows.map(row => ({
    memory: rowToMemory(row),
    linkType: row.link_type as LinkType,
  }));
}

/**
 * Get all memories linking to a memory
 */
export function getLinkedTo(
  memoryId: number,
  linkType?: LinkType
): Array<{ memory: Memory; linkType: LinkType }> {
  const db = getDatabase();

  const sql = linkType
    ? `SELECT m.*, ml.link_type FROM memories m
       JOIN memory_links ml ON m.id = ml.from_id
       WHERE ml.to_id = ? AND ml.link_type = ?`
    : `SELECT m.*, ml.link_type FROM memories m
       JOIN memory_links ml ON m.id = ml.from_id
       WHERE ml.to_id = ?`;

  const params = linkType ? [memoryId, linkType] : [memoryId];
  const rows = db.prepare(sql).all(...params);

  return rows.map(row => ({
    memory: rowToMemory(row),
    linkType: row.link_type as LinkType,
  }));
}

/**
 * Get memory chain (traverse graph)
 */
export function getMemoryChain(
  memoryId: number,
  direction: 'forward' | 'backward' | 'both' = 'both',
  maxDepth: number = 3
): Memory[] {
  const visited = new Set<number>();
  const result: Memory[] = [];

  function traverse(id: number, depth: number): void {
    if (depth > maxDepth || visited.has(id)) return;
    visited.add(id);

    const memory = getMemoryById(id);
    if (memory) result.push(memory);

    if (direction === 'forward' || direction === 'both') {
      for (const { memory: linked } of getLinkedFrom(id)) {
        traverse(linked.id, depth + 1);
      }
    }

    if (direction === 'backward' || direction === 'both') {
      for (const { memory: linked } of getLinkedTo(id)) {
        traverse(linked.id, depth + 1);
      }
    }
  }

  traverse(memoryId, 0);
  return result;
}

/**
 * Find superseded memories (outdated decisions)
 */
export function getSupersededMemories(project?: string): Memory[] {
  const db = getDatabase();

  const sql = project
    ? `SELECT m.* FROM memories m
       JOIN memory_links ml ON m.id = ml.to_id
       WHERE ml.link_type = 'supersedes' AND m.project = ?`
    : `SELECT m.* FROM memories m
       JOIN memory_links ml ON m.id = ml.to_id
       WHERE ml.link_type = 'supersedes'`;

  const rows = db.prepare(sql).all(project ? [project] : []);
  return rows.map(rowToMemory);
}
```

---

## Phase 3: New MCP Tools

### krolik_mem_semantic_search

```typescript
{
  name: 'krolik_mem_semantic_search',
  description: 'Semantic search using AI embeddings. Finds conceptually similar memories even without exact keyword matches.',
  inputSchema: {
    properties: {
      query: {
        type: 'string',
        description: 'Natural language query (e.g., "how do we handle user sessions")'
      },
      project: { type: 'string' },
      limit: { type: 'number', default: 10 },
      minSimilarity: {
        type: 'number',
        default: 0.5,
        description: 'Minimum cosine similarity (0-1)'
      },
      hybrid: {
        type: 'boolean',
        default: true,
        description: 'Combine with BM25 keyword search'
      },
    },
    required: ['query'],
  },
}
```

### krolik_mem_link

```typescript
{
  name: 'krolik_mem_link',
  description: 'Create a relationship between two memories',
  inputSchema: {
    properties: {
      fromId: { type: 'number', description: 'Source memory ID' },
      toId: { type: 'number', description: 'Target memory ID' },
      linkType: {
        enum: ['caused', 'related', 'supersedes', 'implements', 'contradicts'],
        description: 'Type of relationship'
      },
    },
    required: ['fromId', 'toId', 'linkType'],
  },
}
```

### krolik_mem_chain

```typescript
{
  name: 'krolik_mem_chain',
  description: 'Get related memories by traversing the memory graph',
  inputSchema: {
    properties: {
      memoryId: { type: 'number', description: 'Starting memory ID' },
      direction: {
        enum: ['forward', 'backward', 'both'],
        default: 'both',
        description: 'Traversal direction'
      },
      maxDepth: { type: 'number', default: 3 },
    },
    required: ['memoryId'],
  },
}
```

### krolik_mem_outdated

```typescript
{
  name: 'krolik_mem_outdated',
  description: 'List superseded/outdated memories that have been replaced',
  inputSchema: {
    properties: {
      project: { type: 'string' },
    },
  },
}
```

---

## Phase 4: Knowledge Digest (Auto-summarization)

### Digest Generation

```typescript
// lib/@storage/memory/digest.ts

interface KnowledgeDigest {
  project: string;
  generatedAt: string;
  summary: {
    totalMemories: number;
    byType: Record<MemoryType, number>;
    byImportance: Record<MemoryImportance, number>;
  };
  keyDecisions: Memory[];
  activePatterns: Memory[];
  recentBugfixes: Memory[];
  outdatedCount: number;
}

/**
 * Generate knowledge digest for a project
 */
export function generateDigest(project: string): KnowledgeDigest {
  const db = getDatabase();

  // Count by type
  const byType = db.prepare(`
    SELECT type, COUNT(*) as count FROM memories
    WHERE project = ?
    GROUP BY type
  `).all(project);

  // Count by importance
  const byImportance = db.prepare(`
    SELECT importance, COUNT(*) as count FROM memories
    WHERE project = ?
    GROUP BY importance
  `).all(project);

  // Key decisions (critical/high importance)
  const keyDecisions = db.prepare(`
    SELECT * FROM memories
    WHERE project = ? AND type = 'decision' AND importance IN ('critical', 'high')
    ORDER BY created_at_epoch DESC
    LIMIT 5
  `).all(project).map(rowToMemory);

  // Active patterns
  const activePatterns = db.prepare(`
    SELECT * FROM memories
    WHERE project = ? AND type = 'pattern'
    ORDER BY usage_count DESC, created_at_epoch DESC
    LIMIT 5
  `).all(project).map(rowToMemory);

  // Recent bugfixes
  const recentBugfixes = db.prepare(`
    SELECT * FROM memories
    WHERE project = ? AND type = 'bugfix'
    ORDER BY created_at_epoch DESC
    LIMIT 5
  `).all(project).map(rowToMemory);

  // Outdated count
  const outdatedCount = getSupersededMemories(project).length;

  return {
    project,
    generatedAt: new Date().toISOString(),
    summary: {
      totalMemories: byType.reduce((sum, t) => sum + t.count, 0),
      byType: Object.fromEntries(byType.map(t => [t.type, t.count])),
      byImportance: Object.fromEntries(byImportance.map(i => [i.importance, i.count])),
    },
    keyDecisions,
    activePatterns,
    recentBugfixes,
    outdatedCount,
  };
}
```

### MCP Tool

```typescript
{
  name: 'krolik_mem_digest',
  description: 'Generate knowledge digest summarizing project memories',
  inputSchema: {
    properties: {
      project: { type: 'string' },
      feature: { type: 'string', description: 'Filter by feature' },
    },
  },
}
```

---

## Implementation Order

### Immediate (Phase 1)
1. ✅ Add `sqlite-vec` and `@xenova/transformers` dependencies
2. ✅ Create `embeddings.ts` module
3. ✅ Create `semantic-search.ts` module
4. ✅ Add `memory_embeddings` table initialization
5. ✅ Modify `save()` to auto-generate embeddings
6. ✅ Add `krolik_mem_semantic_search` MCP tool

### Next (Phase 2)
1. Create `memory_links` table
2. Create `links.ts` module
3. Add `krolik_mem_link` MCP tool
4. Add `krolik_mem_chain` MCP tool
5. Add `krolik_mem_outdated` MCP tool

### Later (Phase 3-4)
1. Add `krolik_mem_digest` MCP tool
2. Integrate digest into `krolik_context` output
3. Add auto-linking suggestions based on semantic similarity

---

## Benefits for AI

| Feature | Benefit |
|---------|---------|
| **Semantic Search** | Find "authentication" when searching "login security" |
| **Memory Graph** | Understand decision chains and what's outdated |
| **Knowledge Digest** | Quick project overview without reading all memories |
| **Hybrid Search** | Best of keyword (precision) + semantic (recall) |

## Technical Notes

### Model Selection

Using `all-MiniLM-L6-v2` because:
- Small size (~23MB)
- Fast inference (~50ms per text)
- Good quality for short texts
- MIT licensed
- Works offline

### SQLite vec Performance

- HNSW index: O(log n) search
- 10K memories: ~10ms search time
- Embedding storage: ~1.5KB per memory (384 floats)

### Fallback Strategy

If sqlite-vec fails to load:
1. Log warning
2. Fall back to BM25-only search
3. Skip embedding generation on save
4. System remains functional
