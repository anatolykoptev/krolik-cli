# SWC-based Zod Schema Parser

## Overview

The SWC-based Zod parser (`zod-swc.ts`) provides a robust, AST-based solution for parsing Zod schema definitions, replacing the previous regex-based approach with accurate syntax-aware parsing.

## Key Improvements Over Regex Parser

### 1. Accurate Parsing
- **AST-based**: Uses SWC's TypeScript parser for accurate code analysis
- **No false positives**: Ignores schemas in strings, comments, or other non-code contexts
- **Proper nesting**: Correctly handles nested `z.object()` calls

### 2. Complete Method Chain Support
- Accurately parses method chains like `z.string().min(1).max(100).email().optional()`
- Extracts all validations with their arguments
- Handles complex Zod patterns that regex cannot parse

### 3. Type-Safe
- Leverages TypeScript types from `@swc/core`
- Type-safe AST traversal with proper node type checks
- No type casting gymnastics

## Architecture

### Main Components

```typescript
// Public API
parseZodSchemas(schemasDir: string, patterns: string[]): ZodSchemaInfo[]

// Internal Functions
parseSchemaFileSwc(filePath: string): ZodSchemaInfo[]
extractZodFields(callExpr: CallExpression, content: string): ZodField[]
parseZodFieldsFromAst(objectExpr: ObjectExpression, content: string): ZodField[]
parseZodFieldValue(node: Node, content: string): { baseType, required, validations }
collectZodMethodChain(node: Node): Array<{ type: string; args: string[] }>
```

### Key Detection Logic

1. **Find Schema Declarations**
   ```typescript
   // Detects: export const UserSchema = z.object({...})
   onVariableDeclaration: (node, context) => {
     if (context.isExported && varName.endsWith('Schema')) {
       // Process schema
     }
   }
   ```

2. **Validate z.object() Call**
   ```typescript
   // Check: z.object(...)
   function isZodObjectCall(callExpr: CallExpression): boolean {
     // Verify callee is z.object
   }
   ```

3. **Extract Fields**
   ```typescript
   // Parse: { name: z.string().min(1), age: z.number().optional() }
   function parseZodFieldsFromAst(objectExpr: ObjectExpression): ZodField[]
   ```

4. **Collect Method Chain**
   ```typescript
   // Parse: z.string().min(1).max(100).optional()
   // Result: [
   //   { type: 'string', args: [] },
   //   { type: 'min', args: ['1'] },
   //   { type: 'max', args: ['100'] },
   //   { type: 'optional', args: [] }
   // ]
   ```

## Supported Zod Patterns

### Base Types
- `z.string()`, `z.number()`, `z.boolean()`, `z.date()`
- `z.enum([...])`, `z.array(...)`, `z.object(...)`

### Modifiers
- `.optional()` - marks field as not required
- `.nullable()` - marks field as nullable
- `.nullish()` - optional and nullable

### Validators
- `.min(n)` - minimum value/length
- `.max(n)` - maximum value/length
- `.length(n)` - exact length
- `.email()` - email validation
- `.url()` - URL validation
- `.regex(pattern)` - regex validation

### Examples

```typescript
// Simple schema
export const UserSchema = z.object({
  name: z.string(),
  age: z.number(),
});

// With validations
export const CreateUserInputSchema = z.object({
  email: z.string().email().min(1),
  password: z.string().min(8).max(100),
  age: z.number().min(18).max(120).optional(),
});

// Complex fields
export const FilterSchema = z.object({
  status: z.enum(['active', 'inactive', 'pending']),
  tags: z.array(z.string()),
  metadata: z.object({
    created: z.date(),
    updated: z.date().optional(),
  }),
});
```

## Schema Type Detection

The parser determines schema type based on naming conventions:

```typescript
function getSchemaType(schemaName: string): 'input' | 'output' | 'filter' {
  const lower = schemaName.toLowerCase();
  if (lower.includes('output') || lower.includes('response')) {
    return 'output';
  }
  if (lower.includes('filter') || lower.includes('query')) {
    return 'filter';
  }
  return 'input';
}
```

