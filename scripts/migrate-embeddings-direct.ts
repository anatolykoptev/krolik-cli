#!/usr/bin/env bun
import { getDatabase, prepareStatement } from '../src/lib/@storage/database';
import { preloadEmbeddingPool } from '../src/lib/@storage/memory/embedding-pool';
import { generateEmbedding, isEmbeddingsAvailable } from '../src/lib/@storage/memory/embeddings';

async function main() {
  console.log('Loading embeddings model...');
  await preloadEmbeddingPool();

  let retries = 0;
  while (!isEmbeddingsAvailable() && retries < 20) {
    await new Promise((r) => setTimeout(r, 500));
    retries++;
  }

  if (!isEmbeddingsAvailable()) {
    throw new Error('Model not loaded');
  }
  console.log('✅ Model ready\n');

  const db = getDatabase();
  const countSql = `SELECT COUNT(*) as count FROM doc_sections s LEFT JOIN doc_embeddings de ON s.id = de.section_id WHERE de.section_id IS NULL`;
  const total = prepareStatement(db, countSql).get().count;

  console.log(`Migrating ${total} sections...\n`);

  let processed = 0;
  const batchSize = 50;

  while (true) {
    const rows = prepareStatement(
      db,
      `SELECT s.id, s.title, s.content FROM doc_sections s LEFT JOIN doc_embeddings de ON s.id = de.section_id WHERE de.section_id IS NULL LIMIT ?`,
    ).all(batchSize);
    if (rows.length === 0) break;

    for (const row of rows) {
      try {
        const text = `${row.title} ${row.content}`;
        const result = await generateEmbedding(text);
        const buffer = Buffer.from(result.embedding.buffer);
        prepareStatement(
          db,
          `INSERT OR REPLACE INTO doc_embeddings (section_id, embedding, created_at) VALUES (?, ?, datetime('now'))`,
        ).run(row.id, buffer);
        processed++;
        if (processed % 10 === 0)
          console.log(`${processed}/${total} (${((processed / total) * 100).toFixed(1)}%)`);
      } catch {}
    }
  }

  console.log(`\n✅ Done: ${processed}/${total}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
