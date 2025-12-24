/**
 * @module commands/refactor/analyzers/structure
 * @description Analyze module structure for consistency
 */

import * as path from 'path';
import type { StructureAnalysis, StructureIssue } from '../core';
import { findFiles, getSubdirectories, exists } from '../../../lib';

// ============================================================================
// CONSTANTS
// ============================================================================

const STRUCTURE_THRESHOLDS = {
  /** Max flat files before suggesting grouping */
  MAX_FLAT_FILES: 3,
  /** Penalty threshold for excessive flat files */
  EXCESSIVE_FLAT_FILES: 10,
  /** Score bonus for well-organized structure */
  BONUS_WELL_ORGANIZED: 10,
  /** Score penalty for excessive flat files */
  PENALTY_EXCESSIVE_FLAT: 15,
} as const;

const SCORE_PENALTIES = {
  error: 20,
  warning: 10,
  info: 5,
} as const;

// ============================================================================
// MAIN ANALYSIS
// ============================================================================

/**
 * Analyze structure of a lib-like directory
 */
export function analyzeStructure(
  targetPath: string,
  _projectRoot: string,
): StructureAnalysis {
  const issues: StructureIssue[] = [];
  const flatFiles: string[] = [];
  const namespacedFolders: string[] = [];
  const doubleNested: string[] = [];
  const ungroupedFiles: Array<{ file: string; suggestedNamespace: string }> = [];

  // Get all TypeScript files at root level using correct API (sync function)
  const allRootFiles = findFiles(targetPath, {
    extensions: ['.ts'],
    skipDirs: ['node_modules'],
    maxDepth: 1,
  });

  // Filter to only root level files (not in subdirs) and exclude index.ts
  for (const file of allRootFiles) {
    const relPath = path.relative(targetPath, file);
    // Only include files directly in targetPath (no path separator)
    if (!relPath.includes(path.sep) && path.basename(file) !== 'index.ts') {
      flatFiles.push(path.basename(file));
    }
  }

  // Get all subdirectory names (getSubdirectories returns names, not full paths)
  const subdirNames = getSubdirectories(targetPath);

  for (const dirName of subdirNames) {
    const dirPath = path.join(targetPath, dirName);

    // Check for @ prefixed namespaces
    if (dirName.startsWith('@')) {
      // Check for double nesting (@something)
      const innerDirNames = getSubdirectories(dirPath);
      for (const innerName of innerDirNames) {
        if (innerName.startsWith('@')) {
          doubleNested.push(`${dirName}/${innerName}`);
        }
      }

      namespacedFolders.push(dirName);
    }
  }

  // Detect issues

  // 1. Double nesting issue
  if (doubleNested.length > 0) {
    issues.push({
      type: 'double-nesting',
      severity: 'warning',
      message: `Double-nested namespaces found: ${doubleNested.join(', ')}. Consider flattening.`,
      files: doubleNested,
      fix: 'Move inner namespaces to top level (e.g., @formatters → @formatters)',
    });
  }

  // 2. Mixed structure (flat files + namespaced folders)
  if (flatFiles.length > STRUCTURE_THRESHOLDS.MAX_FLAT_FILES && namespacedFolders.length > 0) {
    const suggestions = suggestGroupings(flatFiles);
    ungroupedFiles.push(...suggestions);

    if (suggestions.length > 0) {
      issues.push({
        type: 'mixed-structure',
        severity: 'info',
        message: `Mixed structure: ${flatFiles.length} flat files alongside ${namespacedFolders.length} namespaced folders`,
        files: flatFiles,
        fix: 'Consider grouping related files into namespaces',
      });
    }
  }

  // 3. Check for missing barrel exports (index.ts)
  for (const dirName of subdirNames) {
    const dirPath = path.join(targetPath, dirName);
    const indexPath = path.join(dirPath, 'index.ts');
    if (!exists(indexPath)) {
      issues.push({
        type: 'missing-barrel',
        severity: 'warning',
        message: `Missing barrel export in ${dirName}`,
        files: [dirPath],
        fix: `Create ${dirName}/index.ts with re-exports`,
      });
    }
  }

  // 4. Check for inconsistent naming
  const namingIssues = checkNamingConsistency(flatFiles, namespacedFolders);
  issues.push(...namingIssues);

  // 5. Check for duplicate modules (same name in different locations)
  const subdirPaths = subdirNames.map((name) => path.join(targetPath, name));
  const duplicateModules = findDuplicateModules(targetPath, subdirPaths);
  for (const dup of duplicateModules) {
    issues.push({
      type: 'duplicate-module',
      severity: 'error',
      message: `Duplicate module: ${dup.name} found in multiple locations`,
      files: dup.locations,
      fix: 'Consolidate into single location and update imports',
    });
  }

  // Calculate score
  const score = calculateScore(issues, flatFiles.length, namespacedFolders.length);

  return {
    flatFiles,
    namespacedFolders,
    doubleNested,
    ungroupedFiles,
    score,
    issues,
  };
}

