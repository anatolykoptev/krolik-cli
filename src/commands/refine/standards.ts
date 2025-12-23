/**
 * @module commands/refine/standards
 * @description Architecture standards compliance checker
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  DirectoryInfo,
  NamespaceCategory,
  StandardsCompliance,
  StandardCheck,
  ArchHealth,
  ArchViolation,
  ProjectContext,
} from './types';
import { NAMESPACE_INFO } from './analyzer';

// ============================================================================
// ARCHITECTURE HEALTH
// ============================================================================

/**
 * Clean Architecture layer order (lower number = lower layer)
 */
const LAYER_ORDER: Record<NamespaceCategory, number> = {
  utils: 0,       // Foundation - no dependencies
  core: 1,        // Infrastructure layer
  integrations: 2, // External services
  domain: 3,      // Business logic
  seo: 4,         // SEO module (self-contained)
  ui: 5,          // Presentation layer
  unknown: -1,
};

/**
 * Allowed dependencies for each category
 */
const ALLOWED_DEPS: Record<NamespaceCategory, NamespaceCategory[]> = {
  utils: [],                                    // No deps
  core: ['utils'],                              // Only utils
  integrations: ['utils', 'core'],              // Utils + core
  domain: ['utils', 'core', 'integrations'],    // No UI
  seo: ['utils', 'core', 'domain'],             // No UI
  ui: ['utils', 'core', 'domain', 'seo'],       // Everything except integrations directly
  unknown: [],
};

/**
 * Analyze architecture health
 */
export function analyzeArchHealth(
  directories: DirectoryInfo[],
  libDir: string,
): ArchHealth {
  const violations: ArchViolation[] = [];
  const dependencyGraph: Record<string, string[]> = {};
  const layerCompliance: ArchHealth['layerCompliance'] = {};

  // Build dependency graph from imports
  for (const dir of directories) {
    const dirPath = path.join(libDir, dir.path);
    const deps = analyzeDependencies(dirPath, libDir, directories);
    dependencyGraph[dir.name] = deps;

    // Check layer compliance
    const expectedLayer = LAYER_ORDER[dir.category];
    layerCompliance[dir.name] = {
      expected: dir.category,
      actual: dir.category,
      compliant: true,
    };

    // Check for violations
    for (const dep of deps) {
      const depDir = directories.find(d => d.name === dep || d.path === dep);
      if (!depDir) continue;

      const depLayer = LAYER_ORDER[depDir.category];

      // Layer violation: importing from higher layer
      if (depLayer > expectedLayer && dir.category !== 'unknown') {
        violations.push({
          type: 'layer-violation',
          severity: 'error',
          from: dir.name,
          to: depDir.name,
          message: `${dir.name} (${dir.category}) imports from ${depDir.name} (${depDir.category})`,
          fix: `Move shared code to a lower layer or use dependency injection`,
        });
        layerCompliance[dir.name].compliant = false;
      }

      // Check allowed dependencies
      if (!ALLOWED_DEPS[dir.category].includes(depDir.category) &&
          dir.category !== depDir.category &&
          dir.category !== 'unknown') {
        violations.push({
          type: 'layer-violation',
          severity: 'warning',
          from: dir.name,
          to: depDir.name,
          message: `${dir.category} should not directly import from ${depDir.category}`,
          fix: `Use abstraction or move code to appropriate layer`,
        });
      }
    }
  }

  // Check for circular dependencies
  const circular = findCircularDeps(dependencyGraph);
  for (const cycle of circular) {
    violations.push({
      type: 'circular',
      severity: 'error',
      from: cycle[0],
      to: cycle[cycle.length - 1],
      message: `Circular dependency: ${cycle.join(' → ')}`,
      fix: `Break the cycle by extracting shared code or using interfaces`,
    });
  }

  // Calculate score
  const score = calculateArchScore(violations, directories.length);

  return {
    score,
    violations,
    dependencyGraph,
    layerCompliance,
  };
}

/**
 * Analyze dependencies of a directory
 */
function analyzeDependencies(
  dirPath: string,
  libDir: string,
  allDirs: DirectoryInfo[],
): string[] {
  const deps = new Set<string>();

  if (!fs.existsSync(dirPath)) return [];

  // Read all .ts files
  const files = getAllTsFiles(dirPath);

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf-8');

      // Find imports
      const importMatches = content.matchAll(/from\s+['"]([^'"]+)['"]/g);
      for (const match of importMatches) {
        const importPath = match[1];

        // Check if it's a lib import
        if (importPath.includes('@/lib/') || importPath.includes('/lib/')) {
          // Extract the namespace/directory being imported
          const libMatch = importPath.match(/lib\/(@?[\w-]+)/);
          if (libMatch) {
            const depName = libMatch[1];
            // Find matching directory
            const depDir = allDirs.find(d =>
              d.name === depName ||
              d.path === depName ||
              d.name === `@${depName}` ||
              `@${d.name}` === depName
            );
            if (depDir && depDir.path !== path.relative(libDir, dirPath)) {
              deps.add(depDir.name);
            }
          }
        }
      }
    } catch {
      // Ignore read errors
    }
  }

  return Array.from(deps);
}

