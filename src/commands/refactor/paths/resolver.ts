/**
 * @module commands/refactor/paths/resolver
 * @description Path resolution logic for refactor command
 */

import * as path from 'node:path';
import {
  detectFeatures,
  detectMonorepoPackages,
  detectSrcPaths,
  type MonorepoPackage,
} from '../../../config';
import { exists, relativePath as getRelativePath } from '../../../lib';
import type { RefactorOptions } from '../core';
import type { ResolvedPathsWithPackage } from './types';

/**
 * Resolve all paths for refactor analysis
 * Consolidates path detection logic for both analysis and migrations
 *
 * @param projectRoot - Project root directory
 * @param options - Refactor options
 * @returns Resolved paths and optional package info
 */
export function resolvePaths(
  projectRoot: string,
  options: RefactorOptions,
): ResolvedPathsWithPackage {
  const isTypeAnalysis = options.typesOnly || options.includeTypes || options.fixTypes;

  // If explicit path is provided
  if (options.path) {
    const targetPath = path.resolve(projectRoot, options.path);
    const libPath = resolveLibPath(targetPath, projectRoot, isTypeAnalysis ?? false);
    const relativePath = getRelativePath(targetPath, projectRoot);
    return {
      targetPath,
      targetPaths: [targetPath],
      libPath,
      relativePath,
      relativePaths: [relativePath],
    };
  }

  // Check if this is a monorepo
  const features = detectFeatures(projectRoot);

  if (features.monorepo) {
    const packages = detectMonorepoPackages(projectRoot);

    if (packages.length > 0) {
      // If --package specified, find that package
      if (options.package) {
        const pkg = packages.find((p) => p.name === options.package);
        if (!pkg) {
          const available = packages.map((p) => p.name).join(', ');
          throw new Error(
            `Package "${options.package}" not found or has no lib directory.\n` +
              `Available packages: ${available}`,
          );
        }
        return resolvePackagePaths(projectRoot, pkg, isTypeAnalysis ?? false);
      }

      // If --all-packages, return first package (caller will iterate)
      const firstPkg = packages[0];
      if (options.allPackages && firstPkg) {
        return resolvePackagePaths(projectRoot, firstPkg, isTypeAnalysis ?? false);
      }

      // No package specified - use first available (usually 'web')
      const pkg = packages.find((p) => p.name === 'web') ?? firstPkg;
      if (!pkg) {
        throw new Error('No packages found in monorepo');
      }
      const srcDirs = pkg.srcPaths.map((p) => p.split('/').pop()).join(', ');
      console.log(`📦 Monorepo detected. Analyzing: ${pkg.name} [${srcDirs}]`);
      console.log(`   Available packages: ${packages.map((p) => p.name).join(', ')}`);
      console.log(`   Use --package <name> to analyze a specific package\n`);

      return resolvePackagePaths(projectRoot, pkg, isTypeAnalysis ?? false);
    }
  }

  // Not a monorepo or no packages found - detect source paths dynamically
  const libPath = findLibPath(projectRoot);
  const targetPath = isTypeAnalysis ? path.dirname(libPath) : libPath;

  // Detect all source directories in src/ (for single-project structure)
  // This handles projects like: src/lib, src/commands, src/mcp, etc.
  const srcRoot = exists(path.join(projectRoot, 'src')) ? 'src' : '';
  const detectedPaths = srcRoot ? detectSrcPaths(projectRoot, srcRoot) : [];

  // Build target paths from detected directories
  let targetPaths: string[];
  let relativePaths: string[];

  if (detectedPaths.length > 0) {
    targetPaths = detectedPaths.map((p) => path.join(projectRoot, p));
    relativePaths = [...detectedPaths];

    // Ensure lib is always included and first
    const libRelPath = getRelativePath(libPath, projectRoot);
    if (!relativePaths.includes(libRelPath)) {
      targetPaths.unshift(libPath);
      relativePaths.unshift(libRelPath);
    }

    // Show detected paths
    const srcDirs = relativePaths.map((p) => p.split('/').pop()).join(', ');
    console.log(`📁 Single project. Analyzing: [${srcDirs}]\n`);
  } else {
    // Fallback to lib only
    targetPaths = [libPath];
    relativePaths = [getRelativePath(libPath, projectRoot)];
  }

  return {
    targetPath,
    targetPaths,
    libPath,
    relativePath: getRelativePath(targetPath, projectRoot),
    relativePaths,
  };
}

/**
 * Resolve paths for a specific monorepo package
 * Uses srcPaths from package detection for comprehensive analysis
 */
export function resolvePackagePaths(
  projectRoot: string,
  pkg: MonorepoPackage,
  isTypeAnalysis: boolean,
): ResolvedPathsWithPackage {
  const libPath = path.join(projectRoot, pkg.libPath);

  // For type analysis, find the src directory
  // Handles both structures:
  // - packages/api/src/lib -> packages/api/src
  // - apps/mobile/lib -> apps/mobile/src (or apps/mobile if no src exists)
  let targetPath: string;

  if (isTypeAnalysis) {
    if (pkg.libPath.includes('/src/lib')) {
      // Structure: packages/api/src/lib -> packages/api/src
      targetPath = path.dirname(libPath);
    } else {
      // Structure: apps/mobile/lib -> try apps/mobile/src, fallback to apps/mobile
      const pkgRoot = path.dirname(libPath);
      const srcPath = path.join(pkgRoot, 'src');
      targetPath = exists(srcPath) ? srcPath : pkgRoot;
    }
  } else {
    // For structure/function analysis, use the lib directory as primary
    targetPath = libPath;
  }

  // Build all target paths from srcPaths (detected dynamically)
  const targetPaths = pkg.srcPaths.map((srcPath) => path.join(projectRoot, srcPath));
  const relativePaths = [...pkg.srcPaths]; // Create a copy to avoid mutating original

  // Ensure libPath is always included and first
  if (!targetPaths.includes(libPath)) {
    targetPaths.unshift(libPath);
    relativePaths.unshift(pkg.libPath);
  }

  return {
    targetPath,
    targetPaths,
    libPath,
    relativePath: getRelativePath(targetPath, projectRoot),
    relativePaths,
    packageInfo: pkg,
  };
}

/**
 * Resolve libPath from targetPath
 */
export function resolveLibPath(
  targetPath: string,
  projectRoot: string,
  isTypeAnalysis: boolean,
): string {
  // If target looks like a lib directory, use it
  if (path.basename(targetPath) === 'lib' || targetPath.includes('/lib')) {
    return targetPath;
  }

  // Try to find lib within the target
  const libInTarget = path.join(targetPath, 'lib');
  const srcLibInTarget = path.join(targetPath, 'src', 'lib');

  if (exists(libInTarget)) {
    return libInTarget;
  }
  if (exists(srcLibInTarget)) {
    return srcLibInTarget;
  }

  // For type analysis, find lib at project root
  if (isTypeAnalysis) {
    return findLibPath(projectRoot);
  }

  // Fallback
  return path.join(targetPath, 'lib');
}

/**
 * Find lib directory at project root
 */
export function findLibPath(projectRoot: string): string {
  const srcLib = path.join(projectRoot, 'src', 'lib');
  const lib = path.join(projectRoot, 'lib');

  if (exists(srcLib)) return srcLib;
  if (exists(lib)) return lib;
  return srcLib; // Fallback
}
