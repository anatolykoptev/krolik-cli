# Google-Level Agent Selection Architecture

**Status**: Implementation Plan
**Priority**: High
**Estimated Complexity**: Medium (uses existing infrastructure)

## Problem Statement

Current agent selection uses hardcoded `primaryAgents` lists and primitive keyword matching, resulting in:
- Same agents recommended for similar tasks
- No project context awareness (tech stack, monorepo structure)
- No learning from past successful agent executions
- Deterministic behavior (no intelligence)

## Goal

Implement Google-level dynamic agent selection that:
1. Considers project context (tech stack, type, features)
2. Learns from execution history (success patterns)
3. Uses smart scoring (keyword + context + history)
4. Provides transparent reasoning for recommendations

## Architecture: Hybrid Approach

### Design Principles

1. **No External Dependencies**: Use existing krolik infrastructure (memory, Context7 query-docs, project detection)
2. **Graceful Degradation**: Works without memory history or Context7
3. **Transparent**: Expose reasoning for agent selection
4. **Fast**: Keyword pre-filtering (0ms), smart ranking (<50ms)

### Three-Stage Pipeline

```
Task Input
   ↓
[Stage 1: Keyword Pre-filtering]  ← 0ms (in-memory)
   → Top 20 agents by keyword match
   ↓
[Stage 2: Context Boosting]       ← 10ms (project detection)
   → Boost agents matching tech stack/project type
   ↓
[Stage 3: History Boosting]       ← 30ms (memory FTS5)
   → Boost agents successful in similar features
   ↓
Final Ranking (Top 5)
```

## Implementation Plan

### Phase 1: Project Context Detector

**Goal**: Detect project characteristics for agent boosting

**Files**:
- `src/lib/@context/project-profile.ts` (new)

**Implementation**:

```typescript
// lib/@context/project-profile.ts
import { detectAll } from '@/config/detect';
import { detectMonorepoPackages } from '@/config/detect';

export interface ProjectProfile {
  techStack: string[];          // ['nextjs', 'react', 'prisma', 'trpc']
  type: 'monorepo' | 'single';  // From package structure
  features: string[];            // From krolik_context (booking, auth, etc)
  language: 'typescript' | 'javascript';
}

export function detectProjectProfile(projectRoot: string): ProjectProfile {
  const detected = detectAll(projectRoot);
  const packages = detectMonorepoPackages(projectRoot);

  return {
    techStack: extractTechStack(detected),
    type: packages.length > 1 ? 'monorepo' : 'single',
    features: detected.features,
    language: detected.hasTypeScript ? 'typescript' : 'javascript',
  };
}

function extractTechStack(detected: ReturnType<typeof detectAll>): string[] {
  const stack: string[] = [];

  if (detected.hasNext) stack.push('nextjs');
  if (detected.hasReact) stack.push('react');
  if (detected.hasPrisma) stack.push('prisma');
  if (detected.hasTrpc) stack.push('trpc');
  if (detected.hasTypeScript) stack.push('typescript');
  // ... more detection

  return stack;
}
```

**Tests**:
- Unit tests for tech stack detection
- Monorepo vs single project detection

**Time**: 4-6 hours

---

### Phase 2: Agent Capabilities Parsing

**Goal**: Create searchable index of agent capabilities from descriptions

**Files**:
- `src/commands/agent/capabilities/index.ts` (new)
- `src/commands/agent/capabilities/parser.ts` (new)
- `.krolik/agent-capabilities.json` (generated)

**Implementation**:

