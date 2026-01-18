# I18n AST-Based Fixer Migration Plan

## Problem Statement

Regex-based string detection is fundamentally flawed for i18n replacement:
- Cannot distinguish between JSX attributes, object properties, and function arguments
- Edge cases multiply exponentially (11+ patterns in current implementation)
- Each fix breaks other patterns
- Not maintainable for production use

## Solution: AST-Based Transformation

Use ts-morph (TypeScript Compiler API wrapper) for 100% accurate context detection.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     I18n AST Transformer                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐  │
│  │  ts-morph   │───▶│  Collector  │───▶│  LocaleCatalog  │  │
│  │   Parser    │    │  (context)  │    │  (key resolve)  │  │
│  └─────────────┘    └─────────────┘    └─────────────────┘  │
│                            │                    │            │
│                            ▼                    ▼            │
│                    ┌─────────────┐    ┌─────────────────┐   │
│                    │  Replacer   │───▶│   File Writer   │   │
│                    │  (context)  │    │  (ts-morph)     │   │
│                    └─────────────┘    └─────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Context Detection (SyntaxKind based)

| Context | SyntaxKind | Replacement Pattern |
|---------|------------|---------------------|
| JSX Attribute | `JsxAttribute` | `prop={t('key')}` |
| JSX Text | `JsxText` | `{t('key')}` |
| JSX Expression | `JsxExpression` | `t('key')` |
| Object Property | `PropertyAssignment` | `key: t('key')` |
| Function Arg | `CallExpression` | `fn(t('key'))` |
| Variable | `VariableDeclaration` | `const x = t('key')` |
| Array Element | `ArrayLiteralExpression` | `[t('key')]` |

## Edge Cases Handled

### 1. Fallback Patterns
```typescript
// {value || "Текст"} → {value || t('key')}
// Detected via BinaryExpression + check for JSX ancestor
```

### 2. Ternary Expressions
```typescript
// {cond ? "А" : "Б"} → {cond ? t('a') : t('b')}
// Detected via ConditionalExpression + check for JSX ancestor
```

### 3. Translatable Attributes
Only translate known user-facing attributes:
- `alt`, `title`, `placeholder`, `label`
- `aria-*` attributes
- Custom: `tooltip`, `helperText`, `errorMessage`, etc.

### 4. Skip Patterns
- Import/export paths
- Type annotations
- Technical strings (URLs, hex colors, CSS classes)
- Non-Russian text

## Files to Modify

1. **`src/lib/@i18n/ast-transformer.ts`** (NEW) ✅
   - Core AST transformation logic
   - Context detection
   - Replacement execution

2. **`src/lib/@i18n/index.ts`**
   - Export new transformer

3. **`src/commands/fix/fixers/i18n/ast-fixer.ts`** (NEW)
   - Fixer implementation using AST transformer
   - Integration with krolik fix command

4. **`src/commands/fix/fixers/i18n/index.ts`**
   - Switch to AST-based fixer
   - Keep old regex fixer as fallback

## Implementation Tasks

### Task 1: Export AST Transformer
- Add exports to `@i18n/index.ts`
- Type safety checks

### Task 2: Create AST Fixer
- Wrap `ast-transformer` for krolik fix interface
- Handle batch processing
- Add progress reporting

### Task 3: Integration Tests
- Test all context types
- Test edge cases (fallbacks, ternary)
- Test skip patterns
- Test import injection

### Task 4: Update Main Fixer
- Replace regex-based `fixI18nIssue` with AST version
- Maintain backward compatibility for analyzer

## Quality Checklist

- [ ] 100% context detection accuracy
- [ ] No formatting changes except replacements
- [ ] Correct import injection
- [ ] Catalog integration (reuse existing keys)
- [ ] Dry-run support
- [ ] Progress reporting
- [ ] Error handling with context
- [ ] Performance: <100ms per file

## Testing Strategy

1. **Unit Tests**: Each context type
2. **Integration Tests**: Full file transformation
3. **Regression Tests**: Previous bug cases
4. **Manual Testing**: On piternow-wt-fix project
