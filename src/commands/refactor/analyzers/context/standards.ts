/**
 * @module commands/refactor/analyzers/context/standards
 * @description Standards compliance checker (consolidated from refine)
 *
 * Checks project compliance with:
 * - Structure standards (lib organization, barrels)
 * - Naming conventions (file/folder naming)
 * - Dependency management (lockfiles, deprecated packages)
 * - Documentation (README, CLAUDE.md, JSDoc)
 */

import * as path from 'node:path';
import { exists, findFiles, readFile } from '../../../../lib/@core/fs';
import type { DirectoryInfo, StandardCheck, StandardsCompliance } from '../../core/types';
import type { ProjectContext } from '../../core/types-ai';
import { readPackageJson } from '../shared/helpers';

// ============================================================================
// MAIN ENTRY
// ============================================================================

/**
 * Check standards compliance
 */
export function checkStandards(
  projectRoot: string,
  directories: DirectoryInfo[],
  context: ProjectContext,
): StandardsCompliance {
  const checks: StandardCheck[] = [];

  checks.push(...checkStructureStandards(projectRoot, directories, context));
  checks.push(...checkNamingStandards(projectRoot, directories));
  checks.push(...checkDependencyStandards(projectRoot));
  checks.push(...checkDocumentationStandards(projectRoot));

  const passed = checks.filter((c) => c.passed).length;
  const total = checks.length;
  const score = total > 0 ? Math.round((passed / total) * 100) : 100;

  const categories = {
    structure: calcCategoryScore(checks, 'structure'),
    naming: calcCategoryScore(checks, 'naming'),
    dependencies: calcCategoryScore(checks, 'dependencies'),
    documentation: calcCategoryScore(checks, 'documentation'),
  };

  return { score, checks, categories };
}

function calcCategoryScore(checks: StandardCheck[], prefix: string): number {
  const categoryChecks = checks.filter((c) => c.name.toLowerCase().includes(prefix));
  if (categoryChecks.length === 0) return 100;
  const passed = categoryChecks.filter((c) => c.passed).length;
  return Math.round((passed / categoryChecks.length) * 100);
}

// ============================================================================
// STRUCTURE STANDARDS
// ============================================================================

const MAX_DEPTH = 3;

function checkStructureStandards(
  projectRoot: string,
  directories: DirectoryInfo[],
  _context: ProjectContext,
): StandardCheck[] {
  const checks: StandardCheck[] = [];

  // Has lib directory
  const hasLib = directories.length > 0;
  checks.push({
    name: 'Structure: lib directory exists',
    description: 'Project has organized lib/ directory for shared code',
    passed: hasLib,
    details: hasLib ? 'Found lib directory' : 'No lib directory found',
    autoFixable: true,
  });

  // Namespaced structure
  const namespacedCount = directories.filter((d) => d.isNamespaced).length;
  const namespaceRatio = directories.length > 0 ? namespacedCount / directories.length : 0;
  checks.push({
    name: 'Structure: namespace organization',
    description: 'Directories use @namespace pattern',
    passed: namespaceRatio >= 0.8,
    details: `${namespacedCount}/${directories.length} directories namespaced (${Math.round(namespaceRatio * 100)}%)`,
    autoFixable: true,
  });

  // Barrel exports
  const hasBarrels = checkBarrelExports(projectRoot, directories);
  checks.push({
    name: 'Structure: barrel exports',
    description: 'Each namespace has index.ts barrel export',
    passed: hasBarrels,
    details: hasBarrels ? 'Barrel exports present' : 'Missing index.ts in some directories',
    autoFixable: true,
  });

  // Reasonable depth
  const depths = directories.map((d) => d.path.split('/').length);
  const maxDepth = Math.max(...depths, 0);
  const depthOk = maxDepth <= MAX_DEPTH;
  checks.push({
    name: 'Structure: reasonable depth',
    description: `Directory nesting is not too deep (max ${MAX_DEPTH} levels)`,
    passed: depthOk,
    details: `Max depth: ${maxDepth} levels`,
    autoFixable: false,
  });

  // Separation of concerns
  const hasSeparation =
    directories.some((d) => d.category === 'core') &&
    directories.some((d) => d.category === 'domain' || d.category === 'ui');
  checks.push({
    name: 'Structure: separation of concerns',
    description: 'Has distinct layers (core, domain/ui)',
    passed: hasSeparation || directories.length < MAX_DEPTH,
    details: hasSeparation ? 'Good layer separation' : 'Consider separating core from domain/ui',
    autoFixable: false,
  });

  return checks;
}

