import { getDatabase } from '../src/lib/@storage/database';

try {
  const db = getDatabase();
  console.log('Migrating ralph_guardrails table...');

  // Check if column exists
  const tableInfo = db.prepare('PRAGMA table_info(ralph_guardrails)').all() as any[];
  const hasType = tableInfo.some((col) => col.name === 'type');

  if (!hasType) {
    db.prepare("ALTER TABLE ralph_guardrails ADD COLUMN type TEXT DEFAULT 'guardrail'").run();
    console.log('✓ Added column `type` to ralph_guardrails');
  } else {
    console.log('ℹ Column `type` already exists');
  }
} catch (error) {
  console.error('Migration failed:', error);
  process.exit(1);
}
