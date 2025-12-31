# Semantic Deduplication Module

## Overview

A reusable module for Google-level semantic code deduplication with 100% precision.

**Goal:** Zero false positives in duplicate detection by understanding code semantics, not just structure.

---

## Architecture

```
lib/@semantic/
├── index.ts                    # Public API
├── types.ts                    # Shared types
├── core/
│   ├── analyzer.ts             # Main semantic analyzer
│   ├── intent-detector.ts      # Semantic intent detection
│   └── similarity.ts           # Semantic similarity scoring
├── detectors/
│   ├── factory-pattern.ts      # Factory pattern detection
│   ├── wrapper-pattern.ts      # Wrapper/delegate detection
│   ├── route-context.ts        # Next.js/framework route context
│   └── domain-boundary.ts      # Domain boundary detection
├── extractors/
│   ├── call-graph.ts           # Function call graph extraction
│   ├── jsx-children.ts         # JSX component children extraction
│   ├── imports.ts              # Import/dependency extraction
│   └── metadata.ts             # Export metadata extraction
└── filters/
    ├── complexity.ts           # Complexity-based filtering
    ├── context.ts              # Context-aware filtering
    └── semantic.ts             # Semantic intent filtering
```

---

## Phase 1: Core Infrastructure (Week 1)

### 1.1 Types and Interfaces

```typescript
// types.ts
interface SemanticSignature {
  // From existing FunctionSignature
  name: string;
  file: string;
  line: number;
  fingerprint?: string;
  complexity?: number;

  // NEW: Semantic metadata
  intent: FunctionIntent;
  calledComponents: string[];
  calledFunctions: string[];
  importedFrom: Map<string, string>;
  exportMetadata: ExportMetadata;
  domainContext: DomainContext;
  routeContext?: RouteContext;
  isFactoryGenerated: boolean;
}

type FunctionIntent =
  | 'route-handler'      // Next.js page/API route
  | 'component-wrapper'  // Thin component wrapper
  | 'schema-generator'   // JSON-LD, Zod schema
  | 'factory-instance'   // Created by factory function
  | 'hook-consumer'      // Hook usage (useX)
  | 'hook-provider'      // Hook provider (useXProvider)
  | 'event-handler'      // Event/callback handler
  | 'utility'            // Pure utility function
  | 'business-logic';    // Domain business logic

interface DomainContext {
  domain: string | null;      // 'booking', 'crm', 'seo', etc.
  layer: 'core' | 'domain' | 'ui' | 'integration';
  feature?: string;           // Specific feature within domain
}

interface RouteContext {
  segment: string;            // '/panel/customers'
  isPage: boolean;
  isLayout: boolean;
  isApiRoute: boolean;
}
```

### 1.2 Intent Detector

```typescript
// core/intent-detector.ts
export function detectIntent(sig: FunctionSignature, fileContent: string): FunctionIntent {
  // 1. Route handlers
  if (isRouteHandler(sig, fileContent)) return 'route-handler';

  // 2. Component wrappers (single JSX return)
  if (isComponentWrapper(sig)) return 'component-wrapper';

  // 3. Schema generators
  if (isSchemaGenerator(sig)) return 'schema-generator';

  // 4. Factory instances
  if (isFactoryInstance(sig, fileContent)) return 'factory-instance';

  // 5. Hooks
  if (isHookProvider(sig)) return 'hook-provider';
  if (isHookConsumer(sig)) return 'hook-consumer';

  // 6. Event handlers
  if (isEventHandler(sig)) return 'event-handler';

  // 7. Utilities (pure functions, no side effects)
  if (isUtility(sig)) return 'utility';

  // Default: business logic
  return 'business-logic';
}
```

---

## Phase 2: Extractors (Week 2)

### 2.1 Call Graph Extractor

```typescript
// extractors/call-graph.ts
interface CallGraphNode {
  name: string;
  type: 'function' | 'component' | 'hook' | 'external';
  isAsync: boolean;
  arguments: CallArgument[];
}

export function extractCallGraph(ast: Node): CallGraphNode[] {
  const calls: CallGraphNode[] = [];

  traverse(ast, {
    CallExpression(path) {
      calls.push(extractCallInfo(path.node));
    },
    JSXElement(path) {
      calls.push(extractJSXComponentCall(path.node));
    }
  });

  return calls;
}
```

### 2.2 JSX Children Extractor

**Key insight:** Don't normalize JSX component names!

