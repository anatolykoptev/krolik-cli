/**
 * @module lib/@context/discovery
 * @description Smart file discovery for context injection
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { logger } from '@/lib/@core/logger/logger';

export interface FileDiscoveryOptions {
  limit?: number;
  exclude?: string[];
  maxDepth?: number;
}

export interface DiscoveredFile {
  path: string;
  relevance: number;
  reason: string;
}

const DEFAULT_EXCLUDES = [
  'node_modules',
  '.git',
  '.krolik',
  'dist',
  'coverage',
  'package-lock.json',
  'pnpm-lock.yaml',
];

/**
 * Discover relevant files based on search queries
 */
export function discoverContextFiles(
  projectRoot: string,
  queries: string[],
  options: FileDiscoveryOptions = {},
): DiscoveredFile[] {
  try {
    const limit = options.limit ?? 5;
    const candidates = new Map<string, DiscoveredFile>();

    // 1. Direct filename matching (ripgrep / fd simulation)
    // We'll use a simple recursive directory scan with filtering for now,
    // or shell out to 'find'/'fd' if available for performance.
    // For universal compatibility in Node, we'll try a fast recursive scan.

    const allFiles = scanDirectory(
      projectRoot,
      options.maxDepth ?? 5,
      options.exclude ?? DEFAULT_EXCLUDES,
    );

    for (const file of allFiles) {
      const relativePath = path.relative(projectRoot, file);
      const fileName = path.basename(file);

      // Calculate relevance score
      let score = 0;
      let reason = '';

      for (const query of queries) {
        const normalizedQuery = query.toLowerCase();
        const normalizedPath = relativePath.toLowerCase();

        // Exact filename match (high relevance)
        if (
          fileName.toLowerCase() === normalizedQuery ||
          fileName.toLowerCase() === `${normalizedQuery}.ts`
        ) {
          score += 100;
          reason = 'Exact filename match';
        }
        // Partial filename match
        else if (fileName.toLowerCase().includes(normalizedQuery)) {
          score += 50;
          reason = 'Filename partial match';
        }
        // Path match
        else if (normalizedPath.includes(normalizedQuery)) {
          score += 20;
          reason = `Path contains "${query}"`;
        }
      }

      if (score > 0) {
        // Keep the highest score for this file
        if (!candidates.has(relativePath) || candidates.get(relativePath)!.relevance < score) {
          candidates.set(relativePath, {
            path: relativePath, // Return relative path
            relevance: score,
            reason,
          });
        }
      }
    }

    // Sort by relevance and take top N
    return Array.from(candidates.values())
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit);
  } catch (error) {
    logger.debug(
      `[context/discovery] File discovery failed: ${error instanceof Error ? error.message : 'unknown'}`,
    );
    return [];
  }
}

/**
 * Simple recursive directory scanner
 */
function scanDirectory(dir: string, depth: number, excludes: string[]): string[] {
  if (depth < 0) return [];

  let results: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (excludes.some((ex) => entry.name.includes(ex))) continue;

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        results = results.concat(scanDirectory(fullPath, depth - 1, excludes));
      } else if (entry.isFile()) {
        // Filter interest extensions
        if (/\.(ts|tsx|js|jsx|json|md|prisma|css|yml)$/.test(entry.name)) {
          results.push(fullPath);
        }
      }
    }
  } catch {
    // Ignore access errors
  }
  return results;
}
