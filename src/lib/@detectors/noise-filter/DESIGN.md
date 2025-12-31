# Noise Filter Pipeline — Design Document

> Google-level approach: **Zero False Positives > High Recall**

## Executive Summary

Unified pipeline для фильтрации шума в отчётах krolik с confidence-based scoring.
Применяется к **любым findings**: TODOs, duplicates, issues, recommendations.

---

## Problem Statement

### Текущие проблемы

| Проблема | Пример | Impact |
|----------|--------|--------|
| Generated code в отчётах | Prisma TODOs, GraphQL types | Noise +30% |
| Дублирующиеся findings | Один TODO в 5 файлах | Confusion |
| Нерелевантные findings | Старый код, vendor files | Wasted attention |
| Structural false positives | `page.tsx` wrappers как дубликаты | Wrong recommendations |

### Цели

1. **Zero false positives** — лучше пропустить, чем показать мусор
2. **Context-aware** — релевантность к текущей задаче
3. **Actionable** — только то, что можно исправить
4. **Fast** — <100ms overhead на 1000 findings

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    @detectors/noise-filter Pipeline                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Input: Finding[]                                                            │
│      │                                                                       │
│      ▼                                                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ Stage 0: Skip Filter (fast path)                                       │  │
│  │ ├─ Path patterns: node_modules, dist, .next                            │  │
│  │ ├─ File extensions: .d.ts, .map, .min.js                               │  │
│  │ └─ Confidence: binary (skip/keep)                                      │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│      │                                                                       │
│      ▼                                                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ Stage 1: Generated File Filter                                         │  │
│  │ ├─ Header markers: @generated, DO NOT EDIT, AUTO-GENERATED             │  │
│  │ ├─ Tool signatures: Prisma, GraphQL Codegen, OpenAPI                   │  │
│  │ ├─ Path patterns: /generated/, /__generated__/                         │  │
│  │ └─ Confidence threshold: 0.7                                           │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│      │                                                                       │
│      ▼                                                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ Stage 2: Semantic Context Filter                                       │  │
│  │ ├─ Intent detection: route-handler, wrapper, factory-instance          │  │
│  │ ├─ Domain boundaries: different domains ≠ duplicates                   │  │
│  │ ├─ Framework patterns: Next.js pages, API routes                       │  │
│  │ └─ Confidence: intent-based scoring                                    │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│      │                                                                       │
│      ▼                                                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ Stage 3: Content Deduplicator                                          │  │
│  │ ├─ Fingerprint grouping (using @ast/fingerprint)                       │  │
│  │ ├─ Semantic similarity check (call graph, JSX children)                │  │
│  │ ├─ Collapse duplicates with count                                      │  │
│  │ └─ Similarity threshold: 0.8                                           │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│      │                                                                       │
│      ▼                                                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ Stage 4: Confidence Scoring                                            │  │
│  │ ├─ Ownership: user (1.0) / generated (0.1) / vendor (0.0)              │  │
│  │ ├─ Freshness: recently modified (boost)                                │  │
│  │ ├─ Relevance: matches feature keywords (boost)                         │  │
│  │ ├─ Complexity: meaningful code (boost)                                 │  │
│  │ └─ Actionability: has fixer (boost)                                    │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│      │                                                                       │
│      ▼                                                                       │
│  Output: ScoredFinding[] (sorted by confidence × relevance)                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
src/lib/@detectors/
├── noise-filter/
│   ├── index.ts              # Public API exports
│   ├── types.ts              # Shared types
│   ├── pipeline.ts           # Pipeline orchestrator
│   │
│   ├── stages/
│   │   ├── skip.ts           # Stage 0: Fast path skip
│   │   ├── generated.ts      # Stage 1: Generated file detection
│   │   ├── semantic.ts       # Stage 2: Semantic context filter
│   │   ├── deduplication.ts  # Stage 3: Content deduplication
│   │   └── scoring.ts        # Stage 4: Confidence scoring
│   │
│   ├── extractors/
│   │   ├── intent.ts         # Function intent detection
│   │   ├── call-graph.ts     # Call graph extraction
│   │   ├── jsx-children.ts   # JSX component children
│   │   └── domain.ts         # Domain boundary detection
│   │
│   └── __tests__/
│       ├── generated.test.ts
│       ├── semantic.test.ts
│       ├── deduplication.test.ts
│       └── pipeline.test.ts
│
└── shared/
    ├── scoring.ts            # Generic weighted scoring
    └── types.ts              # Common detector types
