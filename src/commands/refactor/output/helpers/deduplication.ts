/**
 * @module commands/refactor/output/helpers/deduplication
 * @description Deduplication utilities for XML output
 *
 * Removes duplicate entries based on various keys to produce cleaner output
 */

/**
 * Generic deduplication by key function
 */
export function deduplicateByKey<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    const key = keyFn(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }

  return result;
}

/**
 * Deduplication for violation entries
 * Key: from + to + type
 */
export interface ViolationLike {
  from: string;
  to: string;
  type: string;
  severity?: string;
}

export function deduplicateViolations<T extends ViolationLike>(violations: T[]): T[] {
  return deduplicateByKey(violations, (v) => `${v.from}|${v.to}|${v.type}`);
}

/**
 * Deduplication for duplicate entries
 * Key: name + first location file
 */
export interface DuplicateLike {
  name: string;
  locations: Array<{ file: string }>;
}

export function deduplicateDuplicates<T extends DuplicateLike>(duplicates: T[]): T[] {
  return deduplicateByKey(duplicates, (d) => {
    const firstFile = d.locations[0]?.file ?? '';
    return `${d.name}|${firstFile}`;
  });
}

/**
 * Deduplication for recommendation entries
 * Key: title
 */
export interface RecommendationLike {
  title: string;
  category?: string;
}

export function deduplicateRecommendations<T extends RecommendationLike>(
  recommendations: T[],
): T[] {
  return deduplicateByKey(recommendations, (r) => r.title);
}

/**
 * Deduplication for misplaced file entries
 * Key: file path
 */
export interface MisplacedFileLike {
  file: string;
  suggestedDomain?: string;
}

export function deduplicateMisplacedFiles<T extends MisplacedFileLike>(files: T[]): T[] {
  return deduplicateByKey(files, (f) => f.file);
}

/**
 * Deduplication for affected file entries
 * Key: file path
 */
export interface AffectedFileLike {
  file: string;
  importCount?: number;
}

export function deduplicateAffectedFiles<T extends AffectedFileLike>(files: T[]): T[] {
  // When deduplicating, keep the one with highest import count
  const map = new Map<string, T>();

  for (const file of files) {
    const existing = map.get(file.file);
    if (!existing || (file.importCount ?? 0) > (existing.importCount ?? 0)) {
      map.set(file.file, file);
    }
  }

  return Array.from(map.values());
}

/**
 * Deduplication for migration actions
 * Key: source + target + type
 */
export interface MigrationActionLike {
  source: string;
  target?: string;
  type: string;
}

export function deduplicateMigrationActions<T extends MigrationActionLike>(actions: T[]): T[] {
  return deduplicateByKey(actions, (a) => `${a.source}|${a.target ?? ''}|${a.type}`);
}
