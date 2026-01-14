---
"@anatolykoptev/krolik-cli": minor
---

feat(refactor): add Toma-based semantic clone detection

Adds fast token-based semantic clone detection for the refactor command:

- **@toma library**: Abstract token sequences (V=Variable, F=Function, T=Type, etc.)
  - 6 similarity metrics: Jaccard, Dice, Jaro, Jaro-Winkler, Cosine, LCS
  - O(n) hash-based Phase 1 (enabled by default)
  - O(n²) fuzzy Phase 2 (deep mode only)

- **semantic-clones.ts**: Two-phase detection strategy
  - Phase 1: Hash-based exact semantic matches (84ms for 1646 functions)
  - Phase 2: Fuzzy matching with similarity threshold (0.92+)
  - Wrapper function filter to reduce false positives
  - Cluster size limiting (MAX_CLUSTER_SIZE=3)

- **Performance**: 65x faster than ML-based approach
  - Phase 1: O(n), ~84ms — enabled by default
  - Phase 2: O(n²) — only in deep mode

Example detection: `useSberbankIntegration` / `useTinkoffIntegration` with identical abstract structure.