```typescript
// commands/agent/capabilities/parser.ts
export interface AgentCapabilities {
  name: string;
  description: string;
  category: AgentCategory;
  plugin: string;

  // Parsed from description
  keywords: string[];           // ['security', 'audit', 'xss', 'sql injection']
  techStack: string[];          // ['prisma', 'trpc', 'nextjs'] if mentioned
  projectTypes: string[];       // ['monorepo', 'fullstack', 'backend-only']

  // Metadata
  model: 'sonnet' | 'opus' | 'haiku' | 'inherit';
  filePath: string;
}

export function parseAgentCapabilities(
  agent: AgentDefinition
): AgentCapabilities {
  const description = agent.description.toLowerCase();

  return {
    name: agent.name,
    description: agent.description,
    category: agent.category,
    plugin: agent.plugin,
    keywords: extractKeywords(description),
    techStack: extractTechStack(description),
    projectTypes: inferProjectTypes(agent.category, description),
    model: agent.model ?? 'inherit',
    filePath: agent.filePath,
  };
}

function extractKeywords(description: string): string[] {
  // Extract nouns, verbs, tech terms from description
  const words = description.split(/\s+/);
  const keywords: string[] = [];

  const techTerms = ['api', 'rest', 'graphql', 'microservice', 'security', 'performance', 'prisma', 'trpc'];

  for (const word of words) {
    if (techTerms.some(term => word.includes(term))) {
      keywords.push(word);
    }
  }

  return [...new Set(keywords)];
}

function extractTechStack(description: string): string[] {
  const stack: string[] = [];

  if (/next\.?js|nextjs/i.test(description)) stack.push('nextjs');
  if (/react/i.test(description)) stack.push('react');
  if (/prisma/i.test(description)) stack.push('prisma');
  if (/trpc/i.test(description)) stack.push('trpc');
  if (/typescript/i.test(description)) stack.push('typescript');
  // ... more patterns

  return stack;
}

function inferProjectTypes(category: string, description: string): string[] {
  const types: string[] = [];

  // Category-based inference
  if (category === 'architecture' || category === 'backend') {
    types.push('backend', 'fullstack');
  }
  if (category === 'frontend') {
    types.push('frontend', 'fullstack');
  }

  // Description-based
  if (/monorepo|lerna|turborepo/i.test(description)) {
    types.push('monorepo');
  }

  return types;
}
```

**Generation Script**:

```typescript
// commands/agent/capabilities/generate.ts
export async function generateCapabilitiesIndex(
  agentsPath: string
): Promise<void> {
  const allAgents = loadAllAgents(agentsPath);
  const capabilities = allAgents.map(parseAgentCapabilities);

  // Save to .krolik/agent-capabilities.json (user scope)
  const indexPath = getKrolikFilePath(
    'agent-capabilities.json',
    'user'
  );

  writeJson(indexPath, capabilities, 2);
  logger.info(`Generated capabilities for ${capabilities.length} agents`);
}
```

**CLI Command**:
```bash
krolik agent --update  # Auto-generates capabilities index
```

**Tests**:
- Keyword extraction accuracy
- Tech stack detection from descriptions
- Project type inference

**Time**: 6-8 hours

---

### Phase 3: Success History Analyzer

**Goal**: Query memory for past successful agent executions

**Files**:
- `src/commands/agent/selection/history.ts` (new)

**Implementation**:

