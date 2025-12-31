/**
 * @module commands/context/collectors/entrypoints
 * @description Detect entry points for a given domain
 *
 * Entry points show WHERE to start reading code:
 * - Backend: routers, services
 * - Frontend: hooks, components
 * - Database: Prisma schema files
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { scanDirectorySync } from '@/lib/@core/fs';

export type EntryPointLayer = 'backend' | 'frontend' | 'database';
export type EntryPointRole = 'router' | 'hooks' | 'components' | 'schema' | 'service';

export interface EntryPoint {
  layer: EntryPointLayer;
  role: EntryPointRole;
  file: string;
}

/**
 * Backend entry point directories to scan
 */
const BACKEND_PATTERNS: Array<{
  dir: string;
  role: EntryPointRole;
}> = [
  { dir: 'packages/api/src/routers', role: 'router' },
  { dir: 'packages/api/src/services', role: 'service' },
  { dir: 'src/routers', role: 'router' },
  { dir: 'src/server/routers', role: 'router' },
  { dir: 'src/services', role: 'service' },
];

/**
 * Frontend entry point directories to scan
 */
const FRONTEND_PATTERNS: Array<{
  dir: string;
  role: EntryPointRole;
  subdirPattern?: string;
}> = [
  { dir: 'apps/web/features', role: 'hooks', subdirPattern: 'hooks' },
  { dir: 'apps/web/features', role: 'components', subdirPattern: 'components' },
  { dir: 'apps/web/components', role: 'components' },
  { dir: 'src/features', role: 'hooks', subdirPattern: 'hooks' },
  { dir: 'src/components', role: 'components' },
];

/**
 * Database entry point directories to scan
 */
const DATABASE_PATTERNS: Array<{
  dir: string;
  role: EntryPointRole;
}> = [
  { dir: 'packages/db/prisma/models', role: 'schema' },
  { dir: 'packages/db/prisma', role: 'schema' },
  { dir: 'prisma/models', role: 'schema' },
  { dir: 'prisma', role: 'schema' },
];

/**
 * Check if a file name matches any domain pattern
 */
export function matchesDomain(fileName: string, domains: string[]): boolean {
  const lowerFileName = fileName.toLowerCase();
  return domains.some((domain) => {
    const lowerDomain = domain.toLowerCase();
    // Match exact or partial (e.g., "booking" matches "bookings.ts", "booking-form.tsx")
    return lowerFileName.includes(lowerDomain);
  });
}

/**
 * Scan a directory for files matching domain patterns
 */
function scanForDomainFiles(
  projectRoot: string,
  dir: string,
  domains: string[],
  extensions: string[],
): string[] {
  const fullPath = path.join(projectRoot, dir);
  if (!fs.existsSync(fullPath)) return [];

  try {
    const files = scanDirectorySync(fullPath, {
      extensions,
      maxDepth: 2, // Don't go too deep
    });

    return files
      .filter((file) => matchesDomain(path.basename(file), domains))
      .map((file) => path.relative(projectRoot, file));
  } catch {
    return [];
  }
}

/**
 * Scan frontend features directory structure
 * Pattern: apps/web/features/{domain}/hooks/*.ts
 */
export function scanFeaturesDir(
  projectRoot: string,
  featuresDir: string,
  domains: string[],
  subdirPattern: string,
  extensions: string[],
): string[] {
  const fullFeaturesPath = path.join(projectRoot, featuresDir);
  if (!fs.existsSync(fullFeaturesPath)) return [];

  const results: string[] = [];

  try {
    // List feature directories
    const featureDirs = fs.readdirSync(fullFeaturesPath, { withFileTypes: true });

    for (const featureDir of featureDirs) {
      if (!featureDir.isDirectory()) continue;
      if (!matchesDomain(featureDir.name, domains)) continue;

      // Check for subdir pattern (e.g., "hooks", "components")
      const subdirPath = path.join(fullFeaturesPath, featureDir.name, subdirPattern);
      if (!fs.existsSync(subdirPath)) continue;

      const files = scanDirectorySync(subdirPath, { extensions, maxDepth: 1 });
      for (const file of files) {
        results.push(path.relative(projectRoot, file));
      }
    }
  } catch {
    // Continue without this directory
  }

  return results;
}

/**
 * Detect entry points for given domains by scanning file patterns
 *
 * Backend:
 * - packages/api/src/routers/{domain}*.ts -> role: router
 * - packages/api/src/services/{domain}*.ts -> role: service
 *
 * Frontend:
 * - apps/web/features/{domain}/hooks/*.ts -> role: hooks
 * - apps/web/features/{domain}/components/*.tsx -> role: components
 * - apps/web/components/{domain}/*.tsx -> role: components
 *
 * Database:
 * - packages/db/prisma/models/{domain}*.prisma -> role: schema
 */
export async function detectEntryPoints(
  projectRoot: string,
  domains: string[],
): Promise<EntryPoint[]> {
  const entryPoints: EntryPoint[] = [];

  if (domains.length === 0) return entryPoints;

  // Filter out generic domains that won't match files
  const GENERIC_DOMAINS = ['general', 'development', 'context', 'feature'];
  const filteredDomains = domains.filter(
    (d) => !GENERIC_DOMAINS.some((g) => d.toLowerCase().includes(g)),
  );

  if (filteredDomains.length === 0) return entryPoints;

  // Scan backend directories
  for (const pattern of BACKEND_PATTERNS) {
    const files = scanForDomainFiles(projectRoot, pattern.dir, filteredDomains, ['.ts']);
    for (const file of files) {
      entryPoints.push({
        layer: 'backend',
        role: pattern.role,
        file,
      });
    }
  }

  // Scan frontend directories
  for (const pattern of FRONTEND_PATTERNS) {
    if (pattern.subdirPattern) {
      // Features directory structure
      const files = scanFeaturesDir(
        projectRoot,
        pattern.dir,
        filteredDomains,
        pattern.subdirPattern,
        pattern.role === 'components' ? ['.tsx'] : ['.ts', '.tsx'],
      );
      for (const file of files) {
        entryPoints.push({
          layer: 'frontend',
          role: pattern.role,
          file,
        });
      }
    } else {
      // Direct component directory
      const files = scanForDomainFiles(
        projectRoot,
        pattern.dir,
        filteredDomains,
        pattern.role === 'components' ? ['.tsx'] : ['.ts', '.tsx'],
      );
      for (const file of files) {
        entryPoints.push({
          layer: 'frontend',
          role: pattern.role,
          file,
        });
      }
    }
  }

  // Scan database directories
  for (const pattern of DATABASE_PATTERNS) {
    const files = scanForDomainFiles(projectRoot, pattern.dir, filteredDomains, ['.prisma']);
    for (const file of files) {
      entryPoints.push({
        layer: 'database',
        role: pattern.role,
        file,
      });
    }
  }

  // Deduplicate by file path
  const seen = new Set<string>();
  return entryPoints.filter((ep) => {
    if (seen.has(ep.file)) return false;
    seen.add(ep.file);
    return true;
  });
}