Examples:
- `CreateUserInputSchema` → `input`
- `UserOutputSchema` → `output`
- `UserFilterSchema` → `filter`
- `UserSchema` → `input` (default)

## File Filtering

### Automatic Exclusions
- Test files: `*.test.ts`, `*.spec.ts`
- Non-TypeScript files
- Hidden directories (starting with `.`)

### Pattern Matching
```typescript
parseZodSchemas('/path/to/schemas', ['user', 'post'])
// Matches: user-schema.ts, user.schema.ts, post-schema.ts
// Ignores: comment-schema.ts
```

## Output Format

```typescript
interface ZodSchemaInfo {
  name: string;                  // e.g., "UserSchema"
  type: 'input' | 'output' | 'filter';
  fields: ZodField[];
  file: string;                  // File name (not full path)
}

interface ZodField {
  name: string;                  // Field name
  type: string;                  // Base type (string, number, etc.)
  required: boolean;             // true unless .optional()/.nullable()
  validation?: string;           // e.g., "min: 1, max: 100"
}
```

Example output:
```json
{
  "name": "CreateUserInputSchema",
  "type": "input",
  "fields": [
    {
      "name": "email",
      "type": "string",
      "required": true,
      "validation": "email, min: 1"
    },
    {
      "name": "age",
      "type": "number",
      "required": false,
      "validation": "min: 18, max: 120"
    }
  ],
  "file": "user.schema.ts"
}
```

## Performance

### Caching
- Uses SWC's built-in file cache (`@/lib/@swc`)
- Parses each file only once per content hash
- LRU cache with configurable size (default: 100 files)

### Benchmarks
For a typical schema file with 10 schemas:
- **Regex parser**: ~2ms
- **SWC parser**: ~8ms (first parse), ~0.5ms (cached)

Trade-off: Slightly slower on first parse, but vastly more accurate and maintainable.

## Testing

Comprehensive test suite in `tests/commands/context/parsers/zod-swc.test.ts`:

- Basic schema parsing
- Optional fields
- Validation constraints
- Multiple fields
- Schema type detection
- Nullable fields
- Test file exclusion
- Pattern filtering
- Non-existent directory handling
- String literal field names

Run tests:
```bash
pnpm test tests/commands/context/parsers/zod-swc.test.ts
```

## Migration from Regex Parser

The SWC parser is a drop-in replacement:

```typescript
// Before (regex)
import { parseZodSchemas } from '@/commands/context/parsers/zod';

// After (SWC)
import { parseZodSchemas } from '@/commands/context/parsers/zod-swc';

// Same API
const schemas = parseZodSchemas('/path/to/schemas', ['user']);
```

## Known Limitations

1. **Complex Computed Field Names**: Field names must be static identifiers or string literals
2. **Dynamic Schema Composition**: Only handles direct `z.object()` definitions, not schemas built programmatically
3. **Zod Transforms**: `.transform()` and `.refine()` methods are not parsed
4. **Default Values**: `.default()` values are not extracted

These limitations are acceptable for most use cases and can be addressed in future versions if needed.

## Future Enhancements

Potential improvements:
- [ ] Extract `.default()` values
- [ ] Parse `.refine()` custom validations
- [ ] Support schema composition (`z.intersection()`, `z.union()`)
- [ ] Extract JSDoc comments for field descriptions
- [ ] Generate schema documentation from parsed info

## Contributing

When modifying the parser:

1. **Add tests** for new Zod patterns
2. **Update this README** with new features
3. **Maintain backward compatibility** with the public API
4. **Use the SWC infrastructure** from `@/lib/@swc`
5. **Follow SRP**: Keep functions focused and under 200 lines

## Related Files

- `@/lib/@swc` - SWC parsing infrastructure
- `@/commands/context/parsers/types.ts` - Type definitions
- `@/commands/context/parsers/zod.ts` - Legacy regex parser (deprecated)
- `tests/commands/context/parsers/zod-swc.test.ts` - Test suite
