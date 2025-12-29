/**
 * @module lib/@i18n/key-resolver
 * @description Key resolution with collision detection for i18n
 *
 * Handles intelligent key generation with:
 * - Existing value lookup (reuse keys for identical translations)
 * - Collision detection (same key, different value)
 * - Unique key generation with suffixes
 *
 * @example
 * ```typescript
 * import { resolveKey, createLocaleCatalog } from '@/lib/@i18n';
 *
 * const catalog = createLocaleCatalog();
 * await catalog.load('apps/web/public/locales', 'ru');
 *
 * const result = resolveKey('Сохранить', { catalog });
 * // => { key: 'common.save', isExisting: true, isNew: false }
 *
 * const newResult = resolveKey('Новый текст', { catalog, filePath: 'app/panel/events/page.tsx' });
 * // => { key: 'panel.events.novyi_tekst', isExisting: false, isNew: true }
 * ```
 */

import type { LocaleCatalog } from './catalog';
import { textToKey } from './key-builder';
import { detectNamespace } from './namespace-resolver';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Options for key resolution.
 */
export interface KeyResolverOptions {
  /** Locale catalog to check for existing keys/values */
  catalog: LocaleCatalog;
  /** Explicit namespace override (bypasses detection) */
  namespace?: string;
  /** File path for namespace detection */
  filePath?: string;
}

/**
 * Result of key resolution.
 */
