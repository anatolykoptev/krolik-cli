/**
 * @module lib/@ast/fingerprint
 * @description Structural fingerprinting for code clone detection
 *
 * Generates normalized AST fingerprints that ignore:
 * - Variable/function names (identifiers)
 * - String literal values
 * - Number literal values
 * - Comments
 *
 * This catches structural clones where only names differ:
 * ```typescript
 * // These would have the SAME fingerprint:
 * function getUser(id) { return db.find(id); }
 * function fetchItem(key) { return store.find(key); }
 * ```
 *
 * Clone Types Detected:
 * - Type-1: Exact clones (identical code)
 * - Type-2: Renamed clones (same structure, different names)
 * - Type-3: Near-miss clones (small structural changes) - partial support
 */

export {
  type CloneGroup,
  compareFingerprints,
  type FingerprintOptions,
  type FingerprintResult,
  findStructuralClones,
  generateFingerprint,
  generateFingerprintFromAst,
} from './fingerprint';

export {
  astToTokens,
  type NormalizeOptions,
  normalizeAst,
} from './normalize';
