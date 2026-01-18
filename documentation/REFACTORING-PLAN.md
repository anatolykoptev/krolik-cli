# Ralph Model System Refactoring Plan

## 🔍 Current State Analysis

### Architecture Overview

```
@ralph/
├── router/
│   ├── models.config.ts      ← NEW: Single Source of Truth (ProviderType, MODEL_DEFINITIONS)
│   ├── model-tiers.ts        ← Generates from models.config.ts
│   └── types.ts              ← Defines ModelProvider (duplicate!)
└── models/
    ├── model-config.ts       ← OLD: Provider detection (ModelProvider, PROVIDERS)
    ├── llm-factory.ts        ← Factory with hardcoded switch/case
    ├── vibeproxy-llm.ts      ← New VibeProxy provider
    ├── groq-llm.ts
    ├── claude-llm.ts
    └── ...
```

### 🔴 Critical Problems

#### 1. Type Duplication & Inconsistency

**Problem:**
- `ProviderType` in `models.config.ts` includes `vibeproxy`
- `ModelProvider` in `types.ts` DOES NOT include `vibeproxy`
- `ModelProvider` in `model-config.ts` DOES NOT include `vibeproxy`

**Impact:**
- Type errors when using VibeProxy models
- Router and Factory use different types for same concept
- Inconsistent across codebase

#### 2. Hardcoded Model Names

**Problem:**
```typescript
// types.ts - manually maintained
export type ModelName =
  | 'llama-70b'
  | 'haiku'
  | 'sonnet'
  // Missing: vibe-opus, vibe-sonnet, vibe-sonnet-fast, gemini-3-pro!
```

**Impact:**
- New models must be manually added in 2 places
- Easy to forget, causes type errors
- Not generated from Single Source of Truth

#### 3. Dual Provider Configuration

**Problem:**
```typescript
// models.config.ts
export const PROVIDER_DEFINITIONS: ProviderDefinition[] = [
  { id: 'vibeproxy', ... }, // NEW system
]

// model-config.ts
export const PROVIDERS: ProviderDefinition[] = [
  // vibeproxy missing! OLD system
]
```

**Impact:**
- Two sources of truth for providers
- model-config.ts doesn't know about VibeProxy
- Confusing for developers

#### 4. Non-extensible Factory

**Problem:**
```typescript
// llm-factory.ts
private createApiInstance(provider: ModelProvider, model: string): BaseLlm {
  switch (provider) {
    case 'anthropic': return new ClaudeLlm({ model });
    case 'google': return new Gemini({ model });
    case 'groq': return new GroqLlm({ model });
    case 'vibeproxy': return new VibeProxyLlm({ model });
    // Must edit switch/case for every new provider!
    default: throw new Error(...);
  }
}
```

**Impact:**
- Not extensible - must modify factory for each provider
- Violates Open/Closed Principle
- Tight coupling

## ✅ Solution: Dynamic Provider Registry

### 1. Unified Type System

**Create `@ralph/shared/types.ts`:**

```typescript
/**
 * Provider types - sync with models.config.ts
 * This is the canonical type used everywhere
 */
export type ProviderType =
  | 'anthropic'
  | 'google'
  | 'groq'
  | 'openai'
  | 'ollama'
  | 'mistral'
  | 'vibeproxy';

/** Alias for backward compatibility */
export type ModelProvider = ProviderType;

/** Model tier */
export type ModelTier = 'free' | 'cheap' | 'mid' | 'premium';
```

**Update all files to import from shared:**
```typescript
// Before
import { ModelProvider } from './types';
import { ProviderType } from './models.config';

// After
import { ProviderType } from '@ralph/shared/types';
```

### 2. Generate ModelName from Config

**In `router/types.ts`:**

```typescript
import { getEnabledModels } from './models.config';

// Generate ModelName from config at compile time
export type ModelName = ReturnType<typeof getEnabledModels>[number]['id'];

// OR keep manual but add comment:
export type ModelName =
  // Auto-sync with models.config.ts MODEL_DEFINITIONS
  | 'vibe-opus'           // VibeProxy
  | 'vibe-sonnet'
  | 'vibe-sonnet-fast'
  | 'gemini-3-pro'
  | 'llama-70b'           // Groq
  | 'llama-8b'
  | 'mixtral'
  | 'deepseek-r1'
  | 'haiku'               // Anthropic
  | 'sonnet'
  | 'opus'
  | 'flash'               // Google
  | 'pro'
  | 'thinking'
  | 'gpt-4o-mini'         // OpenAI
  | 'gpt-4o'
  | 'o1';
```

### 3. Merge Provider Definitions

**Delete `models/model-config.ts` PROVIDERS:**

```typescript
// models/model-config.ts
import { PROVIDER_DEFINITIONS, type ProviderType } from '../router/models.config.js';

// Use PROVIDER_DEFINITIONS from router instead of local PROVIDERS
export function detectProvider(modelOrAlias: string): ProviderType | null {
  for (const provider of PROVIDER_DEFINITIONS) {
    if (provider.detectPattern.test(modelOrAlias)) {
      return provider.id;
    }
  }
  return null;
}
```