```typescript
// extractors/jsx-children.ts
export function extractJSXChildren(ast: Node): string[] {
  const components: string[] = [];

  traverse(ast, {
    JSXElement(path) {
      const name = getJSXElementName(path.node);
      if (name && isUserComponent(name)) {
        components.push(name);
      }
    }
  });

  return [...new Set(components)];
}

function isUserComponent(name: string): boolean {
  // User components start with uppercase
  return /^[A-Z]/.test(name);
}
```

### 2.3 Factory Pattern Detector

```typescript
// detectors/factory-pattern.ts
const FACTORY_PATTERNS = [
  /const\s*\{[^}]+\}\s*=\s*create\w+\(/,
  /=\s*create\w+Hook\(/,
  /=\s*create\w+Factory\(/,
  /=\s*make\w+\(/,
  /=\s*build\w+\(/,
];

export function detectFactoryPattern(fileContent: string, functionLine: number): boolean {
  const lines = fileContent.split('\n');
  const contextStart = Math.max(0, functionLine - 20);
  const contextEnd = Math.min(lines.length, functionLine + 5);
  const context = lines.slice(contextStart, contextEnd).join('\n');

  return FACTORY_PATTERNS.some(p => p.test(context));
}
```

---

## Phase 3: Semantic Filtering (Week 3)

### 3.1 Semantic Similarity Scorer

```typescript
// core/similarity.ts
interface SemanticSimilarity {
  structural: number;      // Current fingerprint-based (0-1)
  semantic: number;        // NEW: Intent + calls based (0-1)
  combined: number;        // Weighted combination
  isTrueDuplicate: boolean;
}

export function calculateSemanticSimilarity(
  sig1: SemanticSignature,
  sig2: SemanticSignature
): SemanticSimilarity {
  const structural = sig1.fingerprint === sig2.fingerprint ? 1 : 0;

  // Semantic factors
  const sameIntent = sig1.intent === sig2.intent ? 1 : 0;
  const sameCalls = jaccardSimilarity(
    new Set(sig1.calledComponents),
    new Set(sig2.calledComponents)
  );
  const sameDomain = sig1.domainContext.domain === sig2.domainContext.domain ? 1 : 0;

  // Weighted combination
  const semantic = (sameIntent * 0.3 + sameCalls * 0.5 + sameDomain * 0.2);
  const combined = structural * 0.4 + semantic * 0.6;

  // True duplicate requires BOTH structural AND semantic similarity
  const isTrueDuplicate = structural > 0.9 && semantic > 0.7;

  return { structural, semantic, combined, isTrueDuplicate };
}
```

### 3.2 Filter Pipeline

```typescript
// filters/semantic.ts
export function filterFalsePositives(
  candidates: DuplicateCandidate[]
): DuplicateCandidate[] {
  return candidates.filter(candidate => {
    const { funcs } = candidate;

    // Filter 1: Different intents = not duplicates
    const intents = new Set(funcs.map(f => f.intent));
    if (intents.size > 1) return false;

    // Filter 2: Factory instances with different configs = not duplicates
    if (funcs.every(f => f.isFactoryGenerated)) {
      if (haveDifferentFactoryConfigs(funcs)) return false;
    }

    // Filter 3: Wrappers calling different components = not duplicates
    if (funcs.every(f => f.intent === 'component-wrapper')) {
      const allCalls = funcs.map(f => f.calledComponents);
      if (allCallsAreDifferent(allCalls)) return false;
    }

    // Filter 4: Different route segments = not duplicates
    if (funcs.every(f => f.routeContext?.isPage)) {
      const segments = new Set(funcs.map(f => f.routeContext!.segment));
      if (segments.size === funcs.length) return false;
    }

    // Filter 5: Different domains = not duplicates (optional, configurable)
    const domains = new Set(funcs.map(f => f.domainContext.domain).filter(Boolean));
    if (domains.size > 1) return false;

    return true;
  });
}
```

---

## Phase 4: Integration (Week 4)

### 4.1 Public API

```typescript
// index.ts
export interface SemanticDeduplicationOptions {
  /** Minimum complexity for structural clone detection */
  minComplexity?: number;           // default: 25
  /** Require same intent for duplicates */
  requireSameIntent?: boolean;      // default: true
  /** Allow cross-domain duplicates */
  allowCrossDomain?: boolean;       // default: false
  /** Intent types to always skip */
  skipIntents?: FunctionIntent[];   // default: ['route-handler', 'component-wrapper']
  /** Custom domain extractor */
  domainExtractor?: (path: string) => string | null;
}

export function analyzeWithSemantics(
  functions: FunctionSignature[],
  options?: SemanticDeduplicationOptions
): SemanticDuplicateResult[] {
  // 1. Enrich with semantic metadata
  const enriched = functions.map(f => enrichWithSemantics(f));

  // 2. Group by fingerprint (structural similarity)
  const groups = groupByFingerprint(enriched);

  // 3. Filter with semantic analysis
  const filtered = filterFalsePositives(groups, options);

  // 4. Calculate semantic similarity scores
  return filtered.map(group => ({
    ...group,
    similarity: calculateSemanticSimilarity(group.funcs[0], group.funcs[1]),
  }));
}
```

