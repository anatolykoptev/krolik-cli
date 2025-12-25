# SWC Extractors

> Reusable utility functions for extracting information from SWC AST nodes

## Overview

The `extractors.ts` module provides pure, side-effect-free functions for common AST extraction patterns. These utilities handle edge cases gracefully by returning `null` instead of throwing errors.

## Key Functions

### Call Expression Analysis

#### `getCalleeName(node: CallExpression): string | null`

Extract the function name from a call expression.

```typescript
import { getCalleeName } from '@/lib/@swc/extractors';

// Simple call: register()
getCalleeName(callNode) // → 'register'

// Method call: form.register()
getCalleeName(callNode) // → 'register'

// Chained call: z.string()
getCalleeName(callNode) // → 'string'
```

#### `getCalleeObjectName(node: CallExpression): string | null`

Extract the root object name from a method call.

```typescript
// Simple method: z.string()
getCalleeObjectName(callNode) // → 'z'

// Nested method: console.log()
getCalleeObjectName(callNode) // → 'console'

// Chained call (last in chain): z.string().min(1).optional()
getCalleeObjectName(callNode) // → null (object is a CallExpression)
```

**Note:** For complex chains, use `collectMethodChain()` instead.

#### `collectMethodChain(node: CallExpression): string[]`

Collect all method names in a call chain - extremely useful for Zod schemas and fluent APIs.

```typescript
// Zod schema
collectMethodChain(callNode)
// z.string().min(1).max(100).optional()
// → ['string', 'min', 'max', 'optional']

// React Hook Form
collectMethodChain(callNode)
// register("email", { required: true }).onChange()
// → ['register', 'onChange']
```

### Argument Extraction

#### `extractStringArg(node: CallExpression, argIndex?: number): string | null`

Extract string literal from function call argument.

```typescript
// Form field names
extractStringArg(callNode) // register("email") → 'email'

// Translation with fallback
extractStringArg(callNode, 1) // t("key", "fallback") → 'fallback'

// Dynamic values (skip)
extractStringArg(callNode) // register(variable) → null
```

#### `extractAllStringArgs(node: CallExpression): string[]`

Extract all string literals from function call arguments.

```typescript
extractAllStringArgs(callNode)
// foo("a", 123, "b", variable, "c")
// → ['a', 'b', 'c']
```

### JSX Extraction

#### `getJSXElementName(node: JSXOpeningElement): string | null`

Extract component/element name from JSX opening tag.

```typescript
// Simple element
getJSXElementName(openingElement) // <Input /> → 'Input'

// Member expression
getJSXElementName(openingElement) // <Form.Field /> → 'Form.Field'

// Namespaced
getJSXElementName(openingElement) // <ui:Button /> → 'ui:Button'
```

#### `getJSXAttributeValue(node: JSXAttribute): string | null`

Extract static string value from JSX attribute.

```typescript
// String literal
getJSXAttributeValue(attrNode) // name="email" → 'email'

// Dynamic value (skip)
getJSXAttributeValue(attrNode) // name={variable} → null

// Boolean attribute (no value)
getJSXAttributeValue(attrNode) // disabled → null
```

### Type Analysis

#### `extractTypeString(typeNode: TsType, content: string, maxLength?: number): string`

Convert TypeScript type node to string representation.

```typescript
// Simple type
extractTypeString(typeNode, sourceCode) // → 'string | number'

// Complex type (truncated)
extractTypeString(typeNode, sourceCode, 30)
// → '{ id: string; name: st...'
```

### Utility Functions

#### `getIdentifierName(node: Node): string | null`

Type-safe wrapper to extract identifier names.

```typescript
getIdentifierName(node) // → 'myVariable' or null
```

#### `isCallingFunction(node: CallExpression, name: string): boolean`

Check if a call expression is calling a specific function.

```typescript
if (isCallingFunction(callNode, 'register')) {
  // Handle register() calls
}
```

#### `isCallingMethod(node: CallExpression, objectName: string, methodName?: string): boolean`

Check if a call expression is calling a method on a specific object.

```typescript
// Any console method
if (isCallingMethod(callNode, 'console')) {
  // Handle console.log(), console.error(), etc.
}

// Specific method
if (isCallingMethod(callNode, 'z', 'string')) {
  // Handle z.string() calls
}
```

## Usage Examples

### Example 1: Extract Form Field Names

