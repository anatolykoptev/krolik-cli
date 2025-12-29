/**
 * @module lib/@discovery/architecture/scanner
 * @description Project architecture scanner
 *
 * Scans project structure to detect architectural patterns.
 * Uses utilities from core/fs and discovery for file system operations.
 */

import { relative } from 'node:path';
import {
  exists,
  getSubdirectories,
  isDirectory,
  isFile,
  listFiles,
  readFile,
  walkDirectories,
} from '../../@core/fs';
import { detectMonorepo } from '../project';

import { DEFAULT_DETECTORS } from './detectors';
import {
  ARCHITECTURE_SKIP_DIRS,
  type ArchitecturePatterns,
  type ArchitectureScanOptions,
  DEFAULT_MAX_DEPTH,
  type DetectedPattern,
  MAX_CONTENT_CHECK_SIZE,
  MAX_EXAMPLES,
  type PatternDetector,
  type ProjectType,
} from './types';

// ============================================================================
// MAIN API
// ============================================================================

/**
 * Collect architecture patterns from project structure
 *
 * Scans the project dynamically without hardcoded paths.
 * Detects patterns based on directory names, file patterns,
 * and content markers.
 *
 * @param projectRoot - Root directory of the project
 * @param options - Optional scan configuration
 * @returns Detected architecture patterns
 *
 * @example
 * ```typescript
 * const patterns = collectArchitecturePatterns('/path/to/project');
 * console.log(patterns.projectType); // 'monorepo' | 'single-app'
 * console.log(patterns.patterns); // DetectedPattern[]
 * ```
 */
export function collectArchitecturePatterns(
  projectRoot: string,
  options: ArchitectureScanOptions = {},
): ArchitecturePatterns {
  const {
    maxDepth = DEFAULT_MAX_DEPTH,
    skipDirs = [...ARCHITECTURE_SKIP_DIRS],
    detectors = [...DEFAULT_DETECTORS],
  } = options;

  // Determine project type
  const projectType = detectProjectType(projectRoot);

  // Collect scan roots based on project structure
  const scanRoots = collectScanRoots(projectRoot);

  // Scan each root for patterns
  const detectedPatterns: DetectedPattern[] = [];

  for (const scanRoot of scanRoots) {
    // Use walkDirectories from core/fs to scan directories
    walkDirectories(
      scanRoot,
      (fullPath, dirName) => {
        // Check each detector against this directory
        for (const detector of detectors) {
          if (matchesDirectoryPattern(dirName, detector.directoryPatterns)) {
            const detected = analyzeDirectory(fullPath, detector, projectRoot);
            if (detected) {
              detectedPatterns.push(detected);
            }
          }
        }
      },
      { maxDepth, skipDirs, skipHidden: true },
    );
  }

  // Merge duplicate patterns from different locations
  const mergedPatterns = mergePatterns(detectedPatterns);

  // Filter out empty patterns and sort by count
  const finalPatterns = mergedPatterns.filter((p) => p.count > 0).sort((a, b) => b.count - a.count);

  return {
    projectType,
    patterns: finalPatterns,
  };
}

// ============================================================================
// PROJECT TYPE DETECTION
// ============================================================================

/**
 * Detect if project is a monorepo or single app
 */
function detectProjectType(projectRoot: string): ProjectType {
  // Check for monorepo structure using discovery
  const monorepo = detectMonorepo(projectRoot);
  if (monorepo) {
    return 'monorepo';
  }

  // Check for common monorepo directories
  const hasApps = exists(`${projectRoot}/apps`);
  const hasPackages = exists(`${projectRoot}/packages`);

  return hasApps || hasPackages ? 'monorepo' : 'single-app';
}

// ============================================================================
// SCAN ROOT COLLECTION
// ============================================================================

/**
 * Collect all directories that should be scanned for patterns
 *
 * For monorepos, this includes:
 * - Project root
 * - Each package in packages/
 * - Each app in apps/
 * - src/ directories within each
 *
 * For single apps:
 * - Project root
 * - src/ if it exists
 */
function collectScanRoots(projectRoot: string): string[] {
  const roots: string[] = [projectRoot];

  // Add src/ at root level
  const rootSrc = `${projectRoot}/src`;
  if (isDirectory(rootSrc)) {
    roots.push(rootSrc);
  }

  // Add monorepo packages
  const packagesDir = `${projectRoot}/packages`;
  if (isDirectory(packagesDir)) {
    addWorkspaceRoots(packagesDir, roots);
  }

  // Add monorepo apps
  const appsDir = `${projectRoot}/apps`;
  if (isDirectory(appsDir)) {
    addWorkspaceRoots(appsDir, roots);
  }

  return roots;
}

/**
 * Add workspace package/app directories to scan roots
 */
function addWorkspaceRoots(workspaceDir: string, roots: string[]): void {
  const subdirs = getSubdirectories(workspaceDir);

  for (const subdir of subdirs) {
    if (subdir.startsWith('.')) continue;

    const packagePath = `${workspaceDir}/${subdir}`;
    roots.push(packagePath);

    // Also add src/ inside packages
    const srcPath = `${packagePath}/src`;
    if (isDirectory(srcPath)) {
      roots.push(srcPath);
    }
  }
}