### 4.2 Integration with Existing Analyzer

```typescript
// commands/refactor/analyzers/core/duplicates/analyzer.ts
import { analyzeWithSemantics } from '@/lib/@semantic';

// Replace current byFingerprint logic:
const semanticDuplicates = analyzeWithSemantics(allFunctions, {
  minComplexity: MIN_STRUCTURAL_COMPLEXITY,
  requireSameIntent: true,
  skipIntents: ['route-handler', 'component-wrapper'],
});

for (const dup of semanticDuplicates) {
  if (!dup.similarity.isTrueDuplicate) continue;

  duplicates.push({
    name: `[semantic clone] ${dup.names.join(' / ')}`,
    locations: dup.locations,
    similarity: dup.similarity.combined,
    recommendation: 'merge',
    // NEW: Include semantic metadata for better recommendations
    metadata: {
      intent: dup.intent,
      domain: dup.domain,
      calledComponents: dup.calledComponents,
    }
  });
}
```

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Precision (true positives / all reported) | ~40% | **100%** |
| Recall (true positives / all actual) | ~95% | **95%** |
| False positives | 17/27 | **0** |
| Detection time | 2s | **<3s** |

---

## Configuration

```typescript
// krolik.config.ts
export default {
  semantic: {
    // Skip these intent types entirely
    skipIntents: ['route-handler', 'component-wrapper'],

    // Minimum complexity for structural clone detection
    minComplexity: 25,

    // Domain boundaries (files in different domains are never duplicates)
    domainPatterns: [
      /\/features\/(\w+)\//,
      /\/lib\/@(\w+)\//,
    ],

    // Framework-specific rules
    frameworks: {
      nextjs: {
        skipPageWrappers: true,
        skipApiRoutes: true,
        skipLayouts: true,
      }
    }
  }
};
```

---

## Testing Strategy

### Unit Tests

```typescript
describe('SemanticDeduplication', () => {
  it('should NOT detect page.tsx wrappers as duplicates', () => {
    const funcs = [
      createMockSignature('FavoritesPage', '/app/favorites/page.tsx'),
      createMockSignature('CustomersPage', '/app/customers/page.tsx'),
    ];
    const result = analyzeWithSemantics(funcs);
    expect(result).toHaveLength(0);
  });

  it('should NOT detect factory-generated hooks as duplicates', () => {
    const funcs = [
      createMockSignature('useFavorites', '/hooks/useFavorites.ts', { isFactoryGenerated: true }),
      createMockSignature('useEventFavorites', '/hooks/useEventFavorites.ts', { isFactoryGenerated: true }),
    ];
    const result = analyzeWithSemantics(funcs);
    expect(result).toHaveLength(0);
  });

  it('SHOULD detect actual duplicates with same intent and calls', () => {
    const funcs = [
      createMockSignature('processUser', '/services/user.ts', { calledFunctions: ['validate', 'save'] }),
      createMockSignature('handleUser', '/handlers/user.ts', { calledFunctions: ['validate', 'save'] }),
    ];
    const result = analyzeWithSemantics(funcs);
    expect(result).toHaveLength(1);
    expect(result[0].similarity.isTrueDuplicate).toBe(true);
  });
});
```

### Integration Tests

```typescript
describe('Semantic Deduplication Integration', () => {
  it('should achieve 100% precision on piternow-wt-fix', async () => {
    const result = await runRefactor('/path/to/piternow-wt-fix');

    // Verify no known false positives
    const knownFalsePositives = [
      'BusinessPage / ListsPage / PanelPage',
      'FavoritesPage / CustomersPage / ...',
    ];

    for (const fp of knownFalsePositives) {
      expect(result.duplicates.map(d => d.name)).not.toContain(expect.stringContaining(fp));
    }
  });
});
```

---

## Migration Path

1. **v1.0:** Add as opt-in flag `--semantic`
2. **v1.1:** Make default for `refactor` command
3. **v2.0:** Deprecate old structural-only detection

---

## Future Enhancements

1. **ML-based intent classification** — Train on codebase patterns
2. **Cross-file analysis** — Detect duplicates across monorepo packages
3. **Auto-fix suggestions** — Generate refactoring code automatically
4. **IDE integration** — Real-time duplicate detection in editor
