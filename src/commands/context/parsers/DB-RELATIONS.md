# DB Relations Parser

**Module:** `commands/context/parsers/db-relations`

Comprehensive Prisma schema relations analyzer that extracts and visualizes database relationships, foreign keys, cascade rules, and indexes.

---

## Features

### 1. Relation Parsing

Automatically detects and classifies:

- **One-to-one** relationships (scalar field → scalar field)
- **One-to-many** relationships (scalar field → array field)
- **Many-to-many** relationships (array field ⟷ array field)

### 2. Cascade Behavior Detection

Extracts `onDelete` and `onUpdate` behaviors:
- `Cascade` — delete/update related records
- `Restrict` — prevent deletion if related records exist
- `NoAction` — database-level no action
- `SetNull` — set field to null
- `SetDefault` — set field to default value

### 3. Back-Relation Analysis

Automatically identifies reverse relation fields:
- Matches relations by `@relation("Name")` attribute
- Determines if back-relation is array or scalar
- Refines relation type based on bidirectional analysis

### 4. Index Analysis

Extracts:
- `@@index([field1, field2])` — composite indexes
- `@@unique([field1, field2])` — unique constraints
- `@unique` — inline unique fields
- Named indexes with `name: "idx_name"`

### 5. ASCII Diagram Visualization

Generates clear, readable diagrams:
```
User:
  User.bookings 1 ──── * Booking [Cascade] (← user)
  User.reviews 1 ──── * Review [Cascade]
  User.favorites 1 ──── * Favorite [Cascade]

Booking:
  Booking.user? 1 ──── 1 User [Cascade]
  Booking.place 1 ──── 1 Place [Cascade]
  Booking.customer? 1 ──── 1 Customer
```

---

## API

### `parseDbRelations(schemaDir: string): DbRelations`

**Main parser function.** Parses all `.prisma` files in directory.

**Parameters:**
- `schemaDir` — path to Prisma schema directory (e.g., `packages/db/prisma`)

**Returns:**
```typescript
interface DbRelations {
  models: string[];           // All model names
  relations: ModelRelation[]; // All relations
  indexes: ModelIndex[];      // All indexes
}
```

**Example:**
```typescript
import { parseDbRelations } from '@/commands/context/parsers';

const schemaDir = 'packages/db/prisma';
const { models, relations, indexes } = parseDbRelations(schemaDir);

console.log(`Found ${models.length} models`);
console.log(`Found ${relations.length} relations`);
console.log(`Found ${indexes.length} indexes`);
```

---

### `formatDbRelationsAscii(relations: DbRelations, filterModels?: string[]): string`

**Format relations as ASCII diagram.**

**Parameters:**
- `relations` — parsed relations from `parseDbRelations()`
- `filterModels` — optional array of model names to filter (case-insensitive)

**Returns:** ASCII diagram string

**Example:**
```typescript
import { formatDbRelationsAscii, parseDbRelations } from '@/commands/context/parsers';

const relations = parseDbRelations('packages/db/prisma');

// Show all relations
console.log(formatDbRelationsAscii(relations));

// Filter by booking domain
const bookingModels = ['Booking', 'BookingSettings', 'Customer', 'Place', 'User'];
console.log(formatDbRelationsAscii(relations, bookingModels));
```

---

### `getCriticalRelations(relations: DbRelations, coreModels: string[]): ModelRelation[]`

**Extract critical relations** based on:
- Cascade deletes (`onDelete: Cascade`)
- Required relations (non-optional fields)
- Relations to specified core models

**Parameters:**
- `relations` — parsed relations
- `coreModels` — array of core model names

**Returns:** Array of critical `ModelRelation` objects

**Example:**
```typescript
import { getCriticalRelations, parseDbRelations } from '@/commands/context/parsers';

const relations = parseDbRelations('packages/db/prisma');
const critical = getCriticalRelations(relations, ['Booking', 'User', 'Place']);

console.log(`Found ${critical.length} critical relations`);
```

---

### `formatCriticalRelationsAscii(relations: DbRelations, coreModels: string[]): string`

**Format critical relations as ASCII diagram** with warning indicators.

**Parameters:**
- `relations` — parsed relations
- `coreModels` — array of core model names

**Returns:** ASCII diagram with criticality warnings

