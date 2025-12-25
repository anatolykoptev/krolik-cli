# SWC Extractors Quick Reference

## Import

```typescript
import {
  // Call Analysis
  getCalleeName,
  getCalleeObjectName,
  collectMethodChain,

  // Arguments
  extractStringArg,
  extractAllStringArgs,

  // JSX
  getJSXElementName,
  getJSXAttributeValue,

  // Types
  extractTypeString,
  getIdentifierName,

  // Helpers
  isCallingFunction,
  isCallingMethod,
  getRootObjectName,
} from '@/lib/@swc/extractors';
```

## Quick Examples

### Extract function name
```typescript
getCalleeName(callNode) // register() → 'register'
```

### Extract method object
```typescript
getCalleeObjectName(callNode) // console.log() → 'console'
```

### Get Zod chain
```typescript
collectMethodChain(callNode)
// z.string().min(1).max(100) → ['string', 'min', 'max']
```

### Extract string argument
```typescript
extractStringArg(callNode) // register("email") → 'email'
extractStringArg(callNode, 1) // foo("a", "b") → 'b'
```

### Check function call
```typescript
if (isCallingFunction(callNode, 'register')) {
  // Handle register() calls
}
```

### Check method call
```typescript
if (isCallingMethod(callNode, 'z', 'string')) {
  // Handle z.string() calls
}
```

### JSX component name
```typescript
getJSXElementName(openingElement) // <Input /> → 'Input'
```

### JSX attribute value
```typescript
getJSXAttributeValue(attrNode) // name="email" → 'email'
```

## Common Patterns

### Pattern: Extract form fields
```typescript
visitNodeWithCallbacks(ast, {
  onCallExpression: (node) => {
    const call = node as unknown as CallExpression;
    if (isCallingFunction(call, 'register')) {
      const field = extractStringArg(call);
      if (field) fields.push(field);
    }
  },
});
```

### Pattern: Analyze Zod schemas
```typescript
visitNodeWithCallbacks(ast, {
  onCallExpression: (node) => {
    const call = node as unknown as CallExpression;
    if (isCallingMethod(call, 'z')) {
      const chain = collectMethodChain(call);
      // Analyze: ['string', 'min', 'max', 'email']
    }
  },
});
```

### Pattern: Extract JSX props
```typescript
visitNodeWithCallbacks(ast, {
  onJSXOpeningElement: (node) => {
    const element = node as unknown as JSXOpeningElement;
    const name = getJSXElementName(element);

    if (name === 'Input') {
      // Extract attributes...
    }
  },
});
```

## Return Values

All functions return:
- `string` - extracted value
- `string[]` - array of values
- `null` - if extraction fails (no error thrown)

## See Also

- Full documentation: `EXTRACTORS.md`
- Tests: `extractors.test.ts`
- Run tests: `pnpm exec tsx src/lib/@swc/extractors.test.ts`
