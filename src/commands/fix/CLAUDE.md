# Autofixer Development Guide

> Writing safe, reliable code fixers using AST-based transformations

---

## Overview

Autofixer transforms code to fix quality issues detected by `krolik quality`.

**Tech Stack:**
- **ts-morph** — TypeScript Compiler API wrapper (primary)
- **jscodeshift** — Facebook's codemod toolkit (alternative)
- **Prettier** — Code formatting
- **Biome** — Fast linter/formatter (auto-runs if available)

```
strategies/
├── shared/           # Shared utilities (DRY)
│   ├── line-utils.ts     # Line extraction
│   ├── pattern-utils.ts  # Pattern matching
│   ├── formatting.ts     # Prettier + validation + AST checks
│   ├── operations.ts     # FixOperation factories
│   ├── typescript.ts     # TypeScript tsc integration (AI-friendly output)
│   └── biome.ts          # Biome linter/formatter integration
├── lint/             # console, debugger, alert
├── type-safety/      # @ts-ignore, any
├── complexity/       # Nesting, long functions
├── srp/              # File splitting
└── hardcoded/        # Magic numbers, URLs
```

---

## TypeScript Integration

**TypeScript type check runs first** if detected in the project (via `tsconfig.json`).

### CLI Options

```bash
krolik fix                    # Run tsc + Biome + custom fixes
krolik fix --typecheck        # Same (explicit)
krolik fix --typecheck-only   # Only run type check
krolik fix --no-typecheck     # Skip TypeScript check
krolik fix --typecheck-format=json  # Output format (json, xml, text)
```

### Output Formats for AI

**JSON format** (default, best for AI parsing):

```json
{
  "success": false,
  "summary": {
    "errors": 3,
    "warnings": 1,
    "total": 4,
    "duration_ms": 1250,
    "tsc_version": "5.7.2"
  },
  "diagnostics": [
    {
      "file": "src/index.ts",
      "location": "42:5",
      "code": "TS2322",
      "severity": "error",
      "message": "Type 'string' is not assignable to type 'number'."
    }
  ]
}
```

**XML format** (alternative structured format):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<typescript-check>
  <summary success="false">
    <errors>3</errors>
    <warnings>1</warnings>
  </summary>
  <diagnostics>
    <diagnostic severity="error">
      <file>src/index.ts</file>
      <line>42</line>
      <code>TS2322</code>
      <message>Type 'string' is not assignable to type 'number'.</message>
    </diagnostic>
  </diagnostics>
</typescript-check>
```

### TypeScript API (shared/typescript.ts)

```typescript
import {
  // Detection
  isTscAvailable,    // Check if tsc is installed
  hasTsConfig,       // Check for tsconfig.json
  getTscVersion,     // Get installed version

  // Type checking
  runTypeCheck,      // Run tsc --noEmit

  // Output formatters
  formatAsJson,      // JSON for AI parsing
  formatAsXml,       // XML structured format
  formatAsText,      // Human-readable text
  getSummaryLine,    // One-line summary
} from './strategies/shared';
```

### Pipeline Order

1. **TypeScript check** → Shows errors for AI to fix
2. **Biome auto-fix** → Fixes lint/format issues
3. **Custom strategies** → AST-based fixes

---

## Biome Integration

**Biome runs automatically** if detected in the project (via `biome.json`).

### CLI Options

```bash
krolik fix                # Run Biome + custom fixes
krolik fix --biome        # Same (explicit)
krolik fix --biome-only   # Only run Biome, skip custom fixes
krolik fix --no-biome     # Skip Biome, run only custom fixes
```

### How it works

1. **Detection**: Checks for `node_modules/.bin/biome` or global `biome`
2. **Config**: Requires `biome.json` or `biome.jsonc` in project root
3. **Execution**: Runs `biome check --apply` (lint + format + organize imports)
4. **Pipeline**: Biome runs BEFORE custom strategies

### Biome API (shared/biome.ts)

```typescript
import {
  // Detection
  isBiomeAvailable,    // Check if Biome is installed
  hasBiomeConfig,      // Check for biome.json
  getBiomeVersion,     // Get installed version

  // Auto-fix (all safe fixes)
  biomeAutoFix,        // biome check --apply
  biomeFixFile,        // Fix single file

  // Specific operations
  biomeLint,           // Lint only (diagnostics)
  biomeLintFix,        // Lint with auto-fix
  biomeFormat,         // Format only
  biomeOrganizeImports, // Organize imports only

  // Utilities
  shouldBiomeProcess,  // Check file extension
  biomeCheckFile,      // Check single file
} from './strategies/shared';
```

### Why Biome first?

1. **Speed**: Biome is 10-100x faster than ESLint
2. **Coverage**: Handles common lint issues (console, unused vars, etc.)
3. **Consistency**: Formats code before custom AST transforms
4. **Less work**: Fewer issues for custom strategies to handle

---

## ts-morph vs jscodeshift

| Feature | ts-morph | jscodeshift |
|---------|----------|-------------|
| **TypeScript support** | Native | Via parser option |
| **API style** | Object-oriented | Functional/jQuery-like |
| **Type information** | Full TypeScript types | None |
| **Learning curve** | Moderate | Easier for simple transforms |
| **Performance** | Good | Faster for bulk operations |
| **Best for** | TS analysis + transforms | Pure JS codemods |

### When to use ts-morph (our default)

```typescript
// ✅ Type-aware analysis
const func = sourceFile.getFunction('handler');
const returnType = func?.getReturnType().getText();

