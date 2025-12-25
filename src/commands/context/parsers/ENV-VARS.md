# Environment Variables Parser

> SWC AST-based analyzer for environment variable usage and configuration.

## Overview

The `env-vars.ts` parser provides comprehensive analysis of environment variables in your codebase:

- **Detection**: Finds `process.env.VAR_NAME` and `env.VAR_NAME` (t3-env) patterns
- **Parsing**: Reads `.env.example`, `.env.local`, `.env.development`, etc.
- **Analysis**: Identifies required vs optional vars, missing/unused vars
- **Grouping**: Organizes by package/app in monorepo
- **Output**: AI-friendly XML format for context generation

## Features

### 1. Code Analysis (SWC AST)

Accurately detects environment variable usages:

```typescript
// Detected patterns:
const url = process.env.DATABASE_URL;           // process.env pattern
const key = env.NEXT_PUBLIC_API_KEY;           // env pattern (t3-env)
const port = process.env.PORT ?? 3000;         // with default value
const timeout = process.env.TIMEOUT || "30";   // with fallback
```

**Detection includes:**
- ✅ Variable name
- ✅ File path and line number
- ✅ Default value detection (`??` or `||`)
- ✅ Pattern type (`process.env` vs `env`)

### 2. .env File Parsing

Parses all standard .env file formats:

```bash
# Database connection
DATABASE_URL="postgresql://user:pass@localhost/db"

# Redis (optional)
REDIS_URL=""

# API keys
OPENAI_API_KEY=""  # Get from platform.openai.com
```

**Features:**
- ✅ Multi-line comments
- ✅ Empty values detection
- ✅ Quote removal
- ✅ Security: only exposes values from `.env.example` files

### 3. Missing/Unused Detection

**Missing variables** — used in code but not defined:
```
⚠️  DATABASE_URL (used 5x in api/src/lib/db.ts)
⚠️  REDIS_URL (used 2x in api/src/lib/cache.ts)
```

**Unused variables** — defined but never used:
```
ℹ️  LEGACY_API_KEY (.env.example) — can be removed
```

### 4. Package Grouping

Organizes usages by monorepo package:

```
📦 web: 23 usages
  ✓ NEXT_PUBLIC_API_URL (5x)
  ✗ NEXT_PUBLIC_MISSING (2x) — not defined!

📦 api: 15 usages
  ✓ DATABASE_URL (8x)
  ✓ REDIS_URL (3x)
```

## Usage

### Basic Usage

```typescript
import { parseEnvVars, formatEnvVarsXml } from '@/commands/context/parsers';

// Analyze project
const report = parseEnvVars('/path/to/project');

// Access results
console.log('Total usages:', report.usages.length);
console.log('Missing vars:', report.missing);
console.log('Unused vars:', report.unused);

// Group by package
for (const [pkg, usages] of Object.entries(report.byPackage)) {
  console.log(`${pkg}: ${usages.length} usages`);
}

// Generate XML for AI
const xml = formatEnvVarsXml(report);
```

### With Patterns Filter

```typescript
// Only analyze specific files
const report = parseEnvVars('/path/to/project', ['database', 'redis', 'auth']);
```

### In Context Command

```typescript
import { parseEnvVars } from '@/commands/context/parsers';

// Add to context generation
const envReport = parseEnvVars(projectDir);

if (envReport.missing.length > 0) {
  context.warnings.push(
    `Missing env vars: ${envReport.missing.join(', ')}`
  );
}

// Include in XML output
context.sections.push({
  type: 'env-vars',
  content: formatEnvVarsXml(envReport),
});
```

## API Reference

### Types

#### `EnvVarUsage`

```typescript
interface EnvVarUsage {
  name: string;           // Variable name (e.g., 'DATABASE_URL')
  file: string;           // Relative file path
  line: number;           // Line number
  column: number;         // Column number
  hasDefault: boolean;    // Has ?? or || fallback
  defaultValue?: string;  // Default value if detected
  pattern: 'process.env' | 'env';  // Access pattern
}
```

#### `EnvVarDefinition`

```typescript
interface EnvVarDefinition {
  name: string;        // Variable name
  file: string;        // .env file name
  value?: string;      // Value (only from .example files)
  comment?: string;    // Multi-line comment
  isEmpty?: boolean;   // Whether value is empty string
}
```

#### `EnvVarsReport`

```typescript
interface EnvVarsReport {
  usages: EnvVarUsage[];                    // All code usages
  definitions: EnvVarDefinition[];          // All .env definitions
  missing: string[];                        // Used but not defined
  unused: string[];                         // Defined but not used
  byPackage: Record<string, EnvVarUsage[]>; // Grouped by package
}
```

### Functions

#### `parseEnvVars(projectDir, patterns?)`

Analyzes environment variables in project.

**Parameters:**
- `projectDir: string` — Root directory to scan
- `patterns?: string[]` — Optional file name patterns to filter

**Returns:** `EnvVarsReport`

**Example:**
```typescript
const report = parseEnvVars('/Users/dev/myapp');
const filtered = parseEnvVars('/Users/dev/myapp', ['auth', 'database']);
```

#### `formatEnvVarsXml(report)`

Converts report to AI-friendly XML format.