// ============================================================================
// GROUPING SUGGESTIONS
// ============================================================================

/**
 * Suggest groupings for flat files based on naming patterns
 */
function suggestGroupings(
  files: string[],
): Array<{ file: string; suggestedNamespace: string }> {
  const suggestions: Array<{ file: string; suggestedNamespace: string }> = [];

  const patterns: Record<string, string[]> = {
    '@git': ['git', 'github', 'branch', 'commit', 'merge', 'diff'],
    '@fs': ['fs', 'file', 'path', 'directory', 'folder'],
    '@shell': ['shell', 'exec', 'command', 'process', 'spawn'],
    '@format': ['format', 'xml', 'json', 'markdown', 'text', 'output'],
    '@time': ['time', 'timing', 'duration', 'date'],
    '@log': ['log', 'logger', 'debug', 'trace'],
  };

  for (const file of files) {
    const baseName = file.replace('.ts', '').toLowerCase();

    for (const [namespace, keywords] of Object.entries(patterns)) {
      if (keywords.some((kw) => baseName.includes(kw))) {
        suggestions.push({ file, suggestedNamespace: namespace });
        break;
      }
    }
  }

  return suggestions;
}

// ============================================================================
// NAMING CONSISTENCY
// ============================================================================

/**
 * Check naming consistency
 */
function checkNamingConsistency(
  flatFiles: string[],
  namespacedFolders: string[],
): StructureIssue[] {
  const issues: StructureIssue[] = [];

  // Check for camelCase vs kebab-case mixing
  const camelCaseFiles = flatFiles.filter((f) => /[A-Z]/.test(f.replace('.ts', '')));
  const kebabCaseFiles = flatFiles.filter((f) => f.includes('-'));

  if (camelCaseFiles.length > 0 && kebabCaseFiles.length > 0) {
    issues.push({
      type: 'inconsistent-naming',
      severity: 'info',
      message: 'Mixed naming conventions: both camelCase and kebab-case files found',
      files: [...camelCaseFiles, ...kebabCaseFiles],
      fix: 'Standardize on one naming convention (kebab-case recommended)',
    });
  }

  // Check for @ prefix consistency in namespaces
  const withPrefix = namespacedFolders.filter((f) => f.startsWith('@'));
  const withoutPrefix = namespacedFolders.filter((f) => !f.startsWith('@'));

  if (withPrefix.length > 0 && withoutPrefix.length > 0) {
    issues.push({
      type: 'inconsistent-naming',
      severity: 'warning',
      message: 'Mixed namespace naming: some folders have @ prefix, others do not',
      files: [...withPrefix, ...withoutPrefix],
      fix: 'Standardize on @ prefix for all namespaces or none',
    });
  }

  return issues;
}

// ============================================================================
// DUPLICATE DETECTION
// ============================================================================

