# @swc Quick Start Guide

> Get up and running with SWC AST parsing in 5 minutes

## Installation

Already installed! `@swc/core` is part of Krolik CLI dependencies.

## Import

```typescript
import {
  parseFile,
  visitNodeWithCallbacks,
  getNodeType,
  getNodeSpan,
  offsetToPosition,
} from '@/lib/@swc';
```

## Parse a File

```typescript
// Cached parsing (recommended)
const { ast, lineOffsets } = parseFile('src/app.ts', sourceCode);

// One-off parsing
const ast = parseFileUncached('src/temp.ts', code);

// Validate syntax
const result = validateSyntax('src/test.ts', code);
if (!result.success) {
  console.error('Parse error:', result.error);
}
```

## Visit Nodes

### Type-safe callbacks (recommended)

```typescript
visitNodeWithCallbacks(ast, {
  onDebuggerStatement: (node, context) => {
    console.log('Found debugger at depth', context.depth);
  },
  onCallExpression: (node, context) => {
    if (context.isExported) {
      console.log('Exported call');
    }
  },
});
```

### Generic visitor (advanced)

```typescript
visitNode(ast, (node, context) => {
  console.log(getNodeType(node), 'exported:', context.isExported);

  // Stop traversing this branch
  if (getNodeType(node) === 'IfStatement') {
    return false;
  }
});
```

## Common Patterns

### Find All Debugger Statements

```typescript
function findDebuggers(filePath: string, content: string) {
  const { ast, lineOffsets } = parseFile(filePath, content);
  const results: Array<{ line: number }> = [];

  visitNodeWithCallbacks(ast, {
    onDebuggerStatement: (node) => {
      const span = getNodeSpan(node);
      if (span) {
        const pos = offsetToPosition(span.start, lineOffsets);
        results.push({ line: pos.line });
      }
    },
  });

  return results;
}
```

### Find Console Logs

```typescript
function findConsoleLogs(filePath: string, content: string) {
  const { ast } = parseFile(filePath, content);
  const logs: string[] = [];

  visitNodeWithCallbacks(ast, {
    onCallExpression: (node) => {
      const call = node as unknown as CallExpression;
      const callee = call.callee;

      if (
        callee.type === 'MemberExpression' &&
        callee.object.type === 'Identifier' &&
        callee.object.value === 'console'
      ) {
        logs.push(getNodeText(node, content) ?? '');
      }
    },
  });

  return logs;
}
```

### Count Node Types

```typescript
const { ast } = parseFile('src/app.ts', code);

const counts = countNodeTypes(ast, [
  'FunctionDeclaration',
  'CallExpression',
  'IfStatement',
]);

console.log('Functions:', counts.get('FunctionDeclaration'));
console.log('Calls:', counts.get('CallExpression'));
console.log('If statements:', counts.get('IfStatement'));
```

### Find All Functions

```typescript
const { ast } = parseFile('src/app.ts', code);

const declarations = findNodesByType(ast, 'FunctionDeclaration');
const expressions = findNodesByType(ast, 'FunctionExpression');
const arrows = findNodesByType(ast, 'ArrowFunctionExpression');

console.log('Total functions:', declarations.length + expressions.length + arrows.length);
```

## Available Callbacks

| Callback | Node Type | Use Case |
|----------|-----------|----------|
| `onNode` | All nodes | Fallback |
| `onCallExpression` | Function calls | Find calls, console.log |
| `onIdentifier` | Identifiers | Variable usage |
| `onNumericLiteral` | Numbers | Magic numbers |
| `onStringLiteral` | Strings | i18n, hardcoded text |
| `onDebuggerStatement` | Debugger | Lint check |
| `onFunctionDeclaration` | Functions | Extract functions |
| `onFunctionExpression` | Function exprs | Extract functions |
| `onArrowFunctionExpression` | Arrow functions | Extract functions |
| `onExportDeclaration` | Exports | Track exports |
| `onImportDeclaration` | Imports | Dependency analysis |
| `onVariableDeclaration` | Variables | Variable tracking |
| `onTsTypeAnnotation` | Type annotations | Type analysis |

## Context Object

```typescript
visitNodeWithCallbacks(ast, {
  onNode: (node, context) => {
    console.log({
      type: getNodeType(node),
      isExported: context.isExported,  // In export declaration?
      depth: context.depth,             // Depth in AST
      path: context.path,               // Path from root
      parent: context.parent,           // Parent node
    });
  },
});
```

## Utilities

```typescript
// Get node type
const type = getNodeType(node); // 'CallExpression'

// Get node span (byte offsets)
const span = getNodeSpan(node); // { start: 42, end: 100 }

// Get node text
const text = getNodeText(node, content); // 'console.log("hello")'

// Convert offset to position
const pos = offsetToPosition(42, lineOffsets); // { line: 5, column: 10 }

// Calculate line offsets
const lineOffsets = calculateLineOffsets(content);
```

## Cache Management

```typescript
// Get cache stats
const stats = getCacheStats(); // { size: 42, maxSize: 100 }

// Clear cache
clearCache();
```

## Type Casting

SWC types often need explicit casting:

```typescript
visitNodeWithCallbacks(ast, {
  onCallExpression: (node) => {
    // Cast to specific type
    const call = node as unknown as CallExpression;

    // Access properties
    console.log(call.callee.type);
  },
});
```

## Performance Tips

1. **Use caching** - `parseFile()` instead of `parseFileUncached()`
2. **Stop early** - Return `false` from visitor to skip branches
3. **Use typed callbacks** - More efficient than checking types manually
4. **Reuse lineOffsets** - Calculate once per file
5. **Clear cache** - Between major operations if memory constrained

## Common Mistakes

❌ **Forgetting to cast types**
```typescript
const func = node; // Node type
const name = func.identifier.value; // Error!
```

✅ **Proper casting**
```typescript
const func = node as unknown as FunctionDeclaration;
const name = func.identifier?.value;
```

❌ **Not checking for undefined**
```typescript
const span = getNodeSpan(node);
const pos = offsetToPosition(span.start, lineOffsets); // Error if span is null
```

✅ **Checking first**
```typescript
const span = getNodeSpan(node);
if (span) {
  const pos = offsetToPosition(span.start, lineOffsets);
}
```

## Full Example

```typescript
import {
  parseFile,
  visitNodeWithCallbacks,
  getNodeSpan,
  getNodeText,
  offsetToPosition,
} from '@/lib/@swc';
import type { CallExpression } from '@/lib/@swc';

export function analyzeFile(filePath: string, content: string) {
  const { ast, lineOffsets } = parseFile(filePath, content);

  const report = {
    debuggers: 0,
    consoleLogs: 0,
    functions: 0,
  };

  visitNodeWithCallbacks(ast, {
    onDebuggerStatement: () => {
      report.debuggers++;
    },

    onCallExpression: (node) => {
      const call = node as unknown as CallExpression;
      if (
        call.callee.type === 'MemberExpression' &&
        call.callee.object.type === 'Identifier' &&
        call.callee.object.value === 'console'
      ) {
        report.consoleLogs++;
      }
    },

    onFunctionDeclaration: () => {
      report.functions++;
    },

    onArrowFunctionExpression: () => {
      report.functions++;
    },
  });

  return report;
}
```

## Next Steps

- Read [README.md](./README.md) for complete API docs
- See [example.ts](./example.ts) for 10 practical examples
- Check [MIGRATION.md](./MIGRATION.md) for migration guide
- Review [OVERVIEW.md](./OVERVIEW.md) for module summary
