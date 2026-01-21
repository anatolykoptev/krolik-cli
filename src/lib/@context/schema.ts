/**
 * @module lib/@context/schema
 * @description Cached Prisma schema access with mtime-based invalidation
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { logger } from '@/lib/@core/logger/logger';

// ============================================================================
// CACHE
// ============================================================================

const CACHE_TTL_MS = 60_000; // 1 minute

interface CacheEntry {
  value: string | undefined;
  timestamp: number;
  mtime: number;
}

const schemaCache = new Map<string, CacheEntry>();

/**
 * Clear schema cache
 */
export function clearSchemaCache(): void {
  schemaCache.clear();
  logger.debug('[context/schema] Cache cleared');
}

// ============================================================================
// SCHEMA DETECTION
// ============================================================================

/** Default locations to search for Prisma schema */
const SCHEMA_CANDIDATES = ['packages/db/prisma', 'prisma', 'packages/database/prisma', 'db/prisma'];

interface SchemaLocation {
  type: 'single' | 'multi';
  /** For single: path to schema.prisma. For multi: path to models directory */
  path: string;
  files: string[];
}

/**
 * Find Prisma schema location in project
 */
export function findSchemaLocation(projectRoot: string): SchemaLocation | undefined {
  for (const candidate of SCHEMA_CANDIDATES) {
    const schemaDir = path.join(projectRoot, candidate);

    // Check for single schema.prisma
    const schemaFile = path.join(schemaDir, 'schema.prisma');
    if (fs.existsSync(schemaFile)) {
      return { type: 'single', path: schemaFile, files: [schemaFile] };
    }

    // Check for multi-file schema in models/
    const modelsDir = path.join(schemaDir, 'models');
    if (fs.existsSync(modelsDir)) {
      const files = fs
        .readdirSync(modelsDir)
        .filter((f) => f.endsWith('.prisma'))
        .map((f) => path.join(modelsDir, f));
      if (files.length > 0) {
        return { type: 'multi', path: modelsDir, files };
      }
    }
  }

  return undefined;
}

/**
 * Get latest mtime from schema files
 */
function getLatestMtime(files: string[]): number {
  let latest = 0;
  for (const file of files) {
    try {
      const stat = fs.statSync(file);
      if (stat.mtimeMs > latest) latest = stat.mtimeMs;
    } catch {
      // File might have been deleted
    }
  }
  return latest;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get Prisma schema content (cached with mtime invalidation)
 *
 * @param projectRoot - Project root directory
 * @returns Schema content or undefined if not found
 */
export function getPrismaSchema(projectRoot: string): string | undefined {
  const location = findSchemaLocation(projectRoot);
  if (!location) return undefined;

  const currentMtime = getLatestMtime(location.files);

  // Check cache
  const cached = schemaCache.get(projectRoot);
  if (cached) {
    const isValid = Date.now() - cached.timestamp < CACHE_TTL_MS;
    const mtimeMatch = cached.mtime === currentMtime;

    if (isValid && mtimeMatch) {
      logger.debug('[context/schema] Returning from cache');
      return cached.value;
    }
  }

  // Read fresh
  let value: string | undefined;

  if (location.type === 'single') {
    value = fs.readFileSync(location.path, 'utf-8');
  } else {
    const contents = location.files.map((f) => fs.readFileSync(f, 'utf-8'));
    value = contents.join('\n\n');
  }

  // Update cache
  schemaCache.set(projectRoot, {
    value,
    timestamp: Date.now(),
    mtime: currentMtime,
  });

  logger.debug(`[context/schema] Loaded ${location.files.length} file(s)`);
  return value;
}

/**
 * Check if project has Prisma schema
 */
export function hasPrismaSchema(projectRoot: string): boolean {
  return findSchemaLocation(projectRoot) !== undefined;
}
