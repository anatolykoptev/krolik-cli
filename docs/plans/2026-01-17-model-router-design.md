# Krolik Ralph Model Router Design

## Overview

Adaptive model selection system that optimizes for quality and cost by:
1. Rule-based initial model selection from task attributes
2. History-based adjustments from past attempts
3. Cascade fallback on failure (cheap → mid → premium)

## Architecture

```
PRD Task → ModelRouter → Cascade Executor → Result
              │
    ┌─────────┴─────────┐
    │                   │
RuleEngine      HistoryAnalyzer
(static)        (from SQLite)
```

## Components

### 1. RuleEngine (`src/lib/@ralph/router/rules.ts`)

Static scoring based on task attributes:
- `complexity`: trivial=10, simple=25, moderate=50, complex=75, epic=95
- `files_affected`: +5 per file over 2
- `acceptance_criteria`: +3 per criterion over 2
- `tags`: architecture +20, security +15, lint -15, typo -25

Score thresholds:
- 0-35 → cheap (haiku/flash)
- 36-65 → mid (sonnet/pro)
- 66+ → premium (opus)

### 2. HistoryAnalyzer (`src/lib/@ralph/router/history.ts`)

Adjusts score based on `ralph_attempts` table:
- Groups tasks by signature (complexity + tags + files range)
- If cheap model failed >50% on similar tasks → raise to mid
- If cheap model succeeded >80% on harder tasks → lower to cheap
- Minimum 3 samples for decision

### 3. CascadeExecutor (`src/lib/@ralph/router/cascade.ts`)

Fallback on failure:
- `syntax/validation` errors → retry same model
- `capability` errors → escalate to next tier
- Records outcome for history learning

### 4. PRD Schema Changes

Add optional `modelPreference` per task:
```typescript
modelPreference?: {
  model?: 'haiku' | 'flash' | 'sonnet' | 'pro' | 'opus';
  minTier?: 'cheap' | 'mid' | 'premium';
  noCascade?: boolean;
}
```

### 5. CostEstimator (`src/lib/@ralph/router/cost-estimator.ts`)

Pre-execution cost estimation:
- Optimistic: all cheap, no retries
- Expected: based on history escalation rates
- Pessimistic: all escalate to opus

## CLI Commands

### New Commands

```bash
# Show model selection for each task
krolik ralph plan --prd PRD.json

# Estimate cost before execution
krolik ralph estimate --prd PRD.json

# View routing statistics
krolik ralph stats
```

### Modified Commands

```bash
# Start with auto-routing (default)
krolik ralph start --prd PRD.json

# Override with fixed model
krolik ralph start --prd PRD.json --model sonnet

# Disable cascade
krolik ralph start --prd PRD.json --no-cascade
```

## Database Schema

Add to `ralph_attempts`:
```sql
ALTER TABLE ralph_attempts ADD COLUMN signature_hash TEXT;
ALTER TABLE ralph_attempts ADD COLUMN escalated_from TEXT;
```

New table `ralph_routing_patterns`:
```sql
CREATE TABLE ralph_routing_patterns (
  id INTEGER PRIMARY KEY,
  signature_hash TEXT NOT NULL,
  model TEXT NOT NULL,
  success_count INTEGER DEFAULT 0,
  fail_count INTEGER DEFAULT 0,
  avg_cost REAL DEFAULT 0,
  last_updated TEXT,
  UNIQUE(signature_hash, model)
);
```

## Model Pricing

| Model | Input $/1M | Output $/1M |
|-------|------------|-------------|
| haiku | 0.25 | 1.25 |
| flash | 0.075 | 0.30 |
| sonnet | 3.00 | 15.00 |
| pro | 1.25 | 5.00 |
| opus | 15.00 | 75.00 |

## Implementation Order

1. Create `src/lib/@ralph/router/` module structure
2. Implement RuleEngine with scoring logic
3. Add database schema for routing patterns
4. Implement HistoryAnalyzer
5. Implement CascadeExecutor
6. Update PRD schema with modelPreference
7. Implement CostEstimator
8. Add CLI commands (plan, estimate, stats)
9. Integrate into ralph start flow
10. Add MCP tool support