**Example:**
```typescript
import { formatCriticalRelationsAscii, parseDbRelations } from '@/commands/context/parsers';

const relations = parseDbRelations('packages/db/prisma');
const diagram = formatCriticalRelationsAscii(relations, ['Booking', 'Customer']);

console.log(diagram);
```

**Output:**
```
CRITICAL RELATIONS
============================================================

Focus models: Booking, Customer
Critical relations: 15

Booking:
  Booking.user? 1 ──── 1 User [Cascade]
    ⚠️  cascade delete
  Booking.place 1 ──── 1 Place [Cascade]
    ⚠️  cascade delete, required
  Booking.customer? 1 ──── 1 Customer

Customer:
  Customer.place 1 ──── 1 Place [Cascade]
    ⚠️  cascade delete, required
```

---

## Types

### `ModelRelation`

```typescript
interface ModelRelation {
  from: string;                    // Source model name
  to: string;                      // Target model name
  field: string;                   // Field name in source model
  type: RelationType;              // 'one-to-one' | 'one-to-many' | 'many-to-many'
  onDelete?: CascadeBehavior;      // Cascade behavior on delete
  onUpdate?: CascadeBehavior;      // Cascade behavior on update
  isOptional: boolean;             // Whether field is optional (?)
  backRelationField?: string;      // Field name in target model (reverse)
  backRelationArray?: boolean;     // Whether back relation is array
  relationName?: string;           // @relation("Name") if specified
}
```

### `ModelIndex`

```typescript
interface ModelIndex {
  model: string;       // Model name
  fields: string[];    // Index field names
  unique: boolean;     // Whether it's a unique constraint
  name?: string;       // Index name (if specified)
}
```

### `RelationType`

```typescript
type RelationType = 'one-to-one' | 'one-to-many' | 'many-to-many';
```

### `CascadeBehavior`

```typescript
type CascadeBehavior =
  | 'Cascade'      // Delete/update related records
  | 'Restrict'     // Prevent deletion if related records exist
  | 'NoAction'     // Database-level no action
  | 'SetNull'      // Set field to null
  | 'SetDefault';  // Set field to default value
```

---

## Use Cases

### 1. Context Command Integration

**Provide DB context for features:**

```typescript
import {
  formatCriticalRelationsAscii,
  parseDbRelations,
} from '@/commands/context/parsers';

// In context command
const schemaDir = findSchemaDir(config.projectRoot);
const relations = parseDbRelations(schemaDir);

// For booking feature
if (feature === 'booking') {
  const bookingModels = ['Booking', 'BookingSettings', 'Customer', 'Place'];
  const diagram = formatCriticalRelationsAscii(relations, bookingModels);

  output += `\n<db-relations>\n${diagram}\n</db-relations>\n`;
}
```

### 2. Migration Planning

**Identify cascade impact before schema changes:**

```typescript
const relations = parseDbRelations('packages/db/prisma');
const cascadeDeletes = relations.relations.filter(r => r.onDelete === 'Cascade');

console.log('⚠️  Models with cascade deletes:');
for (const rel of cascadeDeletes) {
  console.log(`  ${rel.from}.${rel.field} → ${rel.to}`);
}
```

### 3. Data Integrity Analysis

**Find required relations and constraints:**

```typescript
const relations = parseDbRelations('packages/db/prisma');
const required = relations.relations.filter(r => !r.isOptional);

console.log('Required relations:');
for (const rel of required) {
  console.log(`  ${rel.from}.${rel.field} → ${rel.to}`);
}
```

### 4. Index Optimization

**Analyze composite indexes:**

```typescript
const relations = parseDbRelations('packages/db/prisma');
const composite = relations.indexes.filter(idx => idx.fields.length > 1);

console.log('Composite indexes:');
for (const idx of composite) {
  const type = idx.unique ? '[UNIQUE]' : '[INDEX]';
  console.log(`  ${idx.model}: ${idx.fields.join(', ')} ${type}`);
}
```

---

## Diagram Legend

```
1 ──── 1   One-to-one relationship
1 ──── *   One-to-many relationship
* ──── *   Many-to-many relationship
?          Optional relation (nullable field)
[Cascade]  onDelete cascade behavior
(← field)  Back-relation field name in target model
```

---

## Implementation Details

### Relation Type Detection Algorithm

1. **Parse field definition:**
   - Check for `@relation(...)` attribute
   - Detect if field is array (`[]`)
   - Detect if field is optional (`?`)

