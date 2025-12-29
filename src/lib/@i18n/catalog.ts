/**
 * @module lib/@i18n/catalog
 * @description Locale catalog for loading, indexing, and managing translation files
 *
 * Provides reverse lookup of translation keys by value, supporting nested JSON
 * structures and multiple namespace files. Optimized for fast value-to-key lookups.
 *
 * @example
 * ```typescript
 * import { createLocaleCatalog } from '@/lib/@i18n/catalog';
 *
 * const catalog = createLocaleCatalog();
 * await catalog.load('apps/web/public/locales', 'ru');
 *
 * // Find existing key by value
 * const key = catalog.findByValue('Загрузка...');
 * // => 'common.loading' (if exists)
 *
 * // Add new translation
 * await catalog.addTranslation('panel.events.title', 'Мероприятия');
 * await catalog.flush();
 * ```
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Options for finding translations by value
 */
export interface FindByValueOptions {
  /** Enable fuzzy matching (case-insensitive, trimmed, normalized whitespace) */
  fuzzy?: boolean;
}

/**
 * Interface for the locale catalog
 */
export interface LocaleCatalog {
  /** Load all locale files for a language */
  load(localesDir: string, language: string): Promise<void>;

  /** Find existing key by value (reverse lookup) */
  findByValue(value: string, options?: FindByValueOptions): string | null;

  /** Check if key exists */
  hasKey(key: string): boolean;

  /** Get value by key */
  getValue(key: string): string | null;

  /** Add new translation (updates file) */
  addTranslation(key: string, value: string): Promise<void>;

  /** Get all pending writes */
  getPendingWrites(): Map<string, Record<string, unknown>>;

  /** Flush all pending writes to disk */
  flush(): Promise<void>;

  /** Get all loaded namespaces */
  getNamespaces(): string[];

  /** Get all keys in a namespace */
  getKeys(namespace: string): string[];

  /** Clear the catalog */
  clear(): void;
}

/**
 * Internal structure for storing namespace data
 */
interface NamespaceData {
  /** Path to the JSON file */
  filePath: string;
  /** Raw JSON content (nested structure) */
  content: Record<string, unknown>;
  /** Whether this namespace has been modified */
  dirty: boolean;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Normalizes a value for comparison
 * - Trims whitespace
 * - Collapses multiple spaces
 * - Removes soft hyphens and zero-width characters
 */
function normalizeValue(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[\u00AD\u200B-\u200D\uFEFF]/g, '');
}

/**
 * Normalizes a value for fuzzy matching
 * - All normalizeValue transformations
 * - Lowercase
 * - Remove punctuation at start/end
 */
function normalizeFuzzy(value: string): string {
  return normalizeValue(value)
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

/**
 * Flattens a nested JSON object into dot-separated keys
 *
 * @example
 * flattenObject({ common: { loading: 'Loading...' } })
 * // => { 'common.loading': 'Loading...' }
 */
function flattenObject(obj: Record<string, unknown>, prefix: string = ''): Map<string, string> {
  const result = new Map<string, string>();

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'string') {
      result.set(fullKey, value);
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const nested = flattenObject(value as Record<string, unknown>, fullKey);
      for (const [nestedKey, nestedValue] of nested) {
        result.set(nestedKey, nestedValue);
      }
    }
  }

  return result;
}

/**
 * Sets a value in a nested object by dot-separated key path
 *
 * @example
 * setNestedValue({}, 'common.loading', 'Loading...')
 * // => { common: { loading: 'Loading...' } }
 */