export interface ResolvedKey {
  /** The resolved translation key */
  key: string;
  /** True if reusing an existing translation with same value */
  isExisting: boolean;
  /** True if this is a new translation (key doesn't exist) */
  isNew: boolean;
  /** Present if there was a collision (same key, different value) */
  collision?: {
    /** The original key that had a collision */
    existingKey: string;
    /** The existing value that differs from the new text */
    existingValue: string;
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum suffix number to try before giving up */
const MAX_SUFFIX_ATTEMPTS = 100;

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Generate a unique key by adding a numeric suffix.
 * Tries _2, _3, etc. until finding an unused key.
 */
function generateUniqueKey(baseKey: string, catalog: LocaleCatalog): string | null {
  for (let suffix = 2; suffix <= MAX_SUFFIX_ATTEMPTS; suffix++) {
    const candidateKey = `${baseKey}_${suffix}`;
    if (!catalog.hasKey(candidateKey)) {
      return candidateKey;
    }
  }

  return null;
}

/**
 * Build the full key path from namespace and key name.
 */
function buildFullKey(namespace: string, keyName: string): string {
  if (!namespace || namespace === 'common') {
    return `common.${keyName}`;
  }

  return `${namespace}.${keyName}`;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Resolves the appropriate i18n key for a given text.
 *
 * Resolution logic:
 * 1. First: Check if exact value already exists in catalog
 *    - If yes: Return the existing key (reuse)
 * 2. Then: Generate key from text using transliteration
 * 3. Check if generated key exists:
 *    - Same value: Reuse the key
 *    - Different value: Collision detected, generate unique key
 * 4. Return resolved key with metadata
 *
 * @param text - The text to create a key for
 * @param options - Resolution options
 * @returns Resolved key with metadata
 *
 * @example
 * ```typescript
 * // Reusing existing translation
 * const catalog = createLocaleCatalog();
 * await catalog.load(localesDir, 'ru');
 *
 * resolveKey('Сохранить', { catalog });
 * // => { key: 'common.save', isExisting: true, isNew: false }
 *
 * // New translation
 * resolveKey('Новый текст', { catalog, filePath: 'app/panel/page.tsx' });
 * // => { key: 'panel.novyi_tekst', isExisting: false, isNew: true }
 *
 * // Collision handling
 * resolveKey('Другой текст', { catalog, namespace: 'common' });
 * // If 'common.drugoi_tekst' exists with different value:
 * // => { key: 'common.drugoi_tekst_2', isExisting: false, isNew: true, collision: {...} }
 * ```
 */
export function resolveKey(text: string, options: KeyResolverOptions): ResolvedKey {
  const { catalog, namespace: explicitNamespace, filePath } = options;

  // Normalize text
  const normalizedText = text.trim();

  if (!normalizedText) {
    return {
      key: 'common.empty',
      isExisting: false,
      isNew: true,
    };
  }

  // Step 1: Check if exact value already exists in catalog
  const existingKey = catalog.findByValue(normalizedText);
  if (existingKey) {
    return {
      key: existingKey,
      isExisting: true,
      isNew: false,
    };
  }

  // Step 2: Determine namespace
  const namespace = explicitNamespace ?? detectNamespace(filePath ?? '');

  // Step 3: Generate key from text using transliteration
  const keyName = textToKey(normalizedText);
  const fullKey = buildFullKey(namespace, keyName);

  // Step 4: Check if generated key already exists
  if (catalog.hasKey(fullKey)) {
    const existingValue = catalog.getValue(fullKey);

    // Same value - reuse the key
    if (existingValue?.trim() === normalizedText) {
      return {
        key: fullKey,
        isExisting: true,
        isNew: false,
      };
    }

    // Different value - collision! Generate unique key
    const uniqueKey = generateUniqueKey(fullKey, catalog);

    if (!uniqueKey) {
      // Fallback: use timestamp suffix if all numeric suffixes exhausted
      const fallbackKey = `${fullKey}_${Date.now()}`;
      return {
        key: fallbackKey,
        isExisting: false,
        isNew: true,
        collision: {
          existingKey: fullKey,
          existingValue: existingValue ?? '',
        },
      };
    }

    return {
      key: uniqueKey,
      isExisting: false,
      isNew: true,
      collision: {
        existingKey: fullKey,
        existingValue: existingValue ?? '',
      },
    };
  }

  // Step 5: Key doesn't exist - it's a new translation
  return {
    key: fullKey,
    isExisting: false,
    isNew: true,
  };
}

// ============================================================================
// BATCH RESOLUTION
// ============================================================================

/**
 * Result of batch key resolution.
 */
export interface BatchResolveResult {
  /** Map of original text to resolved key */
  keys: Map<string, ResolvedKey>;
  /** Number of keys that reused existing translations */
  existingCount: number;
  /** Number of new keys created */
  newCount: number;
  /** Number of collisions encountered */
  collisionCount: number;
}

/**
 * Resolves multiple texts to keys in batch.
 *
 * This tracks newly generated keys within the batch to
 * avoid collisions between batch items. Uses catalog's
 * addTranslation method to track new keys.
 *
 * @param texts - Array of texts to resolve
 * @param options - Resolution options
 * @returns Batch resolution result
 *
 * @example
 * ```typescript
 * const catalog = createLocaleCatalog();
 * await catalog.load(localesDir, 'ru');
 *
 * const result = resolveKeys(['Сохранить', 'Отмена', 'Удалить'], {
 *   catalog,
 *   namespace: 'common',
 * });
 * // result.keys.get('Сохранить') => { key: 'common.sokhranit', ... }
 * ```
 */
export async function resolveKeys(
  texts: string[],
  options: KeyResolverOptions,
): Promise<BatchResolveResult> {
  const { catalog } = options;

  const result: BatchResolveResult = {
    keys: new Map(),
    existingCount: 0,
    newCount: 0,
    collisionCount: 0,
  };

  for (const text of texts) {
    const normalizedText = text.trim();

    // Skip empty or already processed texts
    if (!normalizedText || result.keys.has(normalizedText)) {
      continue;
    }

    const resolved = resolveKey(normalizedText, options);

    // Track result
    result.keys.set(normalizedText, resolved);

    if (resolved.isExisting) {
      result.existingCount++;
    }

    if (resolved.isNew) {
      result.newCount++;
      // Add to catalog to prevent collisions within batch
      // Note: This modifies the catalog but doesn't flush to disk
      await catalog.addTranslation(resolved.key, normalizedText);
    }

    if (resolved.collision) {
      result.collisionCount++;
    }
  }

  return result;
}

// ============================================================================
// SYNCHRONOUS BATCH RESOLUTION
// ============================================================================

/**
 * Simple key-value map for synchronous operations
 */
export type SimpleLocaleCatalog = Record<string, string>;

/**
 * Options for synchronous key resolution with simple catalog.
 */
export interface SimpleKeyResolverOptions {
  /** Simple key-value catalog */
  catalog: SimpleLocaleCatalog;
  /** Explicit namespace override (bypasses detection) */
  namespace?: string;
  /** File path for namespace detection */
  filePath?: string;
}

/**
 * Resolves the appropriate i18n key for a given text using a simple catalog.
 * Synchronous version for use with simple key-value maps.
 *
 * @param text - The text to create a key for
 * @param options - Resolution options
 * @returns Resolved key with metadata
 */
export function resolveKeySync(text: string, options: SimpleKeyResolverOptions): ResolvedKey {
  const { catalog, namespace: explicitNamespace, filePath } = options;

  // Normalize text
  const normalizedText = text.trim();

  if (!normalizedText) {
    return {
      key: 'common.empty',
      isExisting: false,
      isNew: true,
    };
  }

  // Step 1: Check if exact value already exists in catalog
  const existingKey = findKeyByValue(catalog, normalizedText);
  if (existingKey) {
    return {
      key: existingKey,
      isExisting: true,
      isNew: false,
    };
  }

  // Step 2: Determine namespace
  const namespace = explicitNamespace ?? detectNamespace(filePath ?? '');

  // Step 3: Generate key from text using transliteration
  const keyName = textToKey(normalizedText);
  const fullKey = buildFullKey(namespace, keyName);

  // Step 4: Check if generated key already exists
  if (fullKey in catalog) {
    const existingValue = catalog[fullKey];

    // Same value - reuse the key
    if (existingValue?.trim() === normalizedText) {
      return {
        key: fullKey,
        isExisting: true,
        isNew: false,
      };
    }

    // Different value - collision! Generate unique key
    const uniqueKey = generateUniqueKeySync(fullKey, catalog);

    if (!uniqueKey) {
      // Fallback: use timestamp suffix if all numeric suffixes exhausted
      const fallbackKey = `${fullKey}_${Date.now()}`;
      return {
        key: fallbackKey,
        isExisting: false,
        isNew: true,
        collision: {
          existingKey: fullKey,
          existingValue: existingValue ?? '',
        },
      };
    }

    return {
      key: uniqueKey,
      isExisting: false,
      isNew: true,
      collision: {
        existingKey: fullKey,
        existingValue: existingValue ?? '',
      },
    };
  }

  // Step 5: Key doesn't exist - it's a new translation
  return {
    key: fullKey,
    isExisting: false,
    isNew: true,
  };
}

/**
 * Find existing key by value in a simple catalog.
 */
function findKeyByValue(catalog: SimpleLocaleCatalog, value: string): string | null {
  const normalizedValue = value.trim();

  for (const [key, existingValue] of Object.entries(catalog)) {
    if (existingValue.trim() === normalizedValue) {
      return key;
    }
  }

  return null;
}

/**
 * Generate a unique key by adding a numeric suffix (sync version).
 */
function generateUniqueKeySync(baseKey: string, catalog: SimpleLocaleCatalog): string | null {
  for (let suffix = 2; suffix <= MAX_SUFFIX_ATTEMPTS; suffix++) {
    const candidateKey = `${baseKey}_${suffix}`;
    if (!(candidateKey in catalog)) {
      return candidateKey;
    }
  }

  return null;
}

/**
 * Resolves multiple texts to keys in batch (synchronous version).
 *
 * @param texts - Array of texts to resolve
 * @param options - Resolution options with simple catalog
 * @returns Batch resolution result
 */
export function resolveKeysSync(
  texts: string[],
  options: SimpleKeyResolverOptions,
): BatchResolveResult {
  const result: BatchResolveResult = {
    keys: new Map(),
    existingCount: 0,
    newCount: 0,
    collisionCount: 0,
  };

  // Create a mutable catalog that includes newly generated keys
  const workingCatalog: SimpleLocaleCatalog = { ...options.catalog };

  for (const text of texts) {
    const normalizedText = text.trim();

    // Skip empty or already processed texts
    if (!normalizedText || result.keys.has(normalizedText)) {
      continue;
    }

    const resolved = resolveKeySync(normalizedText, {
      ...options,
      catalog: workingCatalog,
    });

    // Track result
    result.keys.set(normalizedText, resolved);

    if (resolved.isExisting) {
      result.existingCount++;
    }

    if (resolved.isNew) {
      result.newCount++;
      // Add to working catalog to prevent collisions within batch
      workingCatalog[resolved.key] = normalizedText;
    }

    if (resolved.collision) {
      result.collisionCount++;
    }
  }

  return result;
}