// ✅ Navigate type hierarchy
const implementations = interface.getImplementations();

// ✅ Full compiler diagnostics
const errors = sourceFile.getPreEmitDiagnostics();
```

### When to consider jscodeshift

```typescript
// ✅ Simple pattern replacements at scale
// jscodeshift -t transform.js src/**/*.js

export default function transformer(file, api) {
  const j = api.jscodeshift;

  return j(file.source)
    .find(j.CallExpression, {
      callee: { object: { name: 'console' } }
    })
    .remove()
    .toSource();
}
```

**Use jscodeshift when:**
- Running codemods across 1000+ files
- Simple pattern-based replacements
- No type information needed
- One-time migrations

**Use ts-morph when:**
- Need TypeScript type information
- Complex multi-step transformations
- Validation of generated code
- Integration with existing TS tooling

---

## Rule 1: ALWAYS Use AST, Never Regex

**Why:** Regex matches text inside strings, comments, and other invalid contexts.

```typescript
// ❌ WRONG: Regex-based detection
function hasDebugger(code: string): boolean {
  return /\bdebugger\b/.test(code);
}
// Matches: "debugger" in strings, /debugger/ in regex, comments

// ✅ CORRECT: AST-based detection
function hasDebugger(content: string, line: number): boolean {
  const project = createProject();
  const sourceFile = project.createSourceFile('temp.ts', content);

  return sourceFile
    .getDescendantsOfKind(SyntaxKind.DebuggerStatement)
    .some(stmt => stmt.getStartLineNumber() === line);
}
// Only matches actual debugger statements in executable code
```

**Common AST patterns:**

| Target | SyntaxKind | Method |
|--------|------------|--------|
| `debugger;` | `DebuggerStatement` | `getDescendantsOfKind()` |
| `console.log()` | `CallExpression` | Check expression text |
| `42` | `NumericLiteral` | `getLiteralValue()` |
| `"url"` | `StringLiteral` | `getLiteralValue()` |
| `function foo()` | `FunctionDeclaration` | `getFunctions()` |
| `if (x) {}` | `IfStatement` | `getThenStatement()` |
| `const x = 1` | `VariableDeclaration` | `getVariableDeclarations()` |

---

## Rule 2: Use Shared Utilities

**Don't duplicate code** — use the shared module:

```typescript
import {
  // Line utilities
  getLineContext,        // Get line content + metadata
  lineStartsWith,        // Check line prefix
  lineEndsWith,          // Check line suffix

  // Pattern utilities
  extractNumber,         // Extract number from message
  matchNumberInRange,    // Check if number in range
  containsKeyword,       // Case-insensitive keyword check

  // AST checks
  hasDebuggerStatementAtLine,  // Real debugger statement?
  hasConsoleCallAtLine,        // Real console call?
  hasAlertCallAtLine,          // Real alert call?

  // Fix operations
  createDeleteLine,      // Delete a line
  createReplaceLine,     // Replace line content
  createFullFileReplace, // Replace entire file
  createSplitFile,       // Split into multiple files

  // Formatting
  validateSyntax,        // Check syntax validity
  validateAndFormat,     // Validate syntax + Prettier
} from '../shared';
```

---

## Rule 3: Strategy Structure

Every strategy follows this pattern:

```typescript
// strategies/[category]/index.ts

import type { QualityIssue } from '../../../quality/types';
import type { FixOperation, FixStrategy } from '../../types';

