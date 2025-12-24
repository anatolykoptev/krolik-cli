/**
 * @module commands/context/parsers/tests
 * @description Test file parser
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { TestInfo } from './types';

const MAX_TESTS_PER_DESCRIBE = 10;
const DESCRIBE_SEARCH_LENGTH = 2000;

/**
 * Analyze a single test file
 */
function analyzeTest(filePath: string): TestInfo | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const fileName = path.basename(filePath);

    const describes: TestInfo['describes'] = [];

    // Match describe blocks
    const describeRegex = /describe\(['"](.+?)['"],\s*\(\)\s*=>\s*\{/g;
    let descMatch: RegExpExecArray | null;

    while ((descMatch = describeRegex.exec(content)) !== null) {
      const describeName = descMatch[1];
      if (!describeName) continue;

      const tests: string[] = [];

      // Find it() blocks within this describe (simplified)
      const itRegex = /it\(['"](.+?)['"]/g;
      let itMatch: RegExpExecArray | null;

      // Reset and search for it blocks within ~2000 chars
      const startPos = descMatch.index;
      const searchContent = content.slice(startPos, startPos + DESCRIBE_SEARCH_LENGTH);

      while ((itMatch = itRegex.exec(searchContent)) !== null) {
        if (itMatch[1]) tests.push(itMatch[1]);
      }

      if (tests.length > 0) {
        describes.push({
          name: describeName,
          tests: tests.slice(0, MAX_TESTS_PER_DESCRIBE),
        });
      }
    }

    if (describes.length > 0) {
      return { file: fileName, describes };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Check if file matches test patterns
 */
function matchesPatterns(fileName: string, patterns: string[]): boolean {
  if (patterns.length === 0) return true;
  const nameLower = fileName.toLowerCase();
  return patterns.some((p) => nameLower.includes(p.toLowerCase()));
}

/**
 * Check if entry is a test file
 */
function isTestFile(entry: fs.Dirent): boolean {
  return entry.isFile() && (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx'));
}

/**
 * Process a single directory entry
 */
function processEntry(
  entry: fs.Dirent,
  dir: string,
  patterns: string[],
  results: TestInfo[],
  scanDir: (d: string) => void,
): void {
  const fullPath = path.join(dir, entry.name);

  // Recurse into subdirectories
  if (entry.isDirectory() && !entry.name.startsWith('.')) {
    scanDir(fullPath);
    return;
  }

  // Skip non-test files
  if (!isTestFile(entry)) return;

  // Skip files not matching patterns
  if (!matchesPatterns(entry.name, patterns)) return;

  // Analyze and collect
  const info = analyzeTest(fullPath);
  if (info) results.push(info);
}

/**
 * Parse test files to extract describe/it blocks
 */
export function parseTestFiles(testsDir: string, patterns: string[]): TestInfo[] {
  const results: TestInfo[] = [];

  if (!fs.existsSync(testsDir)) return results;

  function scanDir(dir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // Directory not readable
    }

    for (const entry of entries) {
      processEntry(entry, dir, patterns, results, scanDir);
    }
  }

  scanDir(testsDir);
  return results;
}