### 4. Provider Registry Pattern

**Create `models/provider-registry.ts`:**

```typescript
import type { BaseLlm } from '@google/adk';
import type { ProviderType } from '@ralph/shared/types';

/** LLM class constructor signature */
type LlmConstructor = new (params: { model: string }) => BaseLlm;

/** Provider registry - maps provider to LLM class */
class ProviderRegistry {
  private providers = new Map<ProviderType, LlmConstructor>();

  register(provider: ProviderType, llmClass: LlmConstructor) {
    this.providers.set(provider, llmClass);
  }

  get(provider: ProviderType): LlmConstructor | undefined {
    return this.providers.get(provider);
  }

  has(provider: ProviderType): boolean {
    return this.providers.has(provider);
  }
}

export const providerRegistry = new ProviderRegistry();

// Register providers
import { ClaudeLlm } from './claude-llm.js';
import { GroqLlm } from './groq-llm.js';
import { VibeProxyLlm } from './vibeproxy-llm.js';
import { Gemini } from '@google/adk';

providerRegistry.register('anthropic', ClaudeLlm);
providerRegistry.register('google', Gemini);
providerRegistry.register('groq', GroqLlm);
providerRegistry.register('vibeproxy', VibeProxyLlm);
```

**Update `llm-factory.ts`:**

```typescript
import { providerRegistry } from './provider-registry.js';

private createApiInstance(provider: ProviderType, model: string): BaseLlm {
  const LlmClass = providerRegistry.get(provider);
  if (!LlmClass) {
    throw new Error(`API backend not supported for provider: ${provider}`);
  }
  return new LlmClass({ model });
}
```

### 5. Single Source of Truth Flow

```
models.config.ts (SSOT)
    ↓ defines
ProviderType + MODEL_DEFINITIONS
    ↓ generates
model-tiers.ts (MODEL_INFO, DEFAULT_MODELS)
    ↓ uses
types.ts (ModelName, ModelInfo)
    ↓ uses
llm-factory.ts (via provider-registry)
    ↓ creates
LLM instances
```

## 📋 Implementation Steps

### Phase 1: Type Unification (Low Risk)
1. ✅ Create `shared/types.ts` with unified `ProviderType`
2. ✅ Add type alias: `export type ModelProvider = ProviderType`
3. ✅ Update all imports to use shared types
4. ✅ Run typecheck to verify

### Phase 2: Sync Provider Definitions (Medium Risk)
1. ✅ Update `ModelProvider` in `types.ts` to include `vibeproxy`
2. ✅ Merge `PROVIDERS` from `model-config.ts` into `PROVIDER_DEFINITIONS`
3. ✅ Update `model-config.ts` to import from `models.config.ts`
4. ✅ Run tests

### Phase 3: Dynamic ModelName (Medium Risk)
1. ✅ Add all VibeProxy models to `ModelName` union in `types.ts`
2. ✅ Add comment: "// Auto-sync with models.config.ts"
3. ✅ Future: investigate type generation
4. ✅ Run typecheck

### Phase 4: Provider Registry (High Risk - Breaking)
1. ⏳ Create `provider-registry.ts`
2. ⏳ Register all LLM classes
3. ⏳ Update `llm-factory.ts` to use registry
4. ⏳ Remove switch/case
5. ⏳ Test all providers
6. ⏳ Update docs

### Phase 5: Cleanup (Low Risk)
1. ⏳ Remove duplicate provider definitions
2. ⏳ Update comments and docs
3. ⏳ Add README explaining architecture

## 🎯 Benefits

### Maintainability
- ✅ Single Source of Truth for all model config
- ✅ Add new provider: 2 edits instead of 5
- ✅ No manual type syncing

### Type Safety
- ✅ All types generated from SSOT
- ✅ Compile-time verification
- ✅ No runtime type mismatches

### Extensibility
- ✅ Add provider without modifying factory
- ✅ Plugin-like architecture
- ✅ Open/Closed Principle

### Developer Experience
- ✅ Clear, single place to add models
- ✅ Autocomplete for all models
- ✅ Self-documenting code

## 📝 Migration Checklist

- [ ] Phase 1: Type Unification
- [ ] Phase 2: Sync Provider Definitions
- [ ] Phase 3: Dynamic ModelName
- [ ] Phase 4: Provider Registry
- [ ] Phase 5: Cleanup
- [ ] Update documentation
- [ ] Run full test suite
- [ ] Test VibeProxy integration
- [ ] Commit and push

## 🔗 Related Files

### To Modify:
- `router/models.config.ts` - SSOT, keep pristine
- `router/types.ts` - Update ModelName, ModelProvider
- `models/model-config.ts` - Remove PROVIDERS, use PROVIDER_DEFINITIONS
- `models/llm-factory.ts` - Use provider registry
- `models/provider-registry.ts` - NEW, create this

### To Review:
- `router/model-tiers.ts` - Should work as-is
- `models/registry.ts` - May need updates
- `models/fallback-router.ts` - May need type updates
- `models/health-monitor.ts` - May need type updates