export const myStrategy: FixStrategy = {
  // Which issue categories this handles
  categories: ['my-category'],

  // Can this issue be fixed?
  canFix(issue: QualityIssue, content: string): boolean {
    // 1. Check message patterns
    if (!containsKeyword(issue.message, ['pattern1', 'pattern2'])) {
      return false;
    }

    // 2. Check thresholds
    if (!matchNumberInRange(issue.message, /(\d+)/, { min: 10, max: 100 })) {
      return false;
    }

    return true;
  },

  // Generate the fix operation
  async generateFix(issue: QualityIssue, content: string): Promise<FixOperation | null> {
    const { file, line, message } = issue;
    if (!file || !line) return null;

    try {
      // 1. AST-based detection
      if (!hasRealProblemAtLine(content, line)) {
        return null;
      }

      // 2. Generate fix
      const result = applyASTTransformation(content, file, line);
      if (!result.success) return null;

      // 3. Validate and format
      const validated = await validateAndFormat(result.newCode, file);
      if (!validated) return null;

      // 4. Return operation
      return createFullFileReplace(file, content, validated);
    } catch {
      return null; // Fail safely
    }
  },
};
```

---

## Rule 4: Split into Modules

For complex strategies, split by responsibility:

```
strategies/complexity/
├── index.ts           # Main strategy export
├── patterns.ts        # Constants, thresholds
├── helpers.ts         # Utility functions
├── nesting-fix.ts     # Early return transforms
├── complexity-fix.ts  # If-chain transforms
└── long-function-fix.ts # Block extraction
```

**Module template:**

```typescript
// patterns.ts - Constants only
export const PATTERNS = {
  NESTING: /nesting depth/i,
  COMPLEXITY: /has\s+complexity\s+(\d+)/i,
} as const;

export const THRESHOLDS = {
  COMPLEXITY: { min: 10, max: 120 },
} as const;
```

```typescript
// helpers.ts - Pure utility functions
export function findFunctionEnd(content: string, startLine: number): number {
  // Implementation
}

export function generateFunctionName(content: string): string {
  // Implementation
}
```

```typescript
// nesting-fix.ts - Single fix generator
import { reduceNesting } from '../../ast-utils';
import { createFullFileReplace } from '../shared';

export function generateNestingFix(
  content: string,
  file: string,
  targetLine?: number,
): FixOperation | null {
  const result = reduceNesting(content, file, targetLine);

  if (!result.success || !result.newContent) {
    return null;
  }

  return createFullFileReplace(file, content, result.newContent);
}
```

---

## Rule 5: AST Best Practices

### 1. Use in-memory file system

```typescript
const project = new Project({
  useInMemoryFileSystem: true,  // Fast, no disk I/O
  compilerOptions: {
    allowJs: true,
    checkJs: false,
  },
});
```

### 2. Find nodes efficiently

```typescript
// Get all nodes of a type
const ifStatements = sourceFile.getDescendantsOfKind(SyntaxKind.IfStatement);

// Get specific node
const func = sourceFile.getFunction('myFunction');

// Traverse ancestors
function findAncestor(node: Node, predicate: (p: Node) => boolean): Node | null {
  let parent = node.getParent();
  while (parent) {
    if (predicate(parent)) return parent;
    parent = parent.getParent();
  }
  return null;
}
```

### 3. Check context

```typescript
// Is inside a type definition?
function isInsideType(node: Node): boolean {
  const typeKinds = new Set([
    SyntaxKind.InterfaceDeclaration,
    SyntaxKind.TypeAliasDeclaration,
    SyntaxKind.EnumDeclaration,
  ]);
  return hasAncestor(node, p => typeKinds.has(p.getKind()));
}

// Is inside a const object literal (mapping)?
function isInsideConstObjectLiteral(node: NumericLiteral): boolean {
  const objLiteral = findAncestor(node,
    p => p.getKind() === SyntaxKind.ObjectLiteralExpression);
  if (!objLiteral) return false;

  // Check if assigned to CONST_CASE variable
  const varDecl = findAncestor(objLiteral,
    p => p.getKind() === SyntaxKind.VariableDeclaration);
  if (varDecl) {
    const name = varDecl.asKind(SyntaxKind.VariableDeclaration)?.getName();
    return /^[A-Z][A-Z0-9_]*$/.test(name || '');
  }
  return false;
}
```

### 4. Transform safely

```typescript
// Replace ALL occurrences (from last to first to preserve positions)
const candidates = sourceFile
  .getDescendantsOfKind(SyntaxKind.NumericLiteral)
  .filter(n => n.getLiteralValue() === targetValue);