2. **Initial type classification:**
   - Array field → `one-to-many`
   - Scalar field → `one-to-one`

3. **Back-relation matching:**
   - Find reverse relation by `@relation("Name")` or model pairing
   - Refine type based on bidirectional analysis:
     - Array ⟷ Array = `many-to-many`
     - Scalar → Array = `one-to-many` (many-to-one from scalar side)
     - Scalar → Scalar = `one-to-one`

4. **Populate back-relation info:**
   - Set `backRelationField` from matched relation
   - Set `backRelationArray` based on matched relation type

### Multi-File Schema Support

Parses:
- `prisma/schema.prisma` — main schema file
- `prisma/models/*.prisma` — split schema files (monorepo pattern)

Automatically merges models, relations, and indexes from all files.

---

## Performance

- **Fast parsing:** Regex-based extraction (no AST overhead for Prisma files)
- **Efficient filtering:** O(n) filtering with Set-based lookup
- **Memory efficient:** Streams large schemas without loading entire files

**Benchmarks** (large schema: 78 models, 94 relations, 212 indexes):
- Parse: ~5ms
- Format ASCII: ~2ms
- Filter relations: <1ms

---

## Testing

Run test suite:
```bash
npx tsx krolik-cli/test-db-relations.ts
```

**Test coverage:**
- All relations parsing
- Filtered relations (by model)
- Critical relations extraction
- Index analysis
- Cascade delete detection
- Many-to-many detection
- Composite index detection

---

## Future Enhancements

1. **Mermaid ER Diagram Export:**
   ```typescript
   export function formatDbRelationsMermaid(relations: DbRelations): string;
   ```

2. **GraphQL Schema Generation:**
   ```typescript
   export function generateGraphQLSchema(relations: DbRelations): string;
   ```

3. **Circular Dependency Detection:**
   ```typescript
   export function detectCircularDependencies(relations: DbRelations): string[];
   ```

4. **Orphaned Records Detection:**
   ```typescript
   export function detectOrphanRisks(relations: DbRelations): ModelRelation[];
   ```

---

## Examples

### Example 1: Full Database Diagram

```typescript
import { formatDbRelationsAscii, parseDbRelations } from '@/commands/context/parsers';

const relations = parseDbRelations('packages/db/prisma');
console.log(formatDbRelationsAscii(relations));
```

### Example 2: Feature-Specific Relations

```typescript
import { formatDbRelationsAscii, parseDbRelations } from '@/commands/context/parsers';

const relations = parseDbRelations('packages/db/prisma');

// Ticketing domain
const ticketingModels = [
  'Event', 'TicketType', 'TicketOrder', 'Ticket',
  'CheckInList', 'TicketCheckIn', 'User'
];

console.log(formatDbRelationsAscii(relations, ticketingModels));
```

### Example 3: Critical Relations for Safe Deletion

```typescript
import { formatCriticalRelationsAscii, parseDbRelations } from '@/commands/context/parsers';

const relations = parseDbRelations('packages/db/prisma');

// Before deleting Place, check critical relations
console.log(formatCriticalRelationsAscii(relations, ['Place']));
```

---

## Integration with Krolik CLI

### In `context` command:

```typescript
// packages/api/src/commands/context/index.ts

if (options.includeDatabaseRelations) {
  const schemaDir = findSchemaDir(config.projectRoot);
  const relations = parseDbRelations(schemaDir);

  // Get relevant models for feature
  const featureModels = detectFeatureModels(feature);

  const diagram = formatCriticalRelationsAscii(relations, featureModels);

  output += `\n<database-relations>\n${diagram}\n</database-relations>\n`;
}
```

### In `schema` command enhancement:

```typescript
// packages/api/src/commands/schema/index.ts

export async function runSchema(ctx: CommandContext & { options: SchemaOptions }) {
  const { config, logger, options } = ctx;

  const schemaDir = findSchemaDir(config.projectRoot);
  const schemaResult = analyzeSchema(schemaDir);

  // Add relations analysis
  if (options.includeRelations) {
    const relations = parseDbRelations(schemaDir);
    schemaResult.relations = relations;
  }

  // Output...
}
```

---

## See Also

- [Schema Parser](../../../schema/parser.ts) — Prisma model/enum parsing
- [Context Command](../../index.ts) — Feature context generation
- [Schema Command](../../../schema/index.ts) — Schema analysis
