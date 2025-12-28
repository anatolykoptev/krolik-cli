/**
 * @module commands/refactor/analyzers/architecture/namespace/analysis
 * @description Core namespace analysis functions
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { DirectoryInfo } from '../../../core';
import { countTsFiles, findLibDir, getSubdirs, isNamespaced } from './fs-utils';
import { generateNamespaceMigrationPlan } from './migration';
import { calculateNamespaceScore, detectNamespaceCategory } from './scoring';
import type { NamespaceAnalysisResult } from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

const SKIP_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.turbo',
  'coverage',
  '__tests__',
  '__mocks__',
];

// ============================================================================
// PUBLIC FUNCTIONS
// ============================================================================

/**
 * Analyze a single directory
 */
export function analyzeNamespaceDirectory(dir: string, libDir: string): DirectoryInfo {
  const name = path.basename(dir);
  const subdirs = getSubdirs(dir);
  const fileCount = countTsFiles(dir);
  const namespaced = isNamespaced(name);
  const category = detectNamespaceCategory(name, subdirs);

  const result: DirectoryInfo = {
    name,
    path: path.relative(libDir, dir),
    fileCount,
    subdirs,
    category,
    isNamespaced: namespaced,
  };

  // Only add suggestedNamespace when it has a value (exactOptionalPropertyTypes)
  if (!namespaced && category !== 'unknown') {
    result.suggestedNamespace = `@${category}/@${name}`;
  }

  return result;
}

/**
 * Analyze lib/ structure for namespace organization
 */
export function analyzeNamespaceStructure(
  projectRoot: string,
  libPath?: string,
): NamespaceAnalysisResult {
  const libDir = libPath || findLibDir(projectRoot);

  if (!libDir) {
    return {
      projectRoot,
      libDir: null,
      directories: [],
      currentScore: 0,
      suggestedScore: 0,
      plan: { moves: [], importUpdates: [], score: { before: 0, after: 0 } },
      timestamp: new Date().toISOString(),
    };
  }

  const entries = fs
    .readdirSync(libDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !SKIP_DIRS.includes(e.name));

  const directories = entries.map((e) =>
    analyzeNamespaceDirectory(path.join(libDir, e.name), libDir),
  );

  const currentScore = calculateNamespaceScore(directories);
  const plan = generateNamespaceMigrationPlan(directories);

  return {
    projectRoot,
    libDir,
    directories,
    currentScore,
    suggestedScore: plan.score.after,
    plan,
    timestamp: new Date().toISOString(),
  };
}