function checkBarrelExports(projectRoot: string, directories: DirectoryInfo[]): boolean {
  for (const dir of directories) {
    const indexPath = path.join(projectRoot, 'src', 'lib', dir.path, 'index.ts');
    if (!exists(indexPath)) {
      return false;
    }
  }
  return directories.length > 0;
}

// ============================================================================
// NAMING STANDARDS
// ============================================================================

function checkNamingStandards(projectRoot: string, directories: DirectoryInfo[]): StandardCheck[] {
  const checks: StandardCheck[] = [];

  // Consistent file naming
  const namingPatterns = analyzeFileNaming(projectRoot);
  checks.push({
    name: 'Naming: consistent file names',
    description: 'Files use consistent naming convention (kebab-case or camelCase)',
    passed: namingPatterns.isConsistent,
    details: namingPatterns.dominant
      ? `Dominant pattern: ${namingPatterns.dominant}`
      : 'Mixed naming patterns detected',
    autoFixable: true,
  });

  // Directory naming
  const allKebab = directories.every(
    (d) => d.name.match(/^@?[a-z][a-z0-9-]*$/) || d.name === 'unknown',
  );
  checks.push({
    name: 'Naming: directory names',
    description: 'Directories use kebab-case or @namespace pattern',
    passed: allKebab,
    details: allKebab
      ? 'All directories correctly named'
      : 'Some directories use non-standard naming',
    autoFixable: true,
  });

  return checks;
}

function analyzeFileNaming(projectRoot: string): {
  isConsistent: boolean;
  dominant: string | null;
} {
  const srcDir = path.join(projectRoot, 'src');
  if (!exists(srcDir)) {
    return { isConsistent: true, dominant: null };
  }

  const patterns = { kebab: 0, camel: 0, pascal: 0 };

  const files = findFiles(srcDir, { extensions: ['.ts', '.tsx'], skipDirs: ['node_modules'] });

  for (const file of files) {
    const name = path.basename(file).replace(/\.(ts|tsx)$/, '');
    if (name === 'index') continue;

    if (name.match(/^[a-z][a-z0-9-]*$/)) patterns.kebab++;
    else if (name.match(/^[a-z][a-zA-Z0-9]*$/)) patterns.camel++;
    else if (name.match(/^[A-Z][a-zA-Z0-9]*$/)) patterns.pascal++;
  }

  const total = patterns.kebab + patterns.camel + patterns.pascal;
  if (total === 0) {
    return { isConsistent: true, dominant: null };
  }

  const max = Math.max(patterns.kebab, patterns.camel, patterns.pascal);
  const ratio = max / total;
  const isConsistent = ratio >= 0.7;

  let dominant: string | null = null;
  if (max === patterns.kebab) dominant = 'kebab-case';
  else if (max === patterns.camel) dominant = 'camelCase';
  else dominant = 'PascalCase';

  return { isConsistent, dominant };
}

// ============================================================================
// DEPENDENCY STANDARDS
// ============================================================================