```typescript
import { parseFile, visitNodeWithCallbacks } from '@/lib/@swc';
import { isCallingFunction, extractStringArg } from '@/lib/@swc/extractors';

const { ast } = parseFile('form.tsx', content);
const fieldNames: string[] = [];

visitNodeWithCallbacks(ast, {
  onCallExpression: (node) => {
    const call = node as unknown as CallExpression;

    if (isCallingFunction(call, 'register')) {
      const fieldName = extractStringArg(call);
      if (fieldName) {
        fieldNames.push(fieldName);
      }
    }
  },
});
```

### Example 2: Analyze Zod Schemas

```typescript
import { parseFile, visitNodeWithCallbacks } from '@/lib/@swc';
import { isCallingMethod, collectMethodChain } from '@/lib/@swc/extractors';

const { ast } = parseFile('schema.ts', content);
const zodSchemas: Array<{ methods: string[] }> = [];

visitNodeWithCallbacks(ast, {
  onCallExpression: (node) => {
    const call = node as unknown as CallExpression;

    // Detect any z.* call
    if (isCallingMethod(call, 'z')) {
      const methods = collectMethodChain(call);
      zodSchemas.push({ methods });
    }
  },
});
```

### Example 3: Extract React Component Props

```typescript
import { parseFile, visitNodeWithCallbacks } from '@/lib/@swc';
import { getJSXElementName, getJSXAttributeValue } from '@/lib/@swc/extractors';

const { ast } = parseFile('component.tsx', content);
const inputFields: Array<{ name: string }> = [];

visitNodeWithCallbacks(ast, {
  onJSXOpeningElement: (node) => {
    const element = node as unknown as JSXOpeningElement;
    const elementName = getJSXElementName(element);

    if (elementName === 'Input') {
      // Extract name attribute
      const attributes = element.attributes ?? [];
      for (const attr of attributes) {
        if (attr.type === 'JSXAttribute') {
          const jsxAttr = attr as JSXAttribute;
          const attrName = jsxAttr.name;

          if (attrName.type === 'Identifier' && attrName.value === 'name') {
            const value = getJSXAttributeValue(jsxAttr);
            if (value) {
              inputFields.push({ name: value });
            }
          }
        }
      }
    }
  },
});
```

## Design Principles

1. **Pure Functions**: All functions are pure with no side effects
2. **Graceful Failure**: Return `null` instead of throwing errors
3. **Type Safety**: Proper TypeScript types from `@swc/core`
4. **Performance**: Minimal overhead, no unnecessary traversals
5. **Composability**: Functions can be combined for complex analysis

## Testing

Run the test suite:

```bash
pnpm exec tsx src/lib/@swc/extractors.test.ts
```

## Related Modules

- `parser.ts` - File parsing with caching
- `visitor.ts` - AST traversal utilities
- `types.ts` - Shared type definitions

## Common Patterns

### Pattern 1: Filter and Extract

```typescript
visitNodeWithCallbacks(ast, {
  onCallExpression: (node) => {
    const call = node as unknown as CallExpression;

    // Filter by function name
    if (isCallingFunction(call, 'register')) {
      // Extract arguments
      const fieldName = extractStringArg(call);
      // Process...
    }
  },
});
```

### Pattern 2: Chain Analysis

```typescript
visitNodeWithCallbacks(ast, {
  onCallExpression: (node) => {
    const call = node as unknown as CallExpression;

    // Get full method chain
    const chain = collectMethodChain(call);

    // Check if it's a Zod string schema
    if (chain[0] === 'string' && getCalleeObjectName(call) === 'z') {
      // Analyze validations: min, max, email, etc.
    }
  },
});
```

### Pattern 3: JSX Component Analysis

```typescript
visitNodeWithCallbacks(ast, {
  onJSXOpeningElement: (node) => {
    const element = node as unknown as JSXOpeningElement;
    const componentName = getJSXElementName(element);

    // Filter by component type
    if (componentName?.startsWith('Form.')) {
      // Analyze form components
    }
  },
});
```

## Performance Notes

- All functions execute in O(1) or O(n) time where n is chain depth
- No recursive AST traversal (caller controls traversal)
- Minimal memory allocation
- String extraction uses source spans (no regex)

## Future Enhancements

Potential additions (not yet implemented):

- `extractNumericArg()` - Extract numeric literal from arguments
- `getJSXAttributeName()` - Extract attribute name
- `extractObjectProperties()` - Extract keys from object expressions
- `getGenericArguments()` - Extract TypeScript generic arguments