function setNestedValue(obj: Record<string, unknown>, keyPath: string, value: string): void {
  const parts = keyPath.split('.');
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (!(part in current) || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  const lastPart = parts[parts.length - 1]!;
  current[lastPart] = value;
}

/**
 * Extracts namespace from a full key
 * For 'common.loading' returns 'common'
 * For 'panel.events.title' returns 'panel'
 */
function extractNamespace(key: string): string {
  const dotIndex = key.indexOf('.');
  return dotIndex > 0 ? key.slice(0, dotIndex) : 'common';
}

/**
 * Extracts the key part without namespace prefix
 * For 'common.loading' returns 'loading'
 * For 'panel.events.title' returns 'events.title'
 */
function extractKeyWithoutNamespace(key: string): string {
  const dotIndex = key.indexOf('.');
  return dotIndex > 0 ? key.slice(dotIndex + 1) : key;
}

/**
 * Reads and parses a JSON file
 */
async function readJsonFile(filePath: string): Promise<Record<string, unknown> | null> {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Writes a JSON file with consistent formatting
 */
async function writeJsonFile(filePath: string, content: Record<string, unknown>): Promise<boolean> {
  try {
    const dir = path.dirname(filePath);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(filePath, `${JSON.stringify(content, null, 2)}\n`, 'utf-8');
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// CATALOG IMPLEMENTATION
// ============================================================================

/**
 * Creates a new LocaleCatalog instance
 */
export function createLocaleCatalog(): LocaleCatalog {
  // Key -> Value index (for hasKey and getValue)
  const keyIndex = new Map<string, string>();

  // Normalized Value -> Key index (for reverse lookup)
  const valueIndex = new Map<string, string>();

  // Fuzzy normalized Value -> Key index
  const fuzzyIndex = new Map<string, string>();

  // Namespace -> NamespaceData
  const namespaces = new Map<string, NamespaceData>();

  // Loaded locales directory and language
  let loadedDir = '';
  let loadedLanguage = '';

  /**
   * Load all locale files for a language
   */
  async function load(localesDir: string, language: string): Promise<void> {
    // Clear existing data
    clear();

    loadedDir = localesDir;
    loadedLanguage = language;

    const langDir = path.join(localesDir, language);

    // Check if directory exists
    try {
      const stat = await fs.promises.stat(langDir);
      if (!stat.isDirectory()) {
        return;
      }
    } catch {
      return;
    }

    // List all JSON files
    const entries = await fs.promises.readdir(langDir, { withFileTypes: true });
    const jsonFiles = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => entry.name);

    // Load each namespace file
    for (const fileName of jsonFiles) {
      const namespace = fileName.replace('.json', '');
      const filePath = path.join(langDir, fileName);

      const content = await readJsonFile(filePath);
      if (!content) continue;

      // Store namespace data
      namespaces.set(namespace, {
        filePath,
        content,
        dirty: false,
      });

      // Build indexes
      const flattened = flattenObject(content);
      for (const [key, value] of flattened) {
        const fullKey = `${namespace}.${key}`;

        // Key -> Value index
        keyIndex.set(fullKey, value);

        // Value -> Key indexes (first occurrence wins)
        const normalizedValue = normalizeValue(value);
        if (!valueIndex.has(normalizedValue)) {
          valueIndex.set(normalizedValue, fullKey);
        }

        const fuzzyValue = normalizeFuzzy(value);
        if (fuzzyValue && !fuzzyIndex.has(fuzzyValue)) {
          fuzzyIndex.set(fuzzyValue, fullKey);
        }
      }
    }
  }

  /**
   * Find existing key by value (reverse lookup)
   */
  function findByValue(value: string, options?: FindByValueOptions): string | null {
    if (!value) return null;

    // Try exact match first
    const normalizedValue = normalizeValue(value);
    const exactMatch = valueIndex.get(normalizedValue);
    if (exactMatch) return exactMatch;

    // Try fuzzy match if enabled
    if (options?.fuzzy) {
      const fuzzyValue = normalizeFuzzy(value);
      const fuzzyMatch = fuzzyIndex.get(fuzzyValue);
      if (fuzzyMatch) return fuzzyMatch;
    }

    return null;
  }

  /**
   * Check if key exists
   */
  function hasKey(key: string): boolean {
    return keyIndex.has(key);
  }

  /**
   * Get value by key
   */
  function getValue(key: string): string | null {
    return keyIndex.get(key) ?? null;
  }

  /**
   * Add new translation (updates file)
   */
  async function addTranslation(key: string, value: string): Promise<void> {
    if (!key || !value) return;

    const namespace = extractNamespace(key);
    const keyWithoutNs = extractKeyWithoutNamespace(key);

    // Get or create namespace data
    let nsData = namespaces.get(namespace);
    if (!nsData) {
      // Create new namespace file
      const filePath = path.join(loadedDir, loadedLanguage, `${namespace}.json`);
      nsData = {
        filePath,
        content: {},
        dirty: true,
      };
      namespaces.set(namespace, nsData);
    }

    // Set value in nested structure
    setNestedValue(nsData.content, keyWithoutNs, value);
    nsData.dirty = true;

    // Update indexes
    keyIndex.set(key, value);

    const normalizedValue = normalizeValue(value);
    if (!valueIndex.has(normalizedValue)) {
      valueIndex.set(normalizedValue, key);
    }

    const fuzzyValue = normalizeFuzzy(value);
    if (fuzzyValue && !fuzzyIndex.has(fuzzyValue)) {
      fuzzyIndex.set(fuzzyValue, key);
    }
  }

  /**
   * Get all pending writes
   */
  function getPendingWrites(): Map<string, Record<string, unknown>> {
    const pending = new Map<string, Record<string, unknown>>();

    for (const [, data] of namespaces) {
      if (data.dirty) {
        pending.set(data.filePath, data.content);
      }
    }

    return pending;
  }

  /**
   * Flush all pending writes to disk
   */
  async function flush(): Promise<void> {
    const writes: Promise<boolean>[] = [];

    for (const [, data] of namespaces) {
      if (data.dirty) {
        writes.push(
          writeJsonFile(data.filePath, data.content).then((success) => {
            if (success) {
              data.dirty = false;
            }
            return success;
          }),
        );
      }
    }

    await Promise.all(writes);
  }

  /**
   * Get all loaded namespaces
   */
  function getNamespaces(): string[] {
    return Array.from(namespaces.keys());
  }

  /**
   * Get all keys in a namespace
   */
  function getKeys(namespace: string): string[] {
    const keys: string[] = [];
    const prefix = `${namespace}.`;

    for (const key of keyIndex.keys()) {
      if (key.startsWith(prefix)) {
        keys.push(key);
      }
    }

    return keys;
  }

  /**
   * Clear the catalog
   */
  function clear(): void {
    keyIndex.clear();
    valueIndex.clear();
    fuzzyIndex.clear();
    namespaces.clear();
    loadedDir = '';
    loadedLanguage = '';
  }

  return {
    load,
    findByValue,
    hasKey,
    getValue,
    addTranslation,
    getPendingWrites,
    flush,
    getNamespaces,
    getKeys,
    clear,
  };
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/**
 * Default catalog instance for convenience
 */
export const defaultCatalog = createLocaleCatalog();
