# Google-Style Audit Improvements

> Based on Google Engineering Practices, Chromium Tricorder, and SWE Book Chapter 9.

## Core Principles

### 1. Zero False Positives > High Recall

**Google approach:** Better to miss a real issue than show a false one.

```
Confidence threshold: 80%+ to show by default
Low confidence: hidden unless --strict
```

### 2. Severity Levels (Google Critique Style)

| Level | Description | Action | Blocks |
|-------|-------------|--------|--------|
| `must-fix` | Security, correctness, crashes | Required before merge | Yes |
| `should-fix` | Performance, maintainability | Address this sprint | No |
| `nit` | Style, naming, formatting | Nice to fix | No |
| `optional` | Suggestions, alternatives | Consider | No |

**Current mapping:**
- `critical` → `must-fix`
- `high` → `should-fix`
- `medium` → `nit`
- `low` → `optional`

### 3. Confidence Scoring

Each issue gets a confidence score based on:

| Factor | Weight | Description |
|--------|--------|-------------|
| AST-based detection | +40% | vs regex-based |
| Context awareness | +20% | understands surrounding code |
| Historical accuracy | +20% | based on fix rate |
| Type information | +20% | has type context |

**Thresholds:**
- 80-100%: Show always
- 60-79%: Show with `--verbose`
- 0-59%: Show only with `--strict`

### 4. Readability Score

New metric based on Chromium Tricorder:

```typescript
interface ReadabilityScore {
  naming: number;      // 0-100: descriptive names, no abbreviations
  structure: number;   // 0-100: low nesting, clear flow
  comments: number;    // 0-100: useful comments, not obvious ones
  cognitive: number;   // 0-100: inverse of cognitive complexity
  overall: number;     // weighted average
}
```

**Calculation:**
- `naming`: Check for single-letter vars, unclear abbreviations
- `structure`: Nesting depth, function length, branching
- `comments`: JSDoc presence for exports, meaningful comments
- `cognitive`: SonarQube cognitive complexity (inverted to score)

### 5. Health Score Formula (Improved)

Current formula is basic. New formula:

```typescript
function calculateHealthScore(issues: Issue[]): HealthScore {
  const weights = {
    'must-fix': 10,
    'should-fix': 3,
    'nit': 1,
    'optional': 0.1,
  };

  const totalWeight = issues.reduce((sum, i) => sum + weights[i.severity], 0);
  const maxWeight = issues.length * 10; // all must-fix

  // Score from A-F
  const ratio = 1 - (totalWeight / maxWeight);
  const grade = ratio >= 0.9 ? 'A' : ratio >= 0.8 ? 'B' : ratio >= 0.7 ? 'C' :
                ratio >= 0.6 ? 'D' : 'F';

  return { score: Math.round(ratio * 100), grade, trend: compareWithPrevious() };
}
```

### 6. Trend Tracking

Store audit results in `.krolik/audit-history.json`:

```typescript
interface AuditHistory {
  timestamp: string;
  commit: string;
  score: number;
  grade: string;
  issues: {
    'must-fix': number;
    'should-fix': number;
    'nit': number;
    'optional': number;
  };
}
```

Show in output:
```xml
<health score="C" grade="72" trend="+5" vs-commit="abc123">
  Improved from D (67) since last audit
</health>
```

### 7. Smart Defaults

| Flag | Default | Description |
|------|---------|-------------|
| (none) | `must-fix` + `should-fix` | Actionable issues only |
| `--strict` | All issues | Include nits and optional |
| `--nits` | Include nits | Show style issues |
| `--all` | Everything | Include low-confidence |

### 8. Actionable Feedback (ML-Style)

For each issue, provide:

```xml
<issue severity="must-fix" confidence="95%">
  <location>src/api/auth.ts:42</location>
  <message>SQL injection vulnerability</message>
  <suggestion auto-applicable="true">
    <before>query(`SELECT * FROM users WHERE id = ${id}`)</before>
    <after>query(`SELECT * FROM users WHERE id = ?`, [id])</after>
  </suggestion>
  <rationale>User input directly in SQL query allows injection attacks</rationale>
</issue>
```

## Implementation Plan

### Phase 1: Severity & Confidence (Today)
- [ ] Add `severity` field with must-fix/should-fix/nit/optional
- [ ] Add `confidence` field to each issue (0-100)
- [ ] Filter by confidence threshold (80% default)
- [ ] Update XML output with new fields

### Phase 2: Readability Score (Next)
- [ ] Create `readability/` module in audit
- [ ] Implement naming analyzer (single-letter, abbreviations)
- [ ] Implement structure analyzer (nesting, length)
- [ ] Implement cognitive complexity (SonarQube formula)
- [ ] Add readability section to output

### Phase 3: Health Score & Trends (Then)
- [ ] Improve health score formula
- [ ] Store audit history in SQLite
- [ ] Compare with previous audit
- [ ] Show trend in output

### Phase 4: Smart Defaults (Finally)
- [ ] Change default to must-fix + should-fix only
- [ ] Add --strict, --nits, --all flags
- [ ] Update MCP tool schema

## References

- [Google Engineering Practices](https://google.github.io/eng-practices/)
- [SWE Book Chapter 9: Code Review](https://abseil.io/resources/swe-book/html/ch09.html)
- [Chromium Code Health](https://chromium.googlesource.com/chromium/src/)
- [CodeScene Biomarkers](https://codescene.com/blog/code-biomarkers/)
- [SonarQube Cognitive Complexity](https://www.sonarsource.com/resources/cognitive-complexity/)