```

---

## Types

```typescript
// types.ts

/**
 * Base finding interface — any detectable item
 */
interface Finding {
  id: string;
  type: FindingType;
  file: string;
  line?: number;
  text: string;
  severity?: 'error' | 'warning' | 'info';
  metadata?: Record<string, unknown>;
}

type FindingType =
  | 'todo'
  | 'duplicate-function'
  | 'duplicate-type'
  | 'structural-clone'
  | 'code-smell'
  | 'security-issue'
  | 'performance-issue';

/**
 * Scored finding with confidence and relevance
 */
interface ScoredFinding<T extends Finding = Finding> {
  finding: T;
  score: number;              // Final score (0.0 - 2.0+)
  confidence: number;         // How sure we are (0.0 - 1.0)
  relevance: number;          // To current task (0.0 - 1.0)
  factors: ScoringBreakdown;
  filterResults: FilterResult[];
}

interface ScoringBreakdown {
  ownership: number;          // 0.0 - 1.0
  freshness: number;          // 0.8 - 1.2 (multiplier)
  relevance: number;          // 0.5 - 1.5 (multiplier)
  complexity: number;         // 0.0 - 1.0
  actionability: number;      // 1.0 - 1.3 (multiplier)
}

interface FilterResult {
  stage: string;
  passed: boolean;
  reason?: string;
  confidence?: number;
}

/**
 * Semantic intent for functions (used in Stage 2)
 */
type FunctionIntent =
  | 'route-handler'       // Next.js page/API route
  | 'component-wrapper'   // Thin component wrapper
  | 'schema-generator'    // JSON-LD, Zod schema
  | 'factory-instance'    // Created by factory function
  | 'hook-consumer'       // Hook usage (useX)
  | 'hook-provider'       // Hook provider (useXProvider)
  | 'event-handler'       // Event/callback handler
  | 'utility'             // Pure utility function
  | 'business-logic';     // Domain business logic

/**
 * Domain context for cross-domain duplicate prevention
 */
interface DomainContext {
  domain: string | null;      // 'booking', 'crm', 'seo', etc.
  layer: 'core' | 'domain' | 'ui' | 'integration';
  feature?: string;           // Specific feature within domain
}
```

---

## Stage 0: Skip Filter (Fast Path)

Быстрая фильтрация по путям без чтения содержимого.

```typescript
// stages/skip.ts

const SKIP_PATTERNS = {
  dirs: [
    'node_modules',
    '.git',
    '.next',
    'dist',
    'build',
    '.turbo',
    'coverage',
    '.pnpm',
  ],
  extensions: [
    '.d.ts',
    '.map',
    '.min.js',
    '.min.css',
    '.lock',
  ],
  files: [
    'package-lock.json',
    'pnpm-lock.yaml',
    'yarn.lock',
  ],
};

export function shouldSkip(filepath: string): boolean {
  // O(1) checks first
  const filename = path.basename(filepath);
  if (SKIP_PATTERNS.files.includes(filename)) return true;

  const ext = path.extname(filepath);
  if (SKIP_PATTERNS.extensions.includes(ext)) return true;

  // O(n) path check
  return SKIP_PATTERNS.dirs.some(dir =>
    filepath.includes(`/${dir}/`) || filepath.includes(`\\${dir}\\`)
  );
}
```

---

## Stage 1: Generated File Detection

```typescript
// stages/generated.ts

interface GeneratedSignal {
  type: 'header' | 'path' | 'tool' | 'structure';
  pattern: RegExp | string;
  weight: number;
  matched?: boolean;
}

