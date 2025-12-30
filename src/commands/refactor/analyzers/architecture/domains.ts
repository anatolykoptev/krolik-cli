/**
 * @module commands/refactor/analyzers/architecture/domains
 * @description Domain classification for structure analysis
 *
 * Classifies directories into domains and calculates coherence scores.
 */

import * as path from 'node:path';
import { exists, findFiles } from '../../../../lib/@core/fs';
import { detectCategory, NAMESPACE_INFO } from '../../core/constants';
import type { NamespaceCategory } from '../../core/types';
import type { DomainInfo } from '../../core/types-ai';
import { getSubdirectories } from '../shared';

// ============================================================================
// COHERENCE CALCULATION
// ============================================================================

/**
 * Calculate coherence score for a domain
 * Score represents how well files match the domain's category
 */
function calculateCoherence(
  fileNames: string[],
  domainCategory: NamespaceCategory,
): {
  coherence: number;
  matching: string[];
  shouldMove: Array<{ file: string; suggestedDomain: string }>;
} {
  if (fileNames.length === 0) {
    return { coherence: 1, matching: [], shouldMove: [] };
  }

  const matching: string[] = [];
  const shouldMove: Array<{ file: string; suggestedDomain: string }> = [];

  for (const fn of fileNames) {
    const fnCategory = detectCategory(fn);

    if (fnCategory === domainCategory || fnCategory === 'unknown') {
      matching.push(fn);
    } else {
      shouldMove.push({ file: fn, suggestedDomain: `@${fnCategory}` });
    }
  }

  const coherence = matching.length / fileNames.length;

  return { coherence, matching, shouldMove };
}

// ============================================================================
// DOMAIN CLASSIFICATION
// ============================================================================

/**
 * Classify a single directory as a domain
 */
function classifyDomain(dirPath: string, name: string): DomainInfo | null {
  if (!exists(dirPath)) return null;

  const category = detectCategory(name);
  const files = findFiles(dirPath, {
    extensions: ['.ts', '.tsx'],
    skipDirs: ['node_modules'],
  });

  const fileNames = files.map((f) => path.basename(f, path.extname(f)));

  const { coherence, matching, shouldMove } = calculateCoherence(fileNames, category);

  const domainInfo: DomainInfo = {
    name,
    path: dirPath,
    category,
    files: files.length,
    coherence,
    description: NAMESPACE_INFO[category].description,
    belongsHere: matching,
    shouldMove,
  };

  // Add suggestion if coherence is low
  if (coherence < 0.8 && shouldMove.length > 0) {
    domainInfo.suggestion = `Consider moving ${shouldMove.length} files to appropriate domains`;
  }

  return domainInfo;
}

/**
 * Classify all domains in the target directory
 */
export function classifyDomains(targetPath: string): DomainInfo[] {
  const domains: DomainInfo[] = [];

  if (!exists(targetPath)) return domains;

  const subdirs = getSubdirectories(targetPath);
  for (const name of subdirs) {
    const dirPath = path.join(targetPath, name);
    const domain = classifyDomain(dirPath, name);
    if (domain) {
      domains.push(domain);
    }
  }

  return domains;
}

// ============================================================================
// DOMAIN UTILITIES
// ============================================================================

/**
 * Get domains with low coherence (below threshold)
 */
export function getLowCoherenceDomains(
  domains: DomainInfo[],
  threshold: number = 0.8,
): DomainInfo[] {
  return domains.filter((d) => d.coherence < threshold);
}

/**
 * Get total misplaced files across all domains
 */
export function getTotalMisplacedFiles(domains: DomainInfo[]): number {
  return domains.reduce((sum, d) => sum + d.shouldMove.length, 0);
}

/**
 * Group misplaced files by target domain
 */
export function groupMisplacedByTarget(
  domains: DomainInfo[],
): Map<string, Array<{ from: string; file: string }>> {
  const grouped = new Map<string, Array<{ from: string; file: string }>>();

  for (const domain of domains) {
    for (const { file, suggestedDomain } of domain.shouldMove) {
      const existing = grouped.get(suggestedDomain) || [];
      existing.push({ from: domain.name, file });
      grouped.set(suggestedDomain, existing);
    }
  }

  return grouped;
}