/**
 * Find modules that exist in multiple locations
 */
function findDuplicateModules(
  targetPath: string,
  subdirs: string[],
): Array<{ name: string; locations: string[] }> {
  const modulesByName = new Map<string, string[]>();

  // Check flat files using correct API (sync function)
  const rootFiles = findFiles(targetPath, {
    extensions: ['.ts'],
    skipDirs: ['node_modules'],
    maxDepth: 1,
  });

  // Filter to only root level files
  for (const file of rootFiles) {
    const relPath = path.relative(targetPath, file);
    if (!relPath.includes(path.sep) && path.basename(file) !== 'index.ts') {
      const name = path.basename(file, '.ts');
      const locations = modulesByName.get(name) ?? [];
      locations.push(file);
      modulesByName.set(name, locations);
    }
  }

  // Check subdirectories
  for (const dir of subdirs) {
    const innerFiles = findFiles(dir, {
      extensions: ['.ts'],
      skipDirs: ['node_modules'],
    });

    // Filter out index.ts
    for (const file of innerFiles) {
      if (path.basename(file) === 'index.ts') continue;
      const name = path.basename(file, '.ts');
      const locations = modulesByName.get(name) ?? [];
      locations.push(file);
      modulesByName.set(name, locations);
    }
  }

  return [...modulesByName.entries()]
    .filter(([, locations]) => locations.length > 1)
    .map(([name, locations]) => ({ name, locations }));
}

// ============================================================================
// SCORING
// ============================================================================

/**
 * Calculate structure score
 */
function calculateScore(
  issues: StructureIssue[],
  flatFilesCount: number,
  namespacedCount: number,
): number {
  let score = 100;

  // Deduct for issues
  score -= issues.reduce(
    (total, issue) => total + SCORE_PENALTIES[issue.severity],
    0,
  );

  // Bonus for well-organized structure
  if (namespacedCount > 0 && flatFilesCount <= STRUCTURE_THRESHOLDS.MAX_FLAT_FILES) {
    score += STRUCTURE_THRESHOLDS.BONUS_WELL_ORGANIZED;
  }

  // Penalty for too many flat files
  if (flatFilesCount > STRUCTURE_THRESHOLDS.EXCESSIVE_FLAT_FILES) {
    score -= STRUCTURE_THRESHOLDS.PENALTY_EXCESSIVE_FLAT;
  }

  return Math.max(0, Math.min(100, score));
}

// ============================================================================
// VISUALIZATION
// ============================================================================

/**
 * Generate structure visualization
 */
export function visualizeStructure(analysis: StructureAnalysis): string {
  const lines: string[] = [];

  lines.push('📁 Structure Analysis');
  lines.push('');

  if (analysis.flatFiles.length > 0) {
    lines.push('📄 Flat files:');
    for (const file of analysis.flatFiles) {
      lines.push(`   ├── ${file}`);
    }
    lines.push('');
  }

  if (analysis.namespacedFolders.length > 0) {
    lines.push('📂 Namespaced folders:');
    for (const folder of analysis.namespacedFolders) {
      const isDoubleNested = analysis.doubleNested.some((d) => d.startsWith(folder));
      const icon = isDoubleNested ? '⚠️' : '✅';
      lines.push(`   ${icon} ${folder}`);
    }
    lines.push('');
  }

  if (analysis.doubleNested.length > 0) {
    lines.push('⚠️  Double-nested (should flatten):');
    for (const nested of analysis.doubleNested) {
      lines.push(`   └── ${nested}`);
    }
    lines.push('');
  }

  if (analysis.ungroupedFiles.length > 0) {
    lines.push('💡 Suggested groupings:');
    for (const { file, suggestedNamespace } of analysis.ungroupedFiles) {
      lines.push(`   ${file} → ${suggestedNamespace}/`);
    }
    lines.push('');
  }

  lines.push(`📊 Score: ${analysis.score}/100`);

  return lines.join('\n');
}
