/**
 * @module lib/@detectors/noise-filter/deduplication
 * @description Stage 2: Content Deduplicator
 *
 * Groups findings by content fingerprint and collapses duplicates.
 */

import { compareFingerprints, generateFingerprint } from '@/lib/@ast/fingerprint';
import type { DedupResult, DuplicateGroup, Finding } from './types';

interface DedupeOptions {
  byContent?: boolean;
  byFile?: boolean;
  minSimilarity?: number;
}

/** Group items by their content fingerprint */
export function groupByFingerprint<T extends { text: string }>(items: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const { fingerprint } = generateFingerprint(item.text, { minTokens: 3 });
    const key = fingerprint || `unique_${groups.size}`;
    const existing = groups.get(key);
    existing ? existing.push(item) : groups.set(key, [item]);
  }

  return groups;
}

/** Deduplicate findings by content fingerprint or file */
export function deduplicateFindings<T extends Finding>(
  findings: T[],
  options?: DedupeOptions,
): DedupResult<T> {
  const opts = { byContent: true, byFile: false, minSimilarity: 0.8, ...options };

  if (findings.length === 0) {
    return {
      unique: [],
      duplicates: [],
      stats: { total: 0, unique: 0, duplicateGroups: 0, duplicatesRemoved: 0 },
    };
  }

  const groups = opts.byFile ? groupByFile(findings) : groupByContent(findings, opts.minSimilarity);
  const unique: T[] = [];
  const duplicates: DuplicateGroup<T>[] = [];

  for (const [fingerprint, items] of groups) {
    const representative = items[0]!;
    unique.push(representative);
    if (items.length > 1) {
      duplicates.push({ fingerprint, representative, count: items.length, items });
    }
  }

  return {
    unique,
    duplicates,
    stats: {
      total: findings.length,
      unique: unique.length,
      duplicateGroups: duplicates.length,
      duplicatesRemoved: findings.length - unique.length,
    },
  };
}

function groupByFile<T extends Finding>(findings: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const finding of findings) {
    const key = `${finding.file}:${finding.text.slice(0, 50)}`;
    const existing = groups.get(key) ?? [];
    existing.push(finding);
    groups.set(key, existing);
  }
  return groups;
}

function groupByContent<T extends Finding>(findings: T[], minSimilarity: number): Map<string, T[]> {
  const groups = new Map<string, T[]>();

  for (const finding of findings) {
    const fp = generateFingerprint(finding.text, { minTokens: 3 });
    let matched = false;

    for (const [, items] of groups) {
      const rep = items[0]!;
      const repFp = generateFingerprint(rep.text, { minTokens: 3 });
      if (compareFingerprints(fp, repFp, finding.text, rep.text) >= minSimilarity) {
        items.push(finding);
        matched = true;
        break;
      }
    }

    if (!matched) {
      groups.set(fp.fingerprint || `unique_${groups.size}`, [finding]);
    }
  }

  return groups;
}