**Parameters:**
- `report: EnvVarsReport` — Analysis report

**Returns:** `string` — XML document

**Example:**
```typescript
const xml = formatEnvVarsXml(report);
console.log(xml);
```

**Output:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<env-vars-report>
  <summary>
    <total-usages>45</total-usages>
    <total-definitions>28</total-definitions>
    <missing-count>3</missing-count>
    <unused-count>5</unused-count>
  </summary>

  <missing-variables>
    <variable name="DATABASE_URL" usage-count="5" />
    <variable name="REDIS_URL" usage-count="2" />
  </missing-variables>

  <usages-by-package>
    <package name="web" count="23">
      <variable name="NEXT_PUBLIC_API_URL" count="5" defined="true">
        <usage file="app/layout.tsx" line="12" pattern="process.env" />
        ...
      </variable>
    </package>
  </usages-by-package>

  <definitions>
    <variable name="DATABASE_URL" used="true">
      <definition file=".env.example" value="postgresql://...">
        <comment>Database connection string</comment>
      </definition>
    </variable>
  </definitions>
</env-vars-report>
```

## Implementation Details

### SWC AST Traversal

Uses `visitNodeWithCallbacks` to traverse the AST:

```typescript
visitNodeWithCallbacks(ast, {
  onMemberExpression: (node) => {
    const member = node as MemberExpression;

    // Detect process.env.VAR_NAME
    if (isProcessEnv(member)) {
      const varName = extractVarName(member);
      const defaultValue = detectDefaultValue(member, content);
      // ...
    }
  },
});
```

### Default Value Detection

Looks ahead in source code for nullish coalescing or logical OR:

```typescript
// Detected patterns:
process.env.PORT ?? 3000           // defaultValue: "3000"
process.env.TIMEOUT || "30"        // defaultValue: "30"
env.BASE_URL ?? "http://localhost" // defaultValue: "http://localhost"
```

Uses regex to match `?? "value"` or `|| "value"` after the variable access.

### Package Detection

Determines package from file path:

```
apps/web/lib/config.ts     → package: "web"
packages/api/src/db.ts     → package: "api"
src/utils/env.ts           → package: "root"
```

### Security

- **Values exposure**: Only shows values from `.env.example` files
- **Sensitive data**: Never exposes `.env.local` or `.env` values
- **XML escaping**: All strings properly escaped for XML output

## Example Output

### Console

```
🔍 Analyzing environment variables...

📊 Summary:
  Total usages: 45
  Total definitions: 28
  Missing variables: 3
  Unused variables: 5

⚠️  Missing variables (used but not defined):
  - DATABASE_URL (used 5x)
    → packages/api/src/lib/db.ts:12
  - REDIS_URL (used 2x)
    → packages/api/src/lib/cache.ts:8

ℹ️  Unused variables (defined but never used):
  - LEGACY_API_KEY (.env.example)
  - OLD_SERVICE_URL (.env.example)

📦 Usage by package:
  web: 23 usages
    ✓ NEXT_PUBLIC_API_URL (5x)
    ✓ NEXT_PUBLIC_MAPS_KEY (3x)
    ✗ MISSING_VAR (2x)
  api: 15 usages
    ✓ DATABASE_URL (8x)
    ✗ REDIS_URL (3x)
  mobile: 7 usages
    ✓ EXPO_PUBLIC_API_URL (7x)

✅ Analysis complete!
```

## Integration with Context Command

Add to `krolik context` output:

```typescript
// In context command handler
const envReport = parseEnvVars(projectDir);

// Add warnings for missing vars
if (envReport.missing.length > 0) {
  logger.warn(`Missing env vars: ${envReport.missing.join(', ')}`);
}

// Include in context XML
const contextXml = `
  <context>
    <env-vars>
      ${formatEnvVarsXml(envReport)}
    </env-vars>
  </context>
`;
```

## Performance

- **SWC AST**: 10-20x faster than regex parsing
- **Caching**: Parsed ASTs are cached by `@/lib/@swc`
- **Selective scanning**: Supports pattern filtering to reduce scope
- **Parallel processing**: Can be extended to process files in parallel

## Limitations

1. **Dynamic access**: Cannot detect `process.env[variable]` (runtime)
2. **Computed keys**: Cannot detect `process.env['PREFIX_' + key]`
3. **Destructuring**: Does not detect `const { DATABASE_URL } = process.env`
4. **Comments**: Only captures comments directly above variable in .env files

## Future Enhancements

- [ ] Detect destructured env vars: `const { DB_URL } = process.env`
- [ ] Support for `.env.${NODE_ENV}` pattern detection
- [ ] Integration with t3-env schema validation
- [ ] Detect required vars from Zod schemas
- [ ] CI/CD check: fail if missing vars detected
- [ ] Auto-generate `.env.example` from code usages

## Testing

Run example script:

```bash
cd krolik-cli
npx tsx src/commands/context/parsers/env-vars.example.ts
```

Expected output shows analysis of the current project.

## See Also

- **SWC Infrastructure**: `src/lib/@swc/README.md`
- **Context Parsers**: `src/commands/context/parsers/README.md`
- **Types Parser**: `types-parser-swc.ts` (similar SWC usage)
- **Zod Parser**: `zod-swc.ts` (method chain detection)
