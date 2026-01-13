---
"@anatolykoptev/krolik-cli": minor
---

feat(agent): add semantic matching for smarter agent selection

### New Features

- **Semantic Agent Matching**: Uses Xenova embeddings to find semantically similar agents
- **Graceful Fallback**: Falls back to keyword-only matching if embeddings unavailable
- **Score Transparency**: Shows semantic similarity percentage in score breakdown

### Scoring Changes

New scoring breakdown (0-100, normalized):
- Keyword match: 0-40 points (unchanged)
- **Semantic match: 0-15 points (NEW)**
- Context boost: 0-30 points (unchanged)
- History boost: 0-20 points (unchanged)
- Freshness bonus: 0-10 points (unchanged)

### How It Works

1. Task description is embedded using all-MiniLM-L6-v2 model
2. Agent descriptions are embedded and cached (in-memory)
3. Cosine similarity is calculated between task and each agent
4. Similarity thresholds determine score (calibrated for MiniLM-L6-v2):
   - 0.50+ = 15 points (very similar)
   - 0.35-0.50 = 10 points (similar)
   - 0.25-0.35 = 5 points (somewhat similar)

### Benefits

- "optimize" now finds "performance-engineer" (no keyword overlap needed)
- "fix bugs" now finds "debugger" (semantic understanding)
- Better agent recommendations for natural language queries