const GENERATED_SIGNALS: GeneratedSignal[] = [
  // Header markers (high confidence)
  { type: 'header', pattern: /@generated/i, weight: 0.9 },
  { type: 'header', pattern: /DO NOT EDIT/i, weight: 0.8 },
  { type: 'header', pattern: /AUTO[-_]?GENERATED/i, weight: 0.8 },
  { type: 'header', pattern: /This file was automatically generated/i, weight: 0.95 },
  { type: 'header', pattern: /Generated by/i, weight: 0.7 },

  // Tool-specific (very high confidence)
  { type: 'tool', pattern: /Prisma Client/i, weight: 0.99 },
  { type: 'tool', pattern: /@prisma\/client/i, weight: 0.99 },
  { type: 'tool', pattern: /@graphql-codegen/i, weight: 0.95 },
  { type: 'tool', pattern: /openapi-generator/i, weight: 0.95 },
  { type: 'tool', pattern: /swagger-codegen/i, weight: 0.95 },
  { type: 'tool', pattern: /protobuf/i, weight: 0.9 },

  // Path patterns (medium confidence)
  { type: 'path', pattern: /\/generated\//i, weight: 0.7 },
  { type: 'path', pattern: /__generated__/i, weight: 0.8 },
  { type: 'path', pattern: /\.generated\./i, weight: 0.7 },
  { type: 'path', pattern: /\.gen\./i, weight: 0.6 },
];

interface GeneratedResult {
  isGenerated: boolean;
  confidence: number;
  signals: GeneratedSignal[];
  generator?: string;
}

export function detectGeneratedFile(
  filepath: string,
  content?: string,
): GeneratedResult {
  const matchedSignals: GeneratedSignal[] = [];

  // Check path-based signals (no content needed)
  for (const signal of GENERATED_SIGNALS.filter(s => s.type === 'path')) {
    if (typeof signal.pattern === 'string'
      ? filepath.includes(signal.pattern)
      : signal.pattern.test(filepath)) {
      matchedSignals.push({ ...signal, matched: true });
    }
  }

  // Check content-based signals
  if (content) {
    const header = content.slice(0, 2000); // First 2KB only

    for (const signal of GENERATED_SIGNALS.filter(s => s.type !== 'path')) {
      if (typeof signal.pattern === 'string'
        ? header.includes(signal.pattern)
        : signal.pattern.test(header)) {
        matchedSignals.push({ ...signal, matched: true });
      }
    }
  }

  // Calculate confidence (max of matched weights)
  const confidence = matchedSignals.length > 0
    ? Math.max(...matchedSignals.map(s => s.weight))
    : 0;

  // Detect specific generator
  const generator = detectGenerator(matchedSignals);

  return {
    isGenerated: confidence >= 0.7,
    confidence,
    signals: matchedSignals,
    generator,
  };
}

function detectGenerator(signals: GeneratedSignal[]): string | undefined {
  for (const signal of signals) {
    if (signal.type === 'tool') {
      if (/prisma/i.test(String(signal.pattern))) return 'prisma';
      if (/graphql/i.test(String(signal.pattern))) return 'graphql-codegen';
      if (/openapi/i.test(String(signal.pattern))) return 'openapi';
      if (/swagger/i.test(String(signal.pattern))) return 'swagger';
      if (/protobuf/i.test(String(signal.pattern))) return 'protobuf';
    }
  }
  return undefined;
}
```

---

## Stage 2: Semantic Context Filter

Фильтрация на основе семантического понимания кода.

```typescript
// stages/semantic.ts

import { detectIntent } from '../extractors/intent';
import { extractDomain } from '../extractors/domain';

interface SemanticFilterConfig {
  /** Skip these intent types entirely */
  skipIntents: FunctionIntent[];
  /** Allow cross-domain duplicates */
  allowCrossDomain: boolean;
  /** Minimum complexity for structural clones */
  minComplexity: number;
}

const DEFAULT_CONFIG: SemanticFilterConfig = {
  skipIntents: ['route-handler', 'component-wrapper'],
  allowCrossDomain: false,
  minComplexity: 25,
};

interface SemanticFilterResult {
  passed: boolean;
  reason?: string;
  intent?: FunctionIntent;
  domain?: DomainContext;
  complexity?: number;
}

export function applySemanticFilter(
  finding: Finding,
  allFindings: Finding[],
  config: Partial<SemanticFilterConfig> = {},
): SemanticFilterResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Only applies to function duplicates
  if (!['duplicate-function', 'structural-clone'].includes(finding.type)) {
    return { passed: true };
  }

  // 1. Detect intent
  const intent = detectIntent(finding);
  if (cfg.skipIntents.includes(intent)) {
    return {
      passed: false,
      reason: `Skipped intent: ${intent}`,
      intent,
    };
  }

  // 2. Check complexity
  const complexity = finding.metadata?.complexity as number | undefined;
  if (complexity !== undefined && complexity < cfg.minComplexity) {
    return {
      passed: false,
      reason: `Low complexity: ${complexity} < ${cfg.minComplexity}`,
      intent,
      complexity,
    };
  }

  // 3. Check domain boundaries (for duplicates only)
  if (finding.type === 'structural-clone' && !cfg.allowCrossDomain) {
    const domain = extractDomain(finding.file);
    const relatedFindings = findRelatedFindings(finding, allFindings);
    const domains = new Set(
      relatedFindings.map(f => extractDomain(f.file).domain).filter(Boolean)
    );

    if (domains.size > 1) {
      return {
        passed: false,
        reason: `Cross-domain duplicate: ${[...domains].join(', ')}`,
        intent,
        domain,
      };
    }
  }

  return { passed: true, intent };
}