/**
 * Get all TypeScript files recursively
 */
function getAllTsFiles(dir: string): string[] {
  const files: string[] = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...getAllTsFiles(fullPath));
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        files.push(fullPath);
      }
    }
  } catch {
    // Ignore errors
  }

  return files;
}

/**
 * Find circular dependencies in graph
 */
function findCircularDeps(graph: Record<string, string[]>): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function dfs(node: string, path: string[]): void {
    visited.add(node);
    recursionStack.add(node);

    for (const dep of graph[node] || []) {
      if (!visited.has(dep)) {
        dfs(dep, [...path, dep]);
      } else if (recursionStack.has(dep)) {
        // Found cycle
        const cycleStart = path.indexOf(dep);
        if (cycleStart !== -1) {
          cycles.push([...path.slice(cycleStart), dep]);
        } else {
          cycles.push([...path, dep]);
        }
      }
    }

    recursionStack.delete(node);
  }

  for (const node of Object.keys(graph)) {
    if (!visited.has(node)) {
      dfs(node, [node]);
    }
  }

  return cycles;
}

/**
 * Calculate architecture health score
 */
function calculateArchScore(violations: ArchViolation[], dirCount: number): number {
  if (dirCount === 0) return 100;

  let penalty = 0;
  for (const v of violations) {
    if (v.severity === 'error') penalty += 15;
    else if (v.severity === 'warning') penalty += 5;
    else penalty += 2;
  }

  return Math.max(0, 100 - penalty);
}

// ============================================================================
// STANDARDS COMPLIANCE
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

  // Structure checks
  checks.push(...checkStructureStandards(projectRoot, directories, context));

  // Naming checks
  checks.push(...checkNamingStandards(projectRoot, directories));

  // Dependency checks
  checks.push(...checkDependencyStandards(projectRoot));

  // Documentation checks
  checks.push(...checkDocumentationStandards(projectRoot, directories));

  // Calculate scores
  const passed = checks.filter(c => c.passed).length;
  const total = checks.length;
  const score = total > 0 ? Math.round((passed / total) * 100) : 100;

  // Calculate category scores
  const categories = {
    structure: calcCategoryScore(checks, 'structure'),
    naming: calcCategoryScore(checks, 'naming'),
    dependencies: calcCategoryScore(checks, 'dependencies'),
    documentation: calcCategoryScore(checks, 'documentation'),
  };

  return { score, checks, categories };
}

function calcCategoryScore(checks: StandardCheck[], prefix: string): number {
  const categoryChecks = checks.filter(c => c.name.toLowerCase().includes(prefix));
  if (categoryChecks.length === 0) return 100;
  const passed = categoryChecks.filter(c => c.passed).length;
  return Math.round((passed / categoryChecks.length) * 100);
}

// ============================================================================
// STRUCTURE STANDARDS
// ============================================================================

function checkStructureStandards(
  projectRoot: string,
  directories: DirectoryInfo[],
  context: ProjectContext,
): StandardCheck[] {
  const checks: StandardCheck[] = [];

  // Check: Has lib directory
  const hasLib = directories.length > 0;
  checks.push({
    name: 'Structure: lib directory exists',
    description: 'Project has organized lib/ directory for shared code',
    passed: hasLib,
    details: hasLib ? 'Found lib directory' : 'No lib directory found',
    autoFixable: true,
  });

  // Check: Namespaced structure
  const namespacedCount = directories.filter(d => d.isNamespaced).length;
  const namespaceRatio = directories.length > 0 ? namespacedCount / directories.length : 0;
  checks.push({
    name: 'Structure: namespace organization',
    description: 'Directories use @namespace pattern',
    passed: namespaceRatio >= 0.8,
    details: `${namespacedCount}/${directories.length} directories namespaced (${Math.round(namespaceRatio * 100)}%)`,
    autoFixable: true,
  });

  // Check: Index barrel exports
  const hasBarrels = checkBarrelExports(projectRoot, directories);
  checks.push({
    name: 'Structure: barrel exports',
    description: 'Each namespace has index.ts barrel export',
    passed: hasBarrels,
    details: hasBarrels ? 'Barrel exports present' : 'Missing index.ts in some directories',
    autoFixable: true,
  });

  // Check: Consistent depth
  const depths = directories.map(d => d.path.split('/').length);
  const maxDepth = Math.max(...depths, 0);
  const depthOk = maxDepth <= 3;
  checks.push({
    name: 'Structure: reasonable depth',
    description: 'Directory nesting is not too deep (max 3 levels)',
    passed: depthOk,
    details: `Max depth: ${maxDepth} levels`,
    autoFixable: false,
  });

  // Check: Separation of concerns
  const hasSeparation = directories.some(d => d.category === 'core') &&
                       directories.some(d => d.category === 'domain' || d.category === 'ui');
  checks.push({
    name: 'Structure: separation of concerns',
    description: 'Has distinct layers (core, domain/ui)',
    passed: hasSeparation || directories.length < 3,
    details: hasSeparation ? 'Good layer separation' : 'Consider separating core from domain/ui',
    autoFixable: false,
  });

  return checks;
}

