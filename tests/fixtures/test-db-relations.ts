/**
 * Test script for db-relations parser
 *
 * Run: npx tsx test-db-relations.ts
 */

import * as path from 'node:path';
import {
  formatCriticalRelationsAscii,
  formatDbRelationsAscii,
  parseDbRelations,
} from './src/commands/context/parsers/db-relations';

// Find schema directory
const schemaDir = path.join(process.cwd(), '../piternow-wt-fix/packages/db/prisma');

console.log('Parsing Prisma schema from:', schemaDir);
console.log('='.repeat(80));
console.log('');

// Parse relations
const relations = parseDbRelations(schemaDir);

console.log(`Found ${relations.models.length} models`);
console.log(`Found ${relations.relations.length} relations`);
console.log(`Found ${relations.indexes.length} indexes`);
console.log('');

// Test 1: Show all relations
console.log('TEST 1: All Relations');
console.log('='.repeat(80));
const allRelations = formatDbRelationsAscii(relations);
console.log(allRelations);
console.log('');

// Test 2: Filter by booking-related models
console.log('TEST 2: Booking Domain Relations');
console.log('='.repeat(80));
const bookingModels = [
  'Booking',
  'BookingSettings',
  'Availability',
  'BookingReminder',
  'Customer',
  'Place',
  'User',
];
const bookingRelations = formatDbRelationsAscii(relations, bookingModels);
console.log(bookingRelations);
console.log('');

// Test 3: Critical relations for bookings
console.log('TEST 3: Critical Relations for Booking Domain');
console.log('='.repeat(80));
const criticalBooking = formatCriticalRelationsAscii(relations, bookingModels);
console.log(criticalBooking);
console.log('');

// Test 4: Event & Ticketing relations
console.log('TEST 4: Event & Ticketing Domain Relations');
console.log('='.repeat(80));
const eventModels = [
  'Event',
  'EventFavorite',
  'EventInteraction',
  'TicketType',
  'TicketOrder',
  'User',
  'Place',
];
const eventRelations = formatDbRelationsAscii(relations, eventModels);
console.log(eventRelations);
console.log('');

// Test 5: Show some detailed relation info
console.log('TEST 5: Detailed Relation Analysis');
console.log('='.repeat(80));

// Find cascade deletes
const cascadeDeletes = relations.relations.filter((r) => r.onDelete === 'Cascade');
console.log(`Relations with CASCADE delete: ${cascadeDeletes.length}`);
for (const rel of cascadeDeletes.slice(0, 10)) {
  console.log(`  ${rel.from}.${rel.field} → ${rel.to} [${rel.type}]`);
}
console.log('');

// Find many-to-many
const manyToMany = relations.relations.filter((r) => r.type === 'many-to-many');
console.log(`Many-to-many relations: ${manyToMany.length}`);
for (const rel of manyToMany) {
  console.log(`  ${rel.from}.${rel.field} ⟷ ${rel.to}.${rel.backRelationField || '?'}`);
}
console.log('');

// Find models with most relations
const relationsByModel = new Map<string, number>();
for (const rel of relations.relations) {
  relationsByModel.set(rel.from, (relationsByModel.get(rel.from) || 0) + 1);
  relationsByModel.set(rel.to, (relationsByModel.get(rel.to) || 0) + 1);
}

const topModels = [...relationsByModel.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

console.log('Models with most relations:');
for (const [model, count] of topModels) {
  console.log(`  ${model}: ${count} relations`);
}
console.log('');

// Test 6: Index analysis
console.log('TEST 6: Index Analysis');
console.log('='.repeat(80));

const uniqueIndexes = relations.indexes.filter((idx) => idx.unique);
const regularIndexes = relations.indexes.filter((idx) => !idx.unique);

console.log(`Unique indexes: ${uniqueIndexes.length}`);
console.log(`Regular indexes: ${regularIndexes.length}`);
console.log('');

// Show composite indexes (more than 1 field)
const compositeIndexes = relations.indexes.filter((idx) => idx.fields.length > 1);
console.log(`Composite indexes: ${compositeIndexes.length}`);
for (const idx of compositeIndexes.slice(0, 10)) {
  const type = idx.unique ? '[UNIQUE]' : '[INDEX]';
  console.log(`  ${idx.model}: ${idx.fields.join(', ')} ${type}`);
}
console.log('');

console.log('✅ All tests completed!');