```typescript
// commands/agent/selection/history.ts
import { search as searchMemory } from '@/lib/@storage/memory';

export interface AgentSuccessHistory {
  agentName: string;
  executionCount: number;
  recentUses: number;           // Last 30 days
  features: string[];           // Which features it was used for
  successScore: number;         // 0-100 (based on frequency + recency)
}

export function getAgentSuccessHistory(
  projectRoot: string,
  feature?: string
): Map<string, AgentSuccessHistory> {
  const projectName = path.basename(projectRoot);

  // Search memory for agent executions
  const memories = searchMemory({
    project: projectName,
    tags: ['agent'],
    limit: 1000,
  });

  const historyMap = new Map<string, AgentSuccessHistory>();
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

  for (const mem of memories) {
    const agentTag = mem.memory.tags.find(t =>
      t !== 'agent' && mem.memory.tags.includes('agent')
    );
    if (!agentTag) continue;

    const existing = historyMap.get(agentTag) ?? {
      agentName: agentTag,
      executionCount: 0,
      recentUses: 0,
      features: [],
      successScore: 0,
    };

    existing.executionCount++;

    const createdAt = new Date(mem.memory.createdAt).getTime();
    if (createdAt > thirtyDaysAgo) {
      existing.recentUses++;
    }

    // Track features
    if (mem.memory.features) {
      for (const f of mem.memory.features) {
        if (!existing.features.includes(f)) {
          existing.features.push(f);
        }
      }
    }

    historyMap.set(agentTag, existing);
  }

  // Calculate success scores
  for (const [name, hist] of historyMap) {
    // Score = recency (60%) + frequency (40%)
    const recencyScore = Math.min(hist.recentUses / 10, 1) * 60;
    const frequencyScore = Math.min(hist.executionCount / 20, 1) * 40;
    hist.successScore = recencyScore + frequencyScore;
  }

  return historyMap;
}
```

**Tests**:
- Memory search for agent tags
- Success score calculation
- Feature matching

**Time**: 4-5 hours

---

### Phase 4: Smart Scoring System

**Goal**: Replace primitive keyword matching with weighted scoring

**Files**:
- `src/commands/agent/selection/scoring.ts` (new)
- Update: `src/commands/agent/orchestrator/task-analysis.ts`

**Implementation**:

```typescript
// commands/agent/selection/scoring.ts
export interface ScoredAgent {
  agent: AgentCapabilities;
  score: number;
  breakdown: ScoreBreakdown;
}

export interface ScoreBreakdown {
  keywordMatch: number;      // 0-40 points
  contextBoost: number;      // 0-30 points
  historyBoost: number;      // 0-20 points
  freshnessBonus: number;    // 0-10 points
  total: number;             // 0-100 points
}

export function scoreAgents(
  task: string,
  capabilities: AgentCapabilities[],
  projectProfile: ProjectProfile,
  history: Map<string, AgentSuccessHistory>,
  currentFeature?: string
): ScoredAgent[] {
  const normalizedTask = task.toLowerCase();

  return capabilities.map(agent => {
    const breakdown: ScoreBreakdown = {
      keywordMatch: scoreKeywordMatch(agent.keywords, normalizedTask),
      contextBoost: scoreContextMatch(agent, projectProfile),
      historyBoost: scoreHistory(agent, history, currentFeature),
      freshnessBonus: scoreFreshness(agent, history),
      total: 0,
    };

    breakdown.total =
      breakdown.keywordMatch +
      breakdown.contextBoost +
      breakdown.historyBoost +
      breakdown.freshnessBonus;

    return {
      agent,
      score: breakdown.total,
      breakdown,
    };
  }).sort((a, b) => b.score - a.score);
}

function scoreKeywordMatch(
  keywords: string[],
  task: string
): number {
  let matches = 0;
  for (const kw of keywords) {
    if (task.includes(kw)) {
      matches++;
    }
  }

  // 40 points max, diminishing returns
  return Math.min(matches * 8, 40);
}

function scoreContextMatch(
  agent: AgentCapabilities,
  profile: ProjectProfile
): number {
  let score = 0;

  // Tech stack match (15 points)
  const techMatches = agent.techStack.filter(t =>
    profile.techStack.includes(t)
  ).length;
  score += Math.min(techMatches * 5, 15);

  // Project type match (15 points)
  if (agent.projectTypes.includes(profile.type)) {
    score += 15;
  }

  return Math.min(score, 30);
}

function scoreHistory(
  agent: AgentCapabilities,
  history: Map<string, AgentSuccessHistory>,
  currentFeature?: string
): number {
  const hist = history.get(agent.name);
  if (!hist) return 0;

  let score = hist.successScore * 0.15; // 0-15 points from success score

  // Feature match bonus (5 points)
  if (currentFeature && hist.features.includes(currentFeature)) {
    score += 5;
  }

  return Math.min(score, 20);
}

function scoreFreshness(
  agent: AgentCapabilities,
  history: Map<string, AgentSuccessHistory>
): number {
  const hist = history.get(agent.name);
  if (!hist) return 0;

  // Agents used recently get small bonus
  return hist.recentUses > 0 ? 10 : 0;
}
```