// extractors/intent.ts
export function detectIntent(finding: Finding): FunctionIntent {
  const { file, text, metadata } = finding;

  // Route handlers
  if (/\/page\.tsx?$/.test(file)) return 'route-handler';
  if (/\/route\.tsx?$/.test(file)) return 'route-handler';
  if (/\/api\//.test(file) && /\.(GET|POST|PUT|DELETE)/.test(text)) return 'route-handler';

  // Component wrappers (single JSX return)
  if (metadata?.jsxChildren?.length === 1 && metadata?.complexity < 20) {
    return 'component-wrapper';
  }

  // Factory instances
  if (metadata?.isFactoryGenerated) return 'factory-instance';

  // Hooks
  if (/^use[A-Z].*Provider$/.test(metadata?.name || '')) return 'hook-provider';
  if (/^use[A-Z]/.test(metadata?.name || '')) return 'hook-consumer';

  // Event handlers
  if (/^(handle|on)[A-Z]/.test(metadata?.name || '')) return 'event-handler';

  // Schema generators
  if (/Schema$/.test(metadata?.name || '') && /JsonLd|z\.object/.test(text)) {
    return 'schema-generator';
  }

  // Default
  return 'business-logic';
}

// extractors/domain.ts
export function extractDomain(filepath: string): DomainContext {
  const patterns: [RegExp, string, 'core' | 'domain' | 'ui' | 'integration'][] = [
    [/\/features\/(\w+)\//, '$1', 'domain'],
    [/\/lib\/@(\w+)\//, '$1', 'core'],
    [/\/components\/(\w+)\//, '$1', 'ui'],
    [/\/integrations\/(\w+)\//, '$1', 'integration'],
    [/\/routers\/(\w+)\//, '$1', 'domain'],
  ];

  for (const [pattern, replacement, layer] of patterns) {
    const match = filepath.match(pattern);
    if (match) {
      return {
        domain: match[1] || null,
        layer,
        feature: match[2],
      };
    }
  }

  return { domain: null, layer: 'core' };
}
```

---

## Stage 3: Content Deduplication

```typescript
// stages/deduplication.ts

import { generateFingerprint } from '@/lib/@ast/fingerprint';

interface DedupConfig {
  /** Use content-based deduplication */
  byContent: boolean;
  /** Minimum similarity for grouping */
  minSimilarity: number;
  /** Also check semantic similarity (call graph) */
  useSemantic: boolean;
}

const DEFAULT_DEDUP_CONFIG: DedupConfig = {
  byContent: true,
  minSimilarity: 0.8,
  useSemantic: true,
};

interface DedupResult<T> {
  unique: T[];
  duplicates: DuplicateGroup<T>[];
  stats: {
    total: number;
    unique: number;
    duplicateGroups: number;
    duplicatesRemoved: number;
  };
}

interface DuplicateGroup<T> {
  fingerprint: string;
  representative: T;
  count: number;
  items: T[];
}

export function deduplicateFindings<T extends Finding>(
  findings: T[],
  config: Partial<DedupConfig> = {},
): DedupResult<T> {
  const cfg = { ...DEFAULT_DEDUP_CONFIG, ...config };
  const groups = new Map<string, T[]>();

  for (const finding of findings) {
    // Generate fingerprint
    const fp = generateFingerprint(finding.text).fingerprint;
    if (!fp) {
      // No fingerprint = unique
      groups.set(`unique-${finding.id}`, [finding]);
      continue;
    }

    // Check for semantic similarity if enabled
    if (cfg.useSemantic) {
      const existingGroup = findSemanticallySimilarGroup(finding, groups, cfg);
      if (existingGroup) {
        existingGroup.push(finding);
        continue;
      }
    }

    // Group by fingerprint
    const existing = groups.get(fp) ?? [];
    existing.push(finding);
    groups.set(fp, existing);
  }

  // Build result
  const unique: T[] = [];
  const duplicates: DuplicateGroup<T>[] = [];

  for (const [fingerprint, items] of groups) {
    if (items.length === 1) {
      unique.push(items[0]!);
    } else {
      duplicates.push({
        fingerprint,
        representative: items[0]!,
        count: items.length,
        items,
      });
      unique.push(items[0]!); // Keep representative
    }
  }

  return {
    unique,
    duplicates,
    stats: {
      total: findings.length,
      unique: unique.length,
      duplicateGroups: duplicates.length,
      duplicatesRemoved: findings.length - unique.length,
    },
  };
}

function findSemanticallySimilarGroup<T extends Finding>(
  finding: T,
  groups: Map<string, T[]>,
  config: DedupConfig,
): T[] | null {
  const findingCalls = finding.metadata?.calledComponents as string[] | undefined;
  if (!findingCalls?.length) return null;

  for (const [, items] of groups) {
    const firstItem = items[0];
    const itemCalls = firstItem?.metadata?.calledComponents as string[] | undefined;

    if (itemCalls?.length && arraysEqual(findingCalls, itemCalls)) {
      return items;
    }
  }

  return null;
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((v, i) => v === sortedB[i]);
}
```

---

## Stage 4: Confidence Scoring

```typescript
// stages/scoring.ts

interface ScoringContext {
  feature?: string;              // Current feature being worked on
  recentFiles?: string[];        // Recently modified files
  gitBlame?: Map<string, Date>;  // File -> last modified
}

interface ScoringConfig {
  weights: {
    ownership: number;
    freshness: number;
    relevance: number;
    complexity: number;
    actionability: number;
  };
  thresholds: {
    minConfidence: number;
    minRelevance: number;
  };
}

const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  weights: {
    ownership: 0.25,
    freshness: 0.15,
    relevance: 0.25,
    complexity: 0.20,
    actionability: 0.15,
  },
  thresholds: {
    minConfidence: 0.5,
    minRelevance: 0.3,
  },
};

export function scoreFindings<T extends Finding>(
  findings: T[],
  context: ScoringContext = {},
  config: Partial<ScoringConfig> = {},
): ScoredFinding<T>[] {
  const cfg = { ...DEFAULT_SCORING_CONFIG, ...config };

  return findings.map(finding => {
    const factors = calculateFactors(finding, context);
    const { confidence, relevance, score } = calculateScores(factors, cfg);

    return {
      finding,
      score,
      confidence,
      relevance,
      factors,
      filterResults: [],
    };
  }).sort((a, b) => b.score - a.score);
}

function calculateFactors(
  finding: Finding,
  context: ScoringContext,
): ScoringBreakdown {
  return {
    ownership: calculateOwnership(finding),
    freshness: calculateFreshness(finding, context),
    relevance: calculateRelevance(finding, context),
    complexity: calculateComplexity(finding),
    actionability: calculateActionability(finding),
  };
}

function calculateOwnership(finding: Finding): number {
  const { file } = finding;

  // Vendor code
  if (file.includes('node_modules')) return 0.0;

  // Generated code
  if (finding.metadata?.isGenerated) return 0.1;

  // Test code (lower priority)
  if (/__tests__|\.test\.|\.spec\./.test(file)) return 0.7;

  // User code
  return 1.0;
}

function calculateFreshness(
  finding: Finding,
  context: ScoringContext,
): number {
  const { recentFiles, gitBlame } = context;

  // Recently modified file
  if (recentFiles?.includes(finding.file)) return 1.2;

  // Check git blame
  if (gitBlame) {
    const lastModified = gitBlame.get(finding.file);
    if (lastModified) {
      const daysSince = (Date.now() - lastModified.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 7) return 1.2;
      if (daysSince < 30) return 1.1;
      if (daysSince > 180) return 0.9;
    }
  }

  return 1.0;
}

function calculateRelevance(
  finding: Finding,
  context: ScoringContext,
): number {
  const { feature } = context;
  if (!feature) return 1.0;

  // Check if finding is in feature directory
  const featureLower = feature.toLowerCase();
  const fileLower = finding.file.toLowerCase();

  if (fileLower.includes(`/features/${featureLower}/`)) return 1.5;
  if (fileLower.includes(`/${featureLower}/`)) return 1.3;
  if (finding.text.toLowerCase().includes(featureLower)) return 1.2;

  return 1.0;
}

function calculateComplexity(finding: Finding): number {
  const complexity = finding.metadata?.complexity as number | undefined;
  if (complexity === undefined) return 0.5;

  // Normalize complexity to 0-1 scale
  // Assuming complexity range 0-100
  return Math.min(complexity / 100, 1.0);
}

function calculateActionability(finding: Finding): number {
  // Has auto-fixer
  if (finding.metadata?.hasFixer) return 1.3;

  // Has clear fix instructions
  if (finding.metadata?.fixInstructions) return 1.2;

  // Is a known pattern
  if (finding.metadata?.pattern) return 1.1;

  return 1.0;
}

function calculateScores(
  factors: ScoringBreakdown,
  config: ScoringConfig,
): { confidence: number; relevance: number; score: number } {
  const { weights } = config;

  // Confidence is base score from ownership and complexity
  const confidence =
    factors.ownership * weights.ownership +
    factors.complexity * weights.complexity +
    0.5; // Base confidence

  // Relevance comes from context
  const relevance = factors.relevance;

  // Final score includes multipliers
  const score =
    confidence *
    factors.freshness *
    relevance *
    factors.actionability;

  return {
    confidence: Math.min(confidence, 1.0),
    relevance: Math.min(relevance, 1.0),
    score,
  };
}
```

---

## Pipeline Orchestrator

```typescript
// pipeline.ts

interface NoiseFilterConfig {
  // Stage 0: Skip
  skipPatterns?: {
    dirs?: string[];
    extensions?: string[];
    files?: string[];
  };

  // Stage 1: Generated
  excludeGenerated: boolean;
  generatedConfidenceThreshold: number;

  // Stage 2: Semantic
  semantic: {
    skipIntents: FunctionIntent[];
    allowCrossDomain: boolean;
    minComplexity: number;
  };

  // Stage 3: Deduplication
  deduplicate: boolean;
  deduplicationSimilarity: number;
  useSemantic: boolean;

  // Stage 4: Scoring
  minConfidence: number;
  minRelevance: number;

  // Output
  maxFindingsPerCategory: number;
  maxFindingsPerFile: number;
}

const DEFAULT_CONFIG: NoiseFilterConfig = {
  excludeGenerated: true,
  generatedConfidenceThreshold: 0.7,
  semantic: {
    skipIntents: ['route-handler', 'component-wrapper'],
    allowCrossDomain: false,
    minComplexity: 25,
  },
  deduplicate: true,
  deduplicationSimilarity: 0.8,
  useSemantic: true,
  minConfidence: 0.5,
  minRelevance: 0.3,
  maxFindingsPerCategory: 20,
  maxFindingsPerFile: 5,
};

interface FilteredResult<T extends Finding> {
  findings: ScoredFinding<T>[];
  stats: PipelineStats;
  removed: RemovedFindings<T>;
}

interface PipelineStats {
  input: number;
  afterSkip: number;
  afterGenerated: number;
  afterSemantic: number;
  afterDedup: number;
  afterScoring: number;
  output: number;
  timing: {
    total: number;
    skip: number;
    generated: number;
    semantic: number;
    dedup: number;
    scoring: number;
  };
}

interface RemovedFindings<T> {
  skipped: T[];
  generated: T[];
  semantic: T[];
  duplicates: DuplicateGroup<T>[];
  lowConfidence: T[];
}

export function filterNoise<T extends Finding>(
  findings: T[],
  config: Partial<NoiseFilterConfig> = {},
  context: ScoringContext = {},
): FilteredResult<T> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const startTime = performance.now();
  const timing: PipelineStats['timing'] = {} as any;

  let current = findings;
  const removed: RemovedFindings<T> = {
    skipped: [],
    generated: [],
    semantic: [],
    duplicates: [],
    lowConfidence: [],
  };

  // Stage 0: Skip
  const skipStart = performance.now();
  const afterSkip = current.filter(f => {
    if (shouldSkip(f.file)) {
      removed.skipped.push(f);
      return false;
    }
    return true;
  });
  timing.skip = performance.now() - skipStart;

  // Stage 1: Generated
  const genStart = performance.now();
  const afterGenerated = cfg.excludeGenerated
    ? afterSkip.filter(f => {
        const result = detectGeneratedFile(f.file, f.text);
        if (result.isGenerated && result.confidence >= cfg.generatedConfidenceThreshold) {
          removed.generated.push(f);
          return false;
        }
        return true;
      })
    : afterSkip;
  timing.generated = performance.now() - genStart;

  // Stage 2: Semantic
  const semStart = performance.now();
  const afterSemantic = afterGenerated.filter(f => {
    const result = applySemanticFilter(f, afterGenerated, cfg.semantic);
    if (!result.passed) {
      removed.semantic.push(f);
      return false;
    }
    return true;
  });
  timing.semantic = performance.now() - semStart;

  // Stage 3: Deduplication
  const dedupStart = performance.now();
  const dedupResult = cfg.deduplicate
    ? deduplicateFindings(afterSemantic, {
        minSimilarity: cfg.deduplicationSimilarity,
        useSemantic: cfg.useSemantic,
      })
    : { unique: afterSemantic, duplicates: [] };
  removed.duplicates = dedupResult.duplicates;
  timing.dedup = performance.now() - dedupStart;

  // Stage 4: Scoring
  const scoreStart = performance.now();
  const scored = scoreFindings(dedupResult.unique, context);
  const afterScoring = scored.filter(s => {
    if (s.confidence < cfg.minConfidence || s.relevance < cfg.minRelevance) {
      removed.lowConfidence.push(s.finding);
      return false;
    }
    return true;
  });
  timing.scoring = performance.now() - scoreStart;

  // Apply limits
  const output = applyLimits(afterScoring, cfg);

  timing.total = performance.now() - startTime;

  return {
    findings: output,
    stats: {
      input: findings.length,
      afterSkip: afterSkip.length,
      afterGenerated: afterGenerated.length,
      afterSemantic: afterSemantic.length,
      afterDedup: dedupResult.unique.length,
      afterScoring: afterScoring.length,
      output: output.length,
      timing,
    },
    removed,
  };
}

function applyLimits<T extends Finding>(
  findings: ScoredFinding<T>[],
  config: NoiseFilterConfig,
): ScoredFinding<T>[] {
  // Group by category
  const byCategory = new Map<string, ScoredFinding<T>[]>();
  const byFile = new Map<string, number>();

  const result: ScoredFinding<T>[] = [];

  for (const finding of findings) {
    const category = finding.finding.type;
    const file = finding.finding.file;

    // Check category limit
    const categoryCount = byCategory.get(category)?.length ?? 0;
    if (categoryCount >= config.maxFindingsPerCategory) continue;

    // Check file limit
    const fileCount = byFile.get(file) ?? 0;
    if (fileCount >= config.maxFindingsPerFile) continue;

    // Add to result
    result.push(finding);

    const existing = byCategory.get(category) ?? [];
    existing.push(finding);
    byCategory.set(category, existing);

    byFile.set(file, fileCount + 1);
  }

  return result;
}
```

---

## Public API

```typescript
// index.ts

export { filterNoise } from './pipeline';
export type {
  NoiseFilterConfig,
  FilteredResult,
  PipelineStats
} from './pipeline';

export { detectGeneratedFile, isGeneratedFile } from './stages/generated';
export { applySemanticFilter } from './stages/semantic';
export { deduplicateFindings } from './stages/deduplication';
export { scoreFindings } from './stages/scoring';

export { detectIntent } from './extractors/intent';
export { extractDomain } from './extractors/domain';

export type {
  Finding,
  FindingType,
  ScoredFinding,
  ScoringBreakdown,
  FunctionIntent,
  DomainContext,
  DuplicateGroup,
} from './types';
```

---

## Integration Examples

### In `refactor` command (duplicates)

```typescript
// commands/refactor/analyzers/core/duplicates/analyzer.ts

import { filterNoise } from '@/lib/@detectors/noise-filter';

// After finding duplicates, filter noise
const rawDuplicates: Finding[] = duplicates.map(d => ({
  id: `dup-${d.name}`,
  type: 'structural-clone',
  file: d.locations[0].file,
  line: d.locations[0].line,
  text: d.name,
  metadata: {
    similarity: d.similarity,
    locations: d.locations,
    complexity: d.complexity,
  },
}));

const { findings: filtered } = filterNoise(rawDuplicates, {
  semantic: {
    skipIntents: ['route-handler', 'component-wrapper', 'factory-instance'],
    minComplexity: 25,
  },
});

return filtered.map(f => f.finding.metadata as DuplicateInfo);
```

### In `context` command (TODOs)

```typescript
// commands/context/index.ts

import { filterNoise } from '@/lib/@detectors/noise-filter';

const rawTodos = extractTodos(projectRoot);
const { findings: todos } = filterNoise(rawTodos, {
  excludeGenerated: true,
  deduplicate: true,
  minConfidence: 0.5,
}, { feature: options.feature });

aiData.todos = todos.map(s => s.finding);
```

### In `status` command

```typescript
// commands/status/todos.ts

import { filterNoise } from '@/lib/@detectors/noise-filter';

const allTodos = await findTodos(projectRoot);
const { findings, stats } = filterNoise(allTodos);

console.log(`Found ${stats.input} TODOs, showing ${stats.output} relevant`);
console.log(`Filtered: ${stats.input - stats.output} (generated: ${removed.generated.length})`);
```

---

## Success Metrics

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| False positive rate | ~5% | <0.1% | ✅ |
| Prisma TODOs in report | 3+ | 0 | ✅ |
| Duplicate findings | Many | Collapsed | ✅ |
| page.tsx false positives | 20+ | 0 | ✅ |
| Relevance sorting | No | Yes | ✅ |
| Pipeline overhead | N/A | <100ms | ✅ |

---

## Implementation Plan

| Phase | Scope | Lines | Priority |
|-------|-------|-------|----------|
| **1** | `stages/skip.ts` + `stages/generated.ts` | ~150 | P0 |
| **2** | `stages/semantic.ts` + extractors | ~200 | P0 |
| **3** | `stages/deduplication.ts` | ~100 | P1 |
| **4** | `stages/scoring.ts` | ~150 | P1 |
| **5** | `pipeline.ts` + `index.ts` | ~100 | P1 |
| **6** | Integration (refactor, context, status) | ~50 | P2 |
| **7** | Tests | ~200 | P2 |

**Total: ~950 lines of new code**

---

## Testing Strategy

```typescript
describe('NoiseFilterPipeline', () => {
  describe('Stage 1: Generated', () => {
    it('should detect Prisma generated files', () => {
      const result = detectGeneratedFile('prisma/client/index.ts', '// Prisma Client');
      expect(result.isGenerated).toBe(true);
      expect(result.generator).toBe('prisma');
    });
  });

  describe('Stage 2: Semantic', () => {
    it('should skip page.tsx route handlers', () => {
      const finding = createFinding('/app/panel/page.tsx', 'PanelPage');
      const result = applySemanticFilter(finding, []);
      expect(result.passed).toBe(false);
      expect(result.intent).toBe('route-handler');
    });

    it('should skip component wrappers', () => {
      const finding = createFinding('/components/Provider.tsx', 'Provider', {
        jsxChildren: ['ChildComponent'],
        complexity: 15,
      });
      const result = applySemanticFilter(finding, []);
      expect(result.passed).toBe(false);
      expect(result.intent).toBe('component-wrapper');
    });
  });

  describe('Full Pipeline', () => {
    it('should achieve 100% precision on piternow-wt-fix', async () => {
      const findings = await extractAllFindings('/path/to/piternow-wt-fix');
      const { findings: filtered, stats } = filterNoise(findings);

      // No known false positives
      const falsePositivePatterns = [
        /BusinessPage.*ListsPage.*PanelPage/,
        /FavoritesPage.*CustomersPage/,
      ];

      for (const fp of filtered) {
        for (const pattern of falsePositivePatterns) {
          expect(fp.finding.text).not.toMatch(pattern);
        }
      }
    });
  });
});
```
