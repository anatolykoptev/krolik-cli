# SWC AST Detectors

Reusable detection functions for code quality analysis. Each detector is a pure function that takes an AST node and returns a detection result or `null`.

## Architecture

```
lib/@swc/detectors/
├── types.ts              # Shared types for all detectors
├── lint-detector.ts      # Lint issues (console, debugger, alert, eval)
├── type-detector.ts      # Type-safety issues (any, assertions)
├── security-detector.ts  # Security vulnerabilities
├── modernization-detector.ts  # Legacy patterns (require)
├── hardcoded-detector.ts # Hardcoded values (numbers, URLs, colors)
└── index.ts              # Barrel export
```

## Detectors

### Lint Detector (`lint-detector.ts`)

Detects code quality issues that should be removed before production.

| Function | Detects | Severity |
|----------|---------|----------|
| `detectConsole()` | `console.log/warn/error/debug/info/trace` | warning |
| `detectDebugger()` | `debugger` statements | error |
| `detectAlert()` | `alert/confirm/prompt` calls | warning |
| `detectEval()` | `eval()` calls | error |
| `detectEmptyCatch()` | Empty `catch {}` blocks | warning |
| `detectLintIssue()` | All of the above | - |

### Type Detector (`type-detector.ts`)

Detects TypeScript type-safety issues.

| Function | Detects | Severity |
|----------|---------|----------|
| `detectAnyAnnotation()` | `: any` type annotations | warning |
| `detectAnyAssertion()` | `as any` type assertions | warning |
| `detectDoubleAssertion()` | `as unknown as T` pattern | info |
| `detectNonNullAssertion()` | `!` non-null operator | info |
| `detectTypeSafetyIssue()` | All of the above | - |
| `isAnyType()` | Helper: checks if node is `any` | - |
| `isUnknownType()` | Helper: checks if node is `unknown` | - |

### Security Detector (`security-detector.ts`)

Detects potential security vulnerabilities.

| Function | Detects | Severity |
|----------|---------|----------|
| `detectCommandInjection()` | `execSync(\`${var}\`)` with template literals | error |
| `detectPathTraversal()` | `path.join(base, userInput)` with variables | warning |
| `detectSecurityIssue()` | All of the above | - |

### Modernization Detector (`modernization-detector.ts`)

Detects legacy patterns that should be updated.

| Function | Detects | Severity |
|----------|---------|----------|
| `detectRequire()` | `require()` and `require.resolve()` | warning |
| `detectModernizationIssue()` | All of the above | - |

### Hardcoded Detector (`hardcoded-detector.ts`)

Detects hardcoded values that should be extracted to constants.

| Function | Detects | Severity |
|----------|---------|----------|
| `detectMagicNumber()` | Numeric literals (except 0, 1, -1, 100, etc.) | warning |
| `detectHardcodedUrl()` | `"https://..."` string literals | warning |
| `detectHexColor()` | `"#FF0000"` color strings | info |
| `detectHardcodedValue()` | All of the above | - |
| `isInConstDeclaration()` | Helper: checks if in `const X = ...` | - |
| `isArrayIndex()` | Helper: checks if used as array index | - |

## Usage

### In Unified Analyzer

```typescript
import {
  detectLintIssue,
  detectTypeSafetyIssue,
  detectSecurityIssue,
  detectModernizationIssue,
  detectHardcodedValue,
} from '@/lib/@swc/detectors';

visitNode(ast, (node, context) => {
  const lint = detectLintIssue(node);
  const type = detectTypeSafetyIssue(node);
  const security = detectSecurityIssue(node);
  const modern = detectModernizationIssue(node);
  const hardcoded = detectHardcodedValue(node, content, filepath, ctx, parentCtx);

  // Process detections...
});
```

### In Individual Fixers

```typescript
import { detectConsole } from '@/lib/@swc/detectors';

// Fixer only needs console detection
visitNode(ast, (node) => {
  const consoleCall = detectConsole(node);
  if (consoleCall) {
    // Apply fix...
  }
});
```

## Types

```typescript
interface LintDetection {
  type: 'console' | 'debugger' | 'alert' | 'eval' | 'empty-catch';
  offset: number;
  method?: string;
}

interface TypeSafetyDetection {
  type: 'any-annotation' | 'any-assertion' | 'non-null' | 'any-param' | 'any-array' | 'double-assertion';
  offset: number;
}

interface SecurityDetection {
  type: 'command-injection' | 'path-traversal';
  offset: number;
  method?: string;
}

interface ModernizationDetection {
  type: 'require';
  offset: number;
  method?: string;
}

interface HardcodedDetection {
  type: 'number' | 'url' | 'color';
  value: string | number;
  offset: number;
}

interface DetectorContext {
  isTopLevel: boolean;
  inConstDeclaration: boolean | undefined;
  inMemberExpression: boolean | undefined;
  parentType: string | undefined;
}
```

## Design Principles

1. **Pure Functions** - No side effects, same input = same output
2. **Single Responsibility** - Each detector handles one category
3. **Composable** - Use specific detectors or the "all-in-one" function
4. **Reusable** - Used by both unified analyzer and individual fixers
5. **Type-Safe** - Full TypeScript typing with explicit return types
