/**
 * @module commands/context/helpers/files
 * @description File search utilities
 */

import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Check if entry should be skipped during scan
 */
function shouldSkipEntry(name: string): boolean {
  return name.startsWith(".") || name === "node_modules";
}

/**
 * Check if file matches any pattern
 */
function matchesPattern(fileName: string, patterns: string[]): boolean {
  const nameLower = fileName.toLowerCase();
  return patterns.some((p) => nameLower.includes(p.toLowerCase()));
}

/**
 * Recursively scan directory for matching files
 */
function scanDirectory(
  dir: string,
  patterns: string[],
  ext: string,
  results: string[],
): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return; // Directory not readable
  }

  for (const entry of entries) {
    if (shouldSkipEntry(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      scanDirectory(fullPath, patterns, ext, results);
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith(ext)) continue;
    if (!matchesPattern(entry.name, patterns)) continue;

    results.push(fullPath);
  }
}

/**
 * Find files matching patterns in a directory (recursive)
 */
export function findFilesMatching(
  dir: string,
  patterns: string[],
  ext: string,
): string[] {
  const results: string[] = [];
  scanDirectory(dir, patterns, ext, results);
  return results;
}