function checkBarrelExports(projectRoot: string, directories: DirectoryInfo[]): boolean {
  for (const dir of directories) {
    // Check for index.ts in lib/dir
    const indexPath = path.join(projectRoot, 'src', 'lib', dir.path, 'index.ts');
    if (!fs.existsSync(indexPath)) {
      return false;
    }
  }
  return directories.length > 0;
}

// ============================================================================
// NAMING STANDARDS
// ============================================================================

function checkNamingStandards(
  projectRoot: string,
  directories: DirectoryInfo[],
): StandardCheck[] {
  const checks: StandardCheck[] = [];

  // Check: Consistent file naming
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

  // Check: Directory naming
  const allKebab = directories.every(d =>
    d.name.match(/^@?[a-z][a-z0-9-]*$/) || d.name === 'unknown'
  );
  checks.push({
    name: 'Naming: directory names',
    description: 'Directories use kebab-case or @namespace pattern',
    passed: allKebab,
    details: allKebab ? 'All directories correctly named' : 'Some directories use non-standard naming',
    autoFixable: true,
  });

  return checks;
}

function analyzeFileNaming(projectRoot: string): { isConsistent: boolean; dominant: string | null } {
  const srcDir = path.join(projectRoot, 'src');
  if (!fs.existsSync(srcDir)) {
    return { isConsistent: true, dominant: null };
  }

  const patterns = {
    kebab: 0,
    camel: 0,
    pascal: 0,
  };

  function countFiles(dir: string): void {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          countFiles(path.join(dir, entry.name));
        } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
          const name = entry.name.replace(/\.(ts|tsx)$/, '');
          if (name === 'index') continue;

          if (name.match(/^[a-z][a-z0-9-]*$/)) patterns.kebab++;
          else if (name.match(/^[a-z][a-zA-Z0-9]*$/)) patterns.camel++;
          else if (name.match(/^[A-Z][a-zA-Z0-9]*$/)) patterns.pascal++;
        }
      }
    } catch {
      // Ignore errors
    }
  }

  countFiles(srcDir);

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

  // Check: Has lockfile
  const hasLock = fs.existsSync(path.join(projectRoot, 'pnpm-lock.yaml')) ||
                  fs.existsSync(path.join(projectRoot, 'package-lock.json')) ||
                  fs.existsSync(path.join(projectRoot, 'yarn.lock')) ||
                  fs.existsSync(path.join(projectRoot, 'bun.lockb'));
  checks.push({
    name: 'Dependencies: lockfile present',
    description: 'Project has package manager lockfile',
    passed: hasLock,
    details: hasLock ? 'Lockfile found' : 'No lockfile found',
    autoFixable: true,
  });

  // Check: No deprecated packages (simple check for known deprecated)
  const pkg = readPackageJson(projectRoot);
  const deprecated = ['request', 'moment', 'lodash'];
  const hasDeprecated = deprecated.some(d =>
    pkg?.dependencies?.[d] || pkg?.devDependencies?.[d]
  );
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

// ============================================================================
// DOCUMENTATION STANDARDS
// ============================================================================

function checkDocumentationStandards(
  projectRoot: string,
  directories: DirectoryInfo[],
): StandardCheck[] {
  const checks: StandardCheck[] = [];

  // Check: Has README
  const hasReadme = fs.existsSync(path.join(projectRoot, 'README.md'));
  checks.push({
    name: 'Documentation: README exists',
    description: 'Project has README.md',
    passed: hasReadme,
    details: hasReadme ? 'README.md found' : 'No README.md',
    autoFixable: true,
  });

  // Check: Has CLAUDE.md or AI instructions
  const hasClaudeMd = fs.existsSync(path.join(projectRoot, 'CLAUDE.md')) ||
                      fs.existsSync(path.join(projectRoot, '.claude'));
  checks.push({
    name: 'Documentation: AI instructions',
    description: 'Project has CLAUDE.md or AI-specific instructions',
    passed: hasClaudeMd,
    details: hasClaudeMd ? 'AI instructions found' : 'Consider adding CLAUDE.md for AI assistance',
    autoFixable: true,
  });

  // Check: TSDoc coverage (simplified)
  // Just check if any file has JSDoc comments
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
  if (!fs.existsSync(srcDir)) return false;

  try {
    const files = getAllTsFiles(srcDir).slice(0, 10); // Check first 10 files

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      if (content.includes('/**') && content.includes('*/')) {
        return true;
      }
    }
  } catch {
    // Ignore errors
  }

  return false;
}

// ============================================================================
// HELPERS
// ============================================================================

function readPackageJson(projectRoot: string): {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
} | null {
  try {
    const pkgPath = path.join(projectRoot, 'package.json');
    if (!fs.existsSync(pkgPath)) return null;
    return JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  } catch {
    return null;
  }
}
