/**
 * @module commands/context/parsers/tests
 * @description Test file parser
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { scanDirectory } from '@/lib/@fs';
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
 * Parse test files to extract describe/it blocks
 */
export function parseTestFiles(testsDir: string, patterns: string[]): TestInfo[] {
  const results: TestInfo[] = [];

  scanDirectory(
    testsDir,
    (fullPath) => {
      const info = analyzeTest(fullPath);
      if (info) results.push(info);
    },
    {
      patterns,
      onlyTests: true,
    },
  );

  return results;
}