**Tests**:
- Keyword scoring accuracy
- Context boost calculations
- History boost from memory
- Integration test with real agents

**Time**: 5-6 hours

---

### Phase 5: Integration & Orchestrator Update

**Goal**: Integrate smart selection into orchestrator

**Files**:
- Update: `src/commands/agent/orchestrator/execution-plan.ts`
- Update: `src/commands/agent/orchestrator/task-analysis.ts`
- New: `src/commands/agent/selection/index.ts`

**Implementation**:

```typescript
// commands/agent/selection/index.ts
export async function selectAgents(
  task: string,
  projectRoot: string,
  agentsPath: string,
  options: {
    currentFeature?: string;
    maxAgents?: number;
    minScore?: number;
  } = {}
): Promise<ScoredAgent[]> {
  const { currentFeature, maxAgents = 5, minScore = 20 } = options;

  // 1. Load agent capabilities (cached)
  const capabilities = await loadCapabilitiesIndex(agentsPath);

  // 2. Detect project profile (cached 5s)
  const profile = detectProjectProfile(projectRoot);

  // 3. Load success history from memory
  const history = getAgentSuccessHistory(projectRoot, currentFeature);

  // 4. Score all agents
  const scored = scoreAgents(
    task,
    capabilities,
    profile,
    history,
    currentFeature
  );

  // 5. Filter by minimum score and limit
  return scored
    .filter(s => s.score >= minScore)
    .slice(0, maxAgents);
}

async function loadCapabilitiesIndex(
  agentsPath: string
): Promise<AgentCapabilities[]> {
  const indexPath = getKrolikFilePath('agent-capabilities.json', 'user');

  if (!exists(indexPath)) {
    // Auto-generate on first use
    await generateCapabilitiesIndex(agentsPath);
  }

  const data = readJson<AgentCapabilities[]>(indexPath);
  return data ?? [];
}
```

**Update execution-plan.ts**:

```typescript
// Before (hardcoded):
const primaryAgents = agents.filter(a =>
  categoryInfo.primaryAgents.includes(a.name)
);
const agentsToAdd = primaryAgents.slice(0, 2);

// After (smart selection):
const scored = await selectAgents(
  analysis.task,
  projectRoot,
  agentsPath,
  { currentFeature, maxAgents: 5 }
);
const agentsToAdd = scored.map(s => s.agent);
```

**Tests**:
- End-to-end orchestration test
- Reasoning output verification
- Performance benchmark (<100ms)

**Time**: 4-5 hours

---

### Phase 6: Transparency & Debugging

**Goal**: Expose reasoning for agent recommendations

**Files**:
- `src/commands/agent/orchestrator/formatters.ts` (update)

**Implementation**:

Add reasoning to orchestration output:

```xml
<agent-recommendation name="backend-architect" score="85">
  <reasoning>
    <keyword-match score="32">Matched: architecture, system, design</keyword-match>
    <context-boost score="25">Tech stack: nextjs, prisma, trpc (3 matches)</context-boost>
    <history-boost score="18">Used 5 times in last 30 days for similar features</history-boost>
    <freshness-bonus score="10">Recently used</freshness-bonus>
  </reasoning>
</agent-recommendation>
```

**CLI Flag**:
```bash
krolik agent --orchestrate --task "..." --debug-selection
```

**Time**: 2-3 hours

---

## Testing Strategy

### Unit Tests

1. **Project profile detection**:
   - Tech stack extraction
   - Monorepo vs single detection

