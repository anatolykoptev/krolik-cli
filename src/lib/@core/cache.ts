import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ensureKrolikSubdir, getKrolikSubdir } from './krolik-paths';

export interface FileCacheEntry {
  hash: string;
  timestamp: number;
  result: any; // Generic result storage
}

export interface CacheStore {
  version: string;
  files: Record<string, FileCacheEntry>;
}

const CACHE_SUBDIR = 'cache';
const CACHE_FILE = 'audit-cache.json';
const CACHE_VERSION = '1.0';

/**
 * Calculate content hash for a file
 */
export function calculateHash(content: string): string {
  return crypto.createHash('md5').update(content).digest('hex');
}

/**
 * Load cache from disk
 */
export function loadCache(projectRoot: string): CacheStore {
  const cachePath = path.join(getKrolikSubdir(CACHE_SUBDIR, { projectRoot }), CACHE_FILE);
  if (fs.existsSync(cachePath)) {
    try {
      const data = fs.readFileSync(cachePath, 'utf-8');
      const cache = JSON.parse(data) as CacheStore;
      if (cache.version === CACHE_VERSION) {
        return cache;
      }
    } catch {
      // Ignore errors
    }
  }
  return { version: CACHE_VERSION, files: {} };
}

/**
 * Save cache to disk
 */
export function saveCache(projectRoot: string, cache: CacheStore): void {
  const cacheDir = ensureKrolikSubdir(CACHE_SUBDIR, { projectRoot });
  const cachePath = path.join(cacheDir, CACHE_FILE);

  try {
    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));
  } catch (error) {
    console.error('Failed to save cache:', error);
  }
}
