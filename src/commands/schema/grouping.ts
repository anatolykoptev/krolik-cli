/**
 * @module commands/schema/grouping
 * @description Group models by domain/file with smart relation-based detection
 */

import { groupByProperty } from '@/lib/@core';
import type { PrismaModel } from './parser';
import { analyzeRelationGraph } from './relation-graph';

/**
 * Known abbreviations that should stay uppercase
 */
const UPPERCASE_ABBREVS = ['crm', 'api', 'ugc', 'sso', 'oauth', 'jwt', 'sql'];

/**
 * Group models by file
 */
export function groupByFile(models: PrismaModel[]): Map<string, PrismaModel[]> {
  return groupByProperty(models, 'file');
}

/**
 * Group models by domain using smart detection with filename fallback
 *
 * Algorithm:
 * 1. Analyze relation graph to find clusters (Tarjan SCC)
 * 2. Name clusters by common prefix or core entity
 * 3. Use clusters with confidence >= 60%
 * 4. Fallback to filename for unclustered models
 *
 * Google rule: Better to skip uncertain than show false positives
 */
export function groupByDomain(models: PrismaModel[]): Map<string, PrismaModel[]> {
  if (models.length === 0) {
    return new Map();
  }

  // Check if all models are from a single file (likely single schema.prisma)
  const files = new Set(models.map((m) => m.file));
  const isSingleFile = files.size === 1;

  // For multi-file schemas, filename-based grouping is reliable
  // For single-file schemas, try smart detection
  if (!isSingleFile) {
    return groupByFilename(models);
  }

  // Try smart relation-based detection
  const { clusters, unclustered } = analyzeRelationGraph(models);

  // If no confident clusters found, fallback to filename
  if (clusters.length === 0) {
    return groupByFilename(models);
  }

  const result = new Map<string, PrismaModel[]>();
  const modelMap = new Map(models.map((m) => [m.name, m]));

  // Add clustered models
  for (const cluster of clusters) {
    const clusterModels = cluster.models
      .map((name) => modelMap.get(name))
      .filter((m): m is PrismaModel => m !== undefined);

    if (clusterModels.length > 0) {
      result.set(cluster.name, clusterModels);
    }
  }

  // Add unclustered models with filename fallback
  if (unclustered.length > 0) {
    const unclusteredModels = unclustered
      .map((name) => modelMap.get(name))
      .filter((m): m is PrismaModel => m !== undefined);

    // Group unclustered by filename
    for (const model of unclusteredModels) {
      const domain = inferDomainFromFilename(model.file);
      const existing = result.get(domain) ?? [];
      existing.push(model);
      result.set(domain, existing);
    }
  }

  // Sort by domain name
  return new Map([...result.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}

/**
 * Group models by filename (legacy method, used for multi-file schemas)
 */
function groupByFilename(models: PrismaModel[]): Map<string, PrismaModel[]> {
  const result = new Map<string, PrismaModel[]>();

  for (const model of models) {
    const domain = inferDomainFromFilename(model.file);
    const existing = result.get(domain) ?? [];
    existing.push(model);
    result.set(domain, existing);
  }

  return new Map([...result.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}

/**
 * Infer domain from filename (dynamic)
 * Converts filename to readable domain name:
 * - "auth.prisma" -> "Auth"
 * - "booking.prisma" -> "Booking"
 * - "services-ugc.prisma" -> "Services UGC"
 * - "crm.prisma" -> "CRM"
 */
export function inferDomainFromFilename(filename: string): string {
  // Remove extension and path
  const base = filename.replace(/\.prisma$/, '').replace(/^.*\//, '');

  if (!base || base === 'schema') return 'Other';

  // Split by hyphen or underscore
  const parts = base.split(/[-_]/);

  // Capitalize each part, handling abbreviations
  const formatted = parts.map((part) => {
    const lower = part.toLowerCase();
    if (UPPERCASE_ABBREVS.includes(lower)) {
      return lower.toUpperCase();
    }
    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
  });

  return formatted.join(' ');
}

/**
 * Sort models alphabetically within groups
 */
export function sortModels(models: PrismaModel[]): PrismaModel[] {
  return [...models].sort((a, b) => a.name.localeCompare(b.name));
}