2. **Agent capabilities parsing**:
   - Keyword extraction accuracy
   - Tech stack detection from descriptions

3. **Success history**:
   - Memory query correctness
   - Score calculation

4. **Scoring system**:
   - Keyword match scoring
   - Context boost calculation
   - History boost from memory

### Integration Tests

1. **End-to-end agent selection**:
   - With and without memory history
   - With and without project context
   - Performance benchmarks

2. **Orchestration**:
   - Multi-agent selection
   - Reasoning output format

### Manual Testing

1. **Real projects**:
   - Test on krolik-cli itself
   - Test on piternow-wt-fix
   - Compare old vs new recommendations

## Performance Requirements

- **Project profile detection**: <50ms (cached)
- **Capabilities loading**: <10ms (cached JSON)
- **Memory history query**: <30ms (FTS5)
- **Scoring calculation**: <10ms (in-memory)
- **Total selection time**: <100ms

## Migration Strategy

### Phase 1: Parallel Mode (Safe)

Add `--smart-selection` flag:
```bash
krolik agent --orchestrate --smart-selection
```

Keep old keyword matching as default initially.

### Phase 2: Smart by Default

After 1 week of testing, make smart selection default:
```bash
krolik agent --orchestrate  # Uses smart selection
krolik agent --orchestrate --legacy  # Old keyword matching
```

### Phase 3: Remove Legacy

After 1 month, remove old keyword matching entirely.

## Success Metrics

1. **Relevance**: User satisfaction with recommended agents
2. **Diversity**: Different agents recommended for different tasks
3. **Performance**: <100ms selection time
4. **Accuracy**: >80% of top-3 recommendations are relevant

## Future Enhancements

### Phase 7 (Optional): Context7 Query-Docs Integration

Instead of embeddings, use Context7's query-docs to search agent descriptions:

```typescript
// Optional enhancement
async function semanticAgentSearch(
  task: string,
  capabilities: AgentCapabilities[]
): Promise<ScoredAgent[]> {
  // Create virtual "library" from agent descriptions
  const agentDocs = capabilities.map(c => ({
    id: c.name,
    content: c.description,
  }));

  // Use Context7 query-docs for semantic search
  const results = await queryDocs({
    libraryId: 'krolik-agents',
    query: task,
  });

  // Boost agents from semantic results
  return capabilities.map(agent => {
    const semanticMatch = results.find(r => r.id === agent.name);
    const semanticBoost = semanticMatch ? semanticMatch.score * 20 : 0;

    return {
      agent,
      score: agent.score + semanticBoost,
    };
  });
}
```

**Benefit**: Semantic understanding without embeddings API
**Cost**: Additional Context7 API calls
**Decision**: Implement only if keyword+context+history is insufficient

---

## Total Time Estimate

| Phase | Hours |
|-------|-------|
| Phase 1: Project Context | 4-6 |
| Phase 2: Capabilities Parsing | 6-8 |
| Phase 3: Success History | 4-5 |
| Phase 4: Smart Scoring | 5-6 |
| Phase 5: Integration | 4-5 |
| Phase 6: Transparency | 2-3 |
| **Total** | **25-33 hours** |

Spread over 1-2 weeks with testing.

## GitHub Issues

Create issues for each phase:

- [ ] #XX: Phase 1 - Project context detector
- [ ] #XX: Phase 2 - Agent capabilities parsing
- [ ] #XX: Phase 3 - Success history analyzer
- [ ] #XX: Phase 4 - Smart scoring system
- [ ] #XX: Phase 5 - Orchestrator integration
- [ ] #XX: Phase 6 - Reasoning transparency

## Notes

- No OpenAI dependency (uses existing krolik infrastructure)
- Graceful degradation (works without memory/Context7)
- Fast (all operations cached or in-memory)
- Transparent (reasoning exposed)
- Testable (comprehensive unit + integration tests)