function checkDependencyStandards(projectRoot: string): StandardCheck[] {
  const checks: StandardCheck[] = [];

  // Lockfile present
  const monorepoRoot = findMonorepoRoot(projectRoot);
  const hasLock = hasLockfile(projectRoot) || (monorepoRoot !== null && hasLockfile(monorepoRoot));
  checks.push({
    name: 'Dependencies: lockfile present',
    description: 'Project has package manager lockfile',
    passed: hasLock,
    details: hasLock ? 'Lockfile found' : 'No lockfile found',
    autoFixable: true,
  });

  // No deprecated packages
  const pkg = readPackageJson(projectRoot);
  const deprecated = ['request', 'moment', 'lodash'];
  const hasDeprecated = deprecated.some((d) => pkg?.dependencies?.[d] || pkg?.devDependencies?.[d]);
  checks.push({
    name: 'Dependencies: no deprecated packages',
    description: 'Project avoids known deprecated packages',
    passed: !hasDeprecated,
    details: hasDeprecated
      ? 'Found deprecated packages (request, moment, lodash)'
      : 'No deprecated packages detected',
    autoFixable: false,
  });

  return checks;
}

function findMonorepoRoot(projectRoot: string): string | null {
  let current = projectRoot;
  const maxLevels = 5;

  for (let i = 0; i < maxLevels; i++) {
    const parent = path.dirname(current);
    if (parent === current) break;

    if (
      exists(path.join(parent, 'pnpm-workspace.yaml')) ||
      exists(path.join(parent, 'lerna.json')) ||
      (exists(path.join(parent, 'apps')) && exists(path.join(parent, 'packages')))
    ) {
      return parent;
    }

    current = parent;
  }

  return null;
}

function hasLockfile(dir: string): boolean {
  return (
    exists(path.join(dir, 'pnpm-lock.yaml')) ||
    exists(path.join(dir, 'package-lock.json')) ||
    exists(path.join(dir, 'yarn.lock')) ||
    exists(path.join(dir, 'bun.lockb'))
  );
}

// ============================================================================
// DOCUMENTATION STANDARDS
// ============================================================================

function checkDocumentationStandards(projectRoot: string): StandardCheck[] {
  const checks: StandardCheck[] = [];
  const monorepoRoot = findMonorepoRoot(projectRoot);

  // README exists
  const hasReadme =
    exists(path.join(projectRoot, 'README.md')) ||
    (monorepoRoot !== null && exists(path.join(monorepoRoot, 'README.md')));
  checks.push({
    name: 'Documentation: README exists',
    description: 'Project has README.md',
    passed: hasReadme,
    details: hasReadme ? 'README.md found' : 'No README.md',
    autoFixable: true,
  });

  // AI instructions
  const hasClaudeMd =
    exists(path.join(projectRoot, 'CLAUDE.md')) ||
    exists(path.join(projectRoot, '.claude')) ||
    (monorepoRoot !== null && exists(path.join(monorepoRoot, 'CLAUDE.md')));
  checks.push({
    name: 'Documentation: AI instructions',
    description: 'Project has CLAUDE.md or AI-specific instructions',
    passed: hasClaudeMd,
    details: hasClaudeMd ? 'AI instructions found' : 'Consider adding CLAUDE.md for AI assistance',
    autoFixable: true,
  });

  // TSDoc coverage
  const hasDocs = checkTsDocCoverage(projectRoot);
  checks.push({
    name: 'Documentation: code documentation',
    description: 'Code has JSDoc/TSDoc comments',
    passed: hasDocs,
    details: hasDocs ? 'Documentation found' : 'Consider adding JSDoc comments',
    autoFixable: false,
  });

  return checks;
}

function checkTsDocCoverage(projectRoot: string): boolean {
  const srcDir = path.join(projectRoot, 'src');
  if (!exists(srcDir)) return false;

  const files = findFiles(srcDir, {
    extensions: ['.ts', '.tsx'],
    skipDirs: ['node_modules'],
  }).slice(0, 10);

  for (const file of files) {
    const content = readFile(file);
    if (content?.includes('/**') && content.includes('*/')) {
      return true;
    }
  }

  return false;
}
