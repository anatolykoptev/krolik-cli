# API Contracts Parser

## Overview

The `api-contracts.ts` parser extracts complete tRPC API contracts from router files, providing comprehensive procedure information including types, protection levels, and input/output schemas.

## Features

### What It Extracts

1. **Procedure Information**
   - Name and type (query/mutation/subscription)
   - Protection level (public/protected/admin/rate-limited)
   - Rate limiting configuration

2. **Input Schemas**
   - Named schemas (e.g., `CreateEventSchema`)
   - Inline `z.object()` definitions with full field details
   - Field types, validation rules, required/optional status
   - Default values

3. **Output Schemas**
   - Named schemas
   - Array types (e.g., `EventSchema[]`)
   - Inline schemas
   - Inferred return types

4. **Router Structure**
   - Sub-router relationships
   - Procedure counts
   - File organization

## Usage

### Basic Usage

```typescript
import { parseApiContracts, formatApiContractsXml } from './api-contracts';

const routersDir = 'packages/api/src/routers';
const contracts = parseApiContracts(routersDir, []);

console.log(`Found ${contracts.length} routers`);
for (const contract of contracts) {
  console.log(`${contract.name}: ${contract.procedures.length} procedures`);
}
```

### With Filtering

```typescript
// Only parse routers matching patterns
const contracts = parseApiContracts(routersDir, ['booking', 'event']);
```

### XML Output for AI Context

```typescript
const xml = formatApiContractsXml(contracts);
// Produces structured XML for AI consumption
```

## Output Format

### RouterContract

```typescript
interface RouterContract {
  name: string;           // Router name (e.g., 'bookingsRouter')
  path: string;           // Relative path (e.g., 'bookings.ts')
  procedures: ProcedureContract[];
  subRouters: string[];   // Merged sub-routers
}
```

### ProcedureContract

```typescript
interface ProcedureContract {
  name: string;
  type: 'query' | 'mutation' | 'subscription' | 'unknown';
  protection: 'public' | 'protected' | 'admin' | 'rate-limited';
  rateLimit?: {
    bucket: string;       // e.g., 'auth', 'booking'
    max?: number;
    windowMs?: number;
  };
  input?: InputContract;
  output?: OutputContract;
}
```

### Example Output

```xml
<api-contracts>
  <router name="integrationsRouter" path="integrations.ts">
    <procedures count="12">
      <procedure name="getManifest" type="query" protection="protected">
        <input schema="inline">
          <field name="integrationId" type="string" required="true" validation="min:1" />
        </input>
      </procedure>
      <procedure name="install" type="mutation" protection="protected">
        <input schema="InstallIntegrationSchema" />
      </procedure>
    </procedures>
  </router>
</api-contracts>
```

## Implementation Details

### Parsing Strategy

1. **Router Detection**
   - Uses regex to find `router({ ... })` or `createTRPCRouter({ ... })`
   - Extracts router body using brace matching

2. **Procedure Extraction**
   - Matches pattern: `procedureName: xxxProcedure...`
   - Avoids false positives from schema object properties
   - Handles multi-line procedure definitions

3. **Schema Parsing**
   - Detects named schema references
   - Extracts inline `z.object()` fields with full details
   - Parses Zod validation chains (min, max, email, etc.)

### Field Extraction

For inline schemas, the parser extracts:
- Base type (string, number, boolean, etc.)
- Required/optional status
- Validation rules (min, max, email, url, uuid, etc.)
- Default values
- Enum values
- Array types

### Performance

- Regex-based parsing (fast, no AST overhead for this use case)
- Handles large router files efficiently
- Processes entire `packages/api/src/routers` in < 1 second

## Integration with krolik context

The parser is designed to be used by the `krolik context` command to provide API contract information when generating task context.

### Usage in context Command

```typescript
import { parseApiContracts, formatApiContractsXml } from './parsers/api-contracts';

// In context command:
const apiDir = path.join(projectRoot, 'packages/api/src/routers');
const contracts = parseApiContracts(apiDir, [featureName]);
const xml = formatApiContractsXml(contracts);

// Include in context output
contextOutput += xml;
```

## Limitations

1. **Complex Schemas**: Only parses inline `z.object()` schemas. Referenced schemas show name only.
2. **Dynamic Procedures**: Cannot parse dynamically generated procedures.
3. **Validation Details**: Extracts common validators but may miss custom refinements.

## Future Enhancements

Potential improvements:
- Resolve referenced schemas by parsing schema files
- Extract JSDoc comments for procedures
- Detect deprecated procedures
- Cross-reference with Prisma models
- Generate OpenAPI spec from contracts

## Testing

Create a test file to verify parsing:

```typescript
import { parseApiContracts } from './api-contracts';

const contracts = parseApiContracts('path/to/routers', []);
console.log(JSON.stringify(contracts, null, 2));
```

Expected results:
- All routers detected
- Procedures correctly identified
- Input/output schemas extracted
- Protection levels accurate
- Rate limiting detected