// ============================================================================
// PATTERN MATCHING
// ============================================================================

/**
 * Check if directory name matches any of the patterns
 */
function matchesDirectoryPattern(dirName: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(dirName));
}

// ============================================================================
// DIRECTORY ANALYSIS
// ============================================================================

/**
 * Analyze a directory that matches a pattern detector
 *
 * Counts matching files and sub-modules, verifies content markers,
 * and collects examples.
 */
function analyzeDirectory(
  dir: string,
  detector: PatternDetector,
  projectRoot: string,
): DetectedPattern | null {
  const relativePath = relative(projectRoot, dir);

  let count = 0;
  const examples: string[] = [];

  // Count sub-modules (directories with index.ts or matching files)
  if (detector.detectSubModules) {
    const subModuleCount = countSubModules(dir, detector, examples);
    count += subModuleCount;
  }

  // Count matching files directly in the directory
  const fileCount = countMatchingFiles(dir, detector, examples);
  count += fileCount;

  // No matches found
  if (count === 0) {
    return null;
  }

  return {
    name: detector.name,
    description: detector.description,
    pattern: formatPatternTemplate(detector.patternTemplate, relativePath),
    examples: examples.slice(0, MAX_EXAMPLES),
    count,
  };
}

/**
 * Count sub-modules in a directory
 */
function countSubModules(dir: string, detector: PatternDetector, examples: string[]): number {
  const subdirs = getSubdirectories(dir);
  let count = 0;

  for (const subdir of subdirs) {
    if (subdir.startsWith('.') || subdir.startsWith('_')) continue;

    const subPath = `${dir}/${subdir}`;
    const files = listFiles(subPath);

    // Check for index file
    const hasIndex = files.includes('index.ts') || files.includes('index.tsx');

    // Check for matching files
    const hasMatchingFiles = detector.filePatterns
      ? files.some((f) => detector.filePatterns?.some((re) => re.test(f)))
      : files.some((f) => f.endsWith('.ts') || f.endsWith('.tsx'));

    if (hasIndex || hasMatchingFiles) {
      count++;
      if (examples.length < MAX_EXAMPLES) {
        examples.push(subdir);
      }
    }
  }

  return count;
}

/**
 * Count matching files in a directory
 */
function countMatchingFiles(dir: string, detector: PatternDetector, examples: string[]): number {
  const files = listFiles(dir);
  let count = 0;

  for (const file of files) {
    // Skip index files (already counted as modules)
    if (file === 'index.ts' || file === 'index.tsx') continue;

    const filePath = `${dir}/${file}`;
    if (!isFile(filePath)) continue;

    // Check file pattern
    if (!matchesFilePattern(file, detector.filePatterns)) continue;

    // Check content markers if defined
    if (detector.contentMarkers && detector.contentMarkers.length > 0) {
      if (!hasContentMarkers(filePath, detector.contentMarkers)) continue;
    }

    count++;
    if (examples.length < MAX_EXAMPLES) {
      examples.push(file.replace(/\.(ts|tsx)$/, ''));
    }
  }

  return count;
}

/**
 * Check if file matches any file pattern
 */
function matchesFilePattern(fileName: string, patterns?: RegExp[]): boolean {
  if (!patterns || patterns.length === 0) {
    // Default: match .ts and .tsx files
    return fileName.endsWith('.ts') || fileName.endsWith('.tsx');
  }
  return patterns.some((pattern) => pattern.test(fileName));
}

/**
 * Check if file contains any of the content markers
 *
 * Only reads the first MAX_CONTENT_CHECK_SIZE bytes for performance.
 */
function hasContentMarkers(filePath: string, markers: string[]): boolean {
  const content = readFileHead(filePath, MAX_CONTENT_CHECK_SIZE);
  if (!content) return false;

  return markers.some((marker) => content.includes(marker));
}

/**
 * Read first N bytes of a file
 */
function readFileHead(filePath: string, maxBytes: number): string | null {
  const content = readFile(filePath);
  if (!content) return null;

  return content.slice(0, maxBytes);
}

// ============================================================================
// PATTERN MERGING
// ============================================================================

/**
 * Merge duplicate patterns from different locations
 *
 * When the same pattern is detected in multiple places
 * (e.g., tRPC routers in both packages/api and apps/web),
 * merge them into a single entry with combined counts.
 */
function mergePatterns(patterns: DetectedPattern[]): DetectedPattern[] {
  const byName = new Map<string, DetectedPattern>();

  for (const pattern of patterns) {
    const existing = byName.get(pattern.name);

    if (existing) {
      // Merge counts
      existing.count += pattern.count;

      // Merge examples (avoid duplicates)
      for (const example of pattern.examples) {
        if (!existing.examples.includes(example) && existing.examples.length < MAX_EXAMPLES) {
          existing.examples.push(example);
        }
      }

      // Keep shorter pattern path (more specific)
      if (pattern.pattern.length < existing.pattern.length) {
        existing.pattern = pattern.pattern;
      }
    } else {
      // Clone pattern to avoid mutations
      byName.set(pattern.name, { ...pattern, examples: [...pattern.examples] });
    }
  }

  return Array.from(byName.values());
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Format pattern template with path placeholder
 */
function formatPatternTemplate(template: string, path: string): string {
  return template.replace('{path}', path);
}
