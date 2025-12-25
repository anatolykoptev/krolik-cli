# @swc - Shared SWC AST Infrastructure

> Fast TypeScript/JavaScript parsing with caching and visitor patterns

## Overview

This module provides a centralized, reusable infrastructure for SWC-based AST parsing and analysis. It's designed to be 10-20x faster than ts-morph for syntax-only parsing.

**Key Features:**
- ⚡ Fast parsing using SWC (no type checking)
- 💾 LRU cache to avoid re-parsing files
- 🔍 Generic visitor pattern with typed callbacks
- 📍 Position mapping utilities (byte offset ↔ line/column)
- 🎯 Type-safe interfaces for analysis results

## Quick Start

```typescript
import { parseFile, visitNodeWithCallbacks, getNodeType } from '@/lib/@swc';

// Parse a file (with caching)
const { ast, lineOffsets } = parseFile('src/app.ts', sourceCode);

// Visit specific node types
visitNodeWithCallbacks(ast, {
  onDebuggerStatement: (node, context) => {
    console.log('Found debugger at line', context.path);
  },
  onCallExpression: (node, context) => {
    if (context.isExported) {
      console.log('Exported function call');
    }
  },
});
```

## Architecture

```
@swc/
├── index.ts      # Main exports
├── parser.ts     # parseFile with LRU caching
├── visitor.ts    # Generic visitor pattern
├── types.ts      # Shared TypeScript types
└── README.md     # This file
```

## API Reference

### Parser (`parser.ts`)

#### `parseFile(filePath, content, options?)`

Parse a file with caching. Best for repeated analysis of the same files.

```typescript
const { ast, lineOffsets } = parseFile('src/app.ts', code, {
  syntax: 'typescript',
  tsx: true,
  target: 'es2022',
});
```

**Parameters:**
- `filePath`: Path to file (for cache key and extension detection)
- `content`: Source code string
- `options`: Optional parse options
  - `syntax`: 'typescript' | 'ecmascript' (default: 'typescript')
  - `tsx`: Enable TSX (auto-detected from `.tsx` extension)
  - `jsx`: Enable JSX
  - `target`: ECMAScript target version

**Returns:**
- `ast`: Parsed SWC Module
- `lineOffsets`: Array for position mapping

#### `parseFileUncached(filePath, content, options?)`

Parse without caching. Use for one-off parsing.

#### `validateSyntax(filePath, content, options?)`

Parse and validate syntax, returns success/failure.

```typescript
const result = validateSyntax('test.ts', 'const x = ;');
if (!result.success) {
  console.error('Parse error:', result.error);
}
```

#### `clearCache()`

Clear the AST cache (useful for testing or memory management).

#### `getCacheStats()`

Get cache statistics (size, maxSize).

#### `getNodeSpan(node)`

Extract span (start/end byte offsets) from a node.

#### `getNodeText(node, content)`

Extract text content of a node from source.

### Visitor (`visitor.ts`)

#### `visitNode(node, callback, isExported?, parent?, depth?, path?)`

Low-level visitor for all nodes.

```typescript
visitNode(ast, (node, context) => {
  console.log(
    `[${context.depth}]`,
    getNodeType(node),
    'exported:', context.isExported
  );

  // Return false to stop traversing this branch
  if (getNodeType(node) === 'IfStatement') {
    return false;
  }
});
```

**Callback Parameters:**
- `node`: Current AST node
- `context`: VisitorContext
  - `node`: Current node
  - `parent`: Parent node (if any)
  - `isExported`: Whether in exported declaration
  - `depth`: Depth in AST tree
  - `path`: Array of node types from root

**Callback Return:**
- `void | boolean`: Return `false` to skip children

#### `visitNodeWithCallbacks(node, callbacks)`

High-level visitor with typed callbacks.

```typescript
visitNodeWithCallbacks(ast, {
  onCallExpression: (node, context) => {
    // Handle function calls
  },
  onDebuggerStatement: (node, context) => {
    // Handle debugger statements
  },
  onIdentifier: (node, context) => {
    // Handle identifiers
  },
});
```

**Supported Callbacks:**
- `onNode` - All nodes (fallback)
- `onCallExpression`
- `onIdentifier`
- `onNumericLiteral`
- `onStringLiteral`
- `onTsTypeAnnotation`
- `onDebuggerStatement`
- `onExportDeclaration`
- `onImportDeclaration`
- `onVariableDeclaration`
- `onFunctionDeclaration`
- `onFunctionExpression`
- `onArrowFunctionExpression`

#### `calculateLineOffsets(content)`

Calculate line offsets for position mapping.

```typescript
const offsets = calculateLineOffsets(sourceCode);
```

#### `offsetToPosition(offset, lineOffsets)`

Convert byte offset to line/column (1-indexed).

```typescript
const pos = offsetToPosition(42, lineOffsets);
// { line: 5, column: 10 }
```

#### `getNodeType(node)`

Get type name of a node (e.g., 'CallExpression').

#### `countNodeTypes(node, types)`

Count nodes of specific types.

```typescript
const counts = countNodeTypes(ast, ['CallExpression', 'Identifier']);
console.log('Calls:', counts.get('CallExpression'));
```

#### `findNodesByType(node, type)`

Find all nodes of a specific type.

```typescript
const debuggers = findNodesByType(ast, 'DebuggerStatement');
```

## Usage Examples

### Example 1: Find All Console Logs

