#!/usr/bin/env tsx
/**
 * Migrate doc sections to have embeddings
 * Usage: tsx scripts/migrate-doc-embeddings.ts
 */

import { migrateDocEmbeddings } from '../src/lib/@storage/docs/migrate-embeddings';

async function main() {
  console.log('Starting doc embeddings migration...\n');

  const result = await migrateDocEmbeddings((processed, total) => {
    if (processed % 10 === 0 || processed === total) {
      const percent = ((processed / total) * 100).toFixed(1);
      console.log(`Progress: ${processed}/${total} (${percent}%)`);
    }
  });

  console.log('\n✅ Migration complete!');
  console.log(`Processed: ${result.processed} sections`);
  console.log(`Total: ${result.total} sections`);
}

main().catch((err) => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
