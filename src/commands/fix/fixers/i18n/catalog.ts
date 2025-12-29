/**
 * @module commands/fix/fixers/i18n/catalog
 * @description Translation catalog management with immutable operations
 */

import * as fs from 'node:fs';
import type {
  CollisionStrategy,
  Detection,
  TextCategory,
  TranslationCatalog,
  TranslationEntry,
} from './types';

const INTERPOLATION_RE = /\$\{([^}]+)\}/g;

/** Converts `${var}` to ICU `{var}` format */
export function convertToIcu(value: string): string {
  return value.replace(INTERPOLATION_RE, '{$1}');
}

const hasInterpolations = (v: string): boolean => INTERPOLATION_RE.test(v);
const extractNs = (key: string): string => {
  const parts = key.split('.');
  return parts.length <= 1 ? 'common' : parts.slice(0, -1).join('.');
};

/** Creates a new empty translation catalog */
export function createCatalog(projectId: string, locale: string): TranslationCatalog {
  return {
    projectId,
    locale,
    entries: new Map<string, TranslationEntry>(),
    generatedAt: new Date(),
    stats: {
      totalEntries: 0,
      byNamespace: new Map(),
      byCategory: new Map(),
      withInterpolations: 0,
    },
  };
}

/** Adds an entry to catalog, returning new catalog with updated stats */
export function addEntry(
  catalog: TranslationCatalog,
  detection: Detection,
  key: string,
  filePath: string,
): TranslationCatalog {
  const namespace = extractNs(key);
  const entry: TranslationEntry = {
    key,
    value: detection.value,
    icuValue: convertToIcu(detection.value),
    namespace,
    sourceFile: filePath,
    sourceLine: detection.line,
  };
  const newEntries = new Map(catalog.entries);
  newEntries.set(key, entry);
  const newByNs = new Map(catalog.stats.byNamespace);
  newByNs.set(namespace, (newByNs.get(namespace) ?? 0) + 1);
  const newByCat = new Map(catalog.stats.byCategory);
  newByCat.set(detection.category, (newByCat.get(detection.category) ?? 0) + 1);
  return {
    ...catalog,
    entries: newEntries,
    stats: {
      totalEntries: catalog.stats.totalEntries + 1,
      byNamespace: newByNs,
      byCategory: newByCat,
      withInterpolations:
        catalog.stats.withInterpolations + (hasInterpolations(entry.value) ? 1 : 0),
    },
  };
}

/** Handles key collisions based on strategy, returns resolved key */
export function handleCollision(
  catalog: TranslationCatalog,
  key: string,
  value: string,
  strategy: CollisionStrategy,
): string {
  const existing = catalog.entries.get(key);
  if (!existing || existing.value === value) return key;
  if (strategy === 'skip' || strategy === 'overwrite') return key;
  if (strategy === 'suffix') {
    let suffix = 2;
    while (catalog.entries.has(`${key}_${suffix}`)) suffix++;
    return `${key}_${suffix}`;
  }
  throw new Error(`Key collision: "${key}" exists with different value`);
}

/** Merges two catalogs, additions take precedence */
export function mergeCatalogs(
  base: TranslationCatalog,
  additions: TranslationCatalog,
): TranslationCatalog {
  const mergedEntries = new Map(base.entries);
  for (const [k, e] of additions.entries) mergedEntries.set(k, e);
  const mergedByNs = new Map(base.stats.byNamespace);
  for (const [ns, c] of additions.stats.byNamespace)
    mergedByNs.set(ns, (mergedByNs.get(ns) ?? 0) + c);
  const mergedByCat = new Map(base.stats.byCategory);
  for (const [cat, c] of additions.stats.byCategory)
    mergedByCat.set(cat, (mergedByCat.get(cat) ?? 0) + c);
  return {
    projectId: base.projectId,
    locale: base.locale,
    entries: mergedEntries,
    generatedAt: new Date(),
    stats: {
      totalEntries: base.stats.totalEntries + additions.stats.totalEntries,
      byNamespace: mergedByNs,
      byCategory: mergedByCat,
      withInterpolations: base.stats.withInterpolations + additions.stats.withInterpolations,
    },
  };
}

function setNested(obj: Record<string, unknown>, path: string, value: string): void {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (p === undefined) continue;
    if (!(p in cur) || typeof cur[p] !== 'object') cur[p] = {};
    cur = cur[p] as Record<string, unknown>;
  }
  const last = parts.at(-1);
  if (last !== undefined) cur[last] = value;
}

function buildNested(catalog: TranslationCatalog): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, entry] of catalog.entries) setNested(result, key, entry.icuValue);
  return result;
}

/** Formats catalog as nested JSON for locale files */
export function formatAsJson(catalog: TranslationCatalog): string {
  return JSON.stringify(buildNested(catalog), null, 2);
}

function objToTs(obj: Record<string, unknown>, indent: number): string {
  const sp = '  '.repeat(indent);
  return Object.entries(obj)
    .map(([k, v]) => {
      const sk = /^[a-zA-Z_]\w*$/.test(k) ? k : `'${k}'`;
      if (typeof v === 'string') return `${sp}${sk}: '${v.replace(/'/g, "\\'")}',`;
      if (typeof v === 'object' && v !== null) {
        return `${sp}${sk}: {\n${objToTs(v as Record<string, unknown>, indent + 1)}\n${sp}},`;
      }
      return '';
    })
    .filter(Boolean)
    .join('\n');
}

/** Formats catalog as TypeScript const object */
export function formatAsTypeScript(catalog: TranslationCatalog): string {
  const nested = buildNested(catalog);
  return [
    `/** Generated translations for ${catalog.locale} at ${catalog.generatedAt.toISOString()} */`,
    '// DO NOT EDIT MANUALLY',
    '',
    'export const translations = {',
    objToTs(nested, 1),
    '} as const;',
    '',
    'export type TranslationKey = keyof typeof translations;',
  ].join('\n');
}

function flatten(
  obj: Record<string, unknown>,
  prefix: string,
  entries: Map<string, TranslationEntry>,
  file: string,
): void {
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') {
      entries.set(fullKey, {
        key: fullKey,
        value: v,
        icuValue: v,
        namespace: prefix || 'common',
        sourceFile: file,
        sourceLine: 0,
      });
    } else if (typeof v === 'object' && v !== null) {
      flatten(v as Record<string, unknown>, fullKey, entries, file);
    }
  }
}

/** Loads existing catalog from JSON file, returns null if not found/invalid */
export function loadExistingCatalog(filePath: string): TranslationCatalog | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
    const entries = new Map<string, TranslationEntry>();
    flatten(parsed, '', entries, filePath);
    const byNs = new Map<string, number>();
    let withInterp = 0;
    for (const e of entries.values()) {
      byNs.set(e.namespace, (byNs.get(e.namespace) ?? 0) + 1);
      if (hasInterpolations(e.icuValue)) withInterp++;
    }
    const localeMatch = filePath.match(/([a-z]{2}(?:-[A-Z]{2})?)\.json$/);
    return {
      projectId: 'loaded',
      locale: localeMatch?.[1] ?? 'unknown',
      entries,
      generatedAt: new Date(),
      stats: {
        totalEntries: entries.size,
        byNamespace: byNs,
        byCategory: new Map<TextCategory, number>(),
        withInterpolations: withInterp,
      },
    };
  } catch {
    return null;
  }
}