```typescript
import { parseFile, visitNodeWithCallbacks, getNodeText } from '@/lib/@swc';

function findConsoleLogs(filePath: string, content: string) {
  const { ast } = parseFile(filePath, content);
  const logs: Array<{ line: number; text: string }> = [];

  visitNodeWithCallbacks(ast, {
    onCallExpression: (node, context) => {
      const callExpr = node as CallExpression;
      const callee = callExpr.callee;

      // Check if it's console.log
      if (
        callee.type === 'MemberExpression' &&
        callee.object.type === 'Identifier' &&
        callee.object.value === 'console'
      ) {
        logs.push({
          line: context.path.length, // approximate
          text: getNodeText(node, content) ?? '',
        });
      }
    },
  });

  return logs;
}
```

### Example 2: Extract Function Information

```typescript
import { parseFile, visitNodeWithCallbacks, getNodeSpan, offsetToPosition } from '@/lib/@swc';
import type { FunctionDeclaration } from '@/lib/@swc';

function extractFunctions(filePath: string, content: string) {
  const { ast, lineOffsets } = parseFile(filePath, content);
  const functions: Array<{ name: string; line: number; async: boolean }> = [];

  visitNodeWithCallbacks(ast, {
    onFunctionDeclaration: (node, context) => {
      const func = node as unknown as FunctionDeclaration;
      const span = getNodeSpan(node);
      const pos = span ? offsetToPosition(span.start, lineOffsets) : { line: 0 };

      functions.push({
        name: func.identifier?.value ?? 'anonymous',
        line: pos.line,
        async: func.async ?? false,
      });
    },
  });

  return functions;
}
```

### Example 3: Migration from Old swc-parser.ts

**Before (old code):**
```typescript
// commands/refactor/analyzers/swc-parser.ts
import { parseSync } from '@swc/core';

function extractFunctionsSwc(filePath: string, content: string) {
  const ast = parseSync(content, {
    syntax: 'typescript',
    tsx: filePath.endsWith('.tsx'),
  });

  const lineOffsets = calculateLineOffsets(content);
  const functions: FunctionInfo[] = [];

  visitNode(ast, (node, isExported) => {
    // ... extraction logic
  });

  return functions;
}
```

**After (using @swc):**
```typescript
// commands/refactor/analyzers/swc-parser.ts
import { parseFile, visitNodeWithCallbacks } from '@/lib/@swc';
import type { FunctionInfo } from '@/lib/@swc';

function extractFunctionsSwc(filePath: string, content: string): FunctionInfo[] {
  const { ast, lineOffsets } = parseFile(filePath, content);
  const functions: FunctionInfo[] = [];

  visitNodeWithCallbacks(ast, {
    onFunctionDeclaration: (node, context) => {
      const info = extractFunctionInfo(node, filePath, content, lineOffsets, context.isExported);
      if (info) functions.push(info);
    },
    onFunctionExpression: (node, context) => {
      const info = extractFunctionInfo(node, filePath, content, lineOffsets, context.isExported);
      if (info) functions.push(info);
    },
    onArrowFunctionExpression: (node, context) => {
      const info = extractFunctionInfo(node, filePath, content, lineOffsets, context.isExported);
      if (info) functions.push(info);
    },
  });

  return functions;
}
```

**Benefits:**
- ✅ Caching for repeated parsing
- ✅ Cleaner callback-based API
- ✅ Type-safe visitor context
- ✅ Reusable across commands

## Performance

- **Parsing**: ~10-20x faster than ts-morph (syntax-only)
- **Caching**: LRU cache with 100 entries (configurable)
- **Memory**: Efficient - old entries are evicted automatically

## Best Practices

1. **Use cached parser** for repeated analysis
   ```typescript
   // ✅ Good - uses cache
   const { ast } = parseFile(path, content);

   // ❌ Avoid - no caching
   const ast = parseFileUncached(path, content);
   ```

2. **Use typed callbacks** for cleaner code
   ```typescript
   // ✅ Good - type-safe callbacks
   visitNodeWithCallbacks(ast, {
     onCallExpression: (node, ctx) => { /* ... */ },
   });

   // ❌ Avoid - manual type checking
   visitNode(ast, (node) => {
     if (getNodeType(node) === 'CallExpression') { /* ... */ }
   });
   ```

3. **Calculate line offsets once**
   ```typescript
   // ✅ Good - parseFile returns lineOffsets
   const { ast, lineOffsets } = parseFile(path, content);

   // ❌ Avoid - recalculating
   const ast = parseFileUncached(path, content);
   const offsets = calculateLineOffsets(content);
   ```

4. **Stop traversal early** when possible
   ```typescript
   visitNode(ast, (node, ctx) => {
     if (foundWhat INeed) {
       return false; // Stop traversing this branch
     }
   });
   ```

## Integration with Krolik CLI

This module is designed to work alongside `@ast` (ts-morph based):

| Module | Use Case | Performance | Type Info |
|--------|----------|-------------|-----------|
| `@ast` | Type-aware analysis, refactoring | Slower | ✅ Full |
| `@swc` | Syntax analysis, linting, quick checks | Faster | ❌ None |

**Recommendation:**
- Use `@swc` for fast syntax checks (console.log, debugger, etc.)
- Use `@ast` when you need type information (unused variables, etc.)

## Extending

To add support for new node types:

1. Add callback to `VisitorCallbacks` in `types.ts`
2. Add case to `getCallbackForType()` in `visitor.ts`
3. Update documentation

## Testing

```typescript
import { parseFile, clearCache } from '@/lib/@swc';

// Clear cache before tests
beforeEach(() => {
  clearCache();
});

test('parses valid TypeScript', () => {
  const result = validateSyntax('test.ts', 'const x = 1;');
  expect(result.success).toBe(true);
});
```

## See Also

- [SWC Documentation](https://swc.rs/)
- [Krolik CLI @ast Module](../\@ast/README.md)
- [Original swc-parser.ts](../../commands/refactor/analyzers/swc-parser.ts)
