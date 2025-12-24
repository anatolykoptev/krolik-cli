/**
 * @module commands/context/helpers/discovery
 * @description File discovery based on domains
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { DiscoveredFiles } from '../types';
import { findFilesMatching } from './files';
import { getDomainPatterns } from './patterns';

const ZOD_DIRS = ['packages/shared/src/schemas', 'src/schemas', 'src/lib/schemas'];

const COMPONENT_DIRS = ['apps/web/components/Business', 'apps/web/components', 'src/components'];

const TEST_DIRS = [
  'packages/api/src/routers/__tests__',
  'apps/web/__tests__',
  '__tests__',
  'tests',
];

/**
 * Collect patterns from domains
 */
function collectPatterns(domains: string[]): {
  zod: string[];
  components: string[];
  tests: string[];
} {
  const zod: string[] = [];
  const components: string[] = [];
  const tests: string[] = [];

  for (const domain of domains) {
    const patterns = getDomainPatterns(domain);
    if (!patterns) continue;

    zod.push(...patterns.zod);
    components.push(...patterns.components);
    tests.push(...patterns.tests);
  }

  return { zod, components, tests };
}

/**
 * Search directories for matching files
 */
function searchDirs(
  projectRoot: string,
  dirs: string[],
  patterns: string[],
  ext: string,
): string[] {
  const results: string[] = [];

  for (const dir of dirs) {
    const fullPath = path.join(projectRoot, dir);
    if (!fs.existsSync(fullPath)) continue;

    const files = findFilesMatching(fullPath, patterns, ext);
    results.push(...files.map((f) => path.relative(fullPath, f)));
  }

  return results;
}

/**
 * Discover relevant files based on domains
 */
export function discoverFiles(projectRoot: string, domains: string[]): DiscoveredFiles {
  const patterns = collectPatterns(domains);

  return {
    zodSchemas: searchDirs(projectRoot, ZOD_DIRS, patterns.zod, '.ts'),
    components: searchDirs(projectRoot, COMPONENT_DIRS, patterns.components, '.tsx'),
    tests: searchDirs(projectRoot, TEST_DIRS, patterns.tests, '.test.ts'),
  };
}