// Replace from end to start
for (let i = candidates.length - 1; i >= 0; i--) {
  candidates[i].replaceWithText(constName);
}
```

---

## Rule 6: Validation Pipeline

**Always validate before returning:**

```typescript
async generateFix(issue, content): Promise<FixOperation | null> {
  try {
    // 1. Generate transformation
    const newCode = transform(content);

    // 2. Validate syntax (catches broken transformations)
    if (!validateSyntax(newCode, issue.file)) {
      return null;
    }

    // 3. Format with Prettier (consistent output)
    const formatted = await formatWithPrettier(newCode, issue.file);

    // 4. Check it's not a no-op
    if (formatted === content) {
      return null;
    }

    return createFullFileReplace(issue.file, content, formatted);
  } catch {
    return null; // Fail safely
  }
}
```

---

## Rule 7: Testing Fixers

**Test file structure:**

```typescript
// __tests__/strategies/lint.test.ts
import { describe, it, expect } from 'vitest';
import { lintStrategy } from '../strategies/lint';

describe('lintStrategy', () => {
  describe('canFix', () => {
    it('returns true for debugger message', () => {
      const issue = { message: 'Unexpected debugger statement', ... };
      expect(lintStrategy.canFix(issue, '')).toBe(true);
    });

    it('returns false for debugger in regex', () => {
      const content = 'const pattern = /debugger/;';
      const issue = { message: 'debugger', line: 1, ... };
      expect(lintStrategy.canFix(issue, content)).toBe(false);
    });
  });

  describe('generateFix', () => {
    it('removes standalone debugger', async () => {
      const content = 'function test() {\n  debugger;\n  return 1;\n}';
      const issue = { message: 'debugger', line: 2, file: 'test.ts', ... };

      const fix = await lintStrategy.generateFix(issue, content);

      expect(fix).not.toBeNull();
      expect(fix.action).toBe('delete-line');
    });
  });
});
```

---

## Common Patterns

### 1. Extract constant from magic number

```typescript
// Before
const timeout = 3600;

// After
const TIMEOUT_SECONDS = 3600;
const timeout = TIMEOUT_SECONDS;
```

### 2. Remove debugger

```typescript
// Before
function test() {
  debugger;
  return value;
}

// After
function test() {
  return value;
}
```

### 3. Early return for nesting

```typescript
// Before
function process(x) {
  if (x) {
    if (x.value) {
      doSomething(x.value);
    }
  }
}

// After
function process(x) {
  if (!x) return;
  if (!x.value) return;
  doSomething(x.value);
}
```

### 4. Replace any with unknown

```typescript
// Before
function parse(data: any): Result {}

// After
function parse(data: unknown): Result {}
```

---

## Checklist for New Fixer

- [ ] Uses AST (not regex) for code detection
- [ ] Uses shared utilities from `../shared`
- [ ] Has `canFix()` that checks thresholds
- [ ] Has `generateFix()` that returns null on failure
- [ ] Validates syntax before returning
- [ ] Formats with Prettier
- [ ] Handles edge cases (no file, no line)
- [ ] Has try-catch for safety
- [ ] Split into modules if > 150 lines
- [ ] Has unit tests

---

## jscodeshift Examples

For reference, here's how common transforms look in jscodeshift:

### Remove console.log

```javascript
// transform-console.js
module.exports = function(fileInfo, api) {
  const j = api.jscodeshift;

  return j(fileInfo.source)
    .find(j.CallExpression, {
      callee: {
        type: 'MemberExpression',
        object: { name: 'console' }
      }
    })
    .remove()
    .toSource();
};

// Usage: jscodeshift -t transform-console.js src/**/*.js
```

### Rename imports

```javascript
// transform-import.js
module.exports = function(fileInfo, api) {
  const j = api.jscodeshift;

  return j(fileInfo.source)
    .find(j.ImportDeclaration, {
      source: { value: 'old-package' }
    })
    .forEach(path => {
      path.node.source.value = 'new-package';
    })
    .toSource();
};
```

### Add TypeScript type

```javascript
// transform-add-type.js
module.exports = function(fileInfo, api) {
  const j = api.jscodeshift;

  return j(fileInfo.source)
    .find(j.FunctionDeclaration)
    .filter(path => !path.node.returnType)
    .forEach(path => {
      // Add : void return type
      path.node.returnType = j.tsTypeAnnotation(
        j.tsVoidKeyword()
      );
    })
    .toSource();
};
```

---

*Last updated: 2025-12-22*
