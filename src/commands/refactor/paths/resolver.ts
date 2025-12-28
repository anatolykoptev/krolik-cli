/**
 * @module commands/refactor/paths/resolver
 * @description Path resolution logic for refactor command
 */

import * as path from 'node:path';
import { detectFeatures, detectMonorepoPackages, type MonorepoPackage } from '../../../config';
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
    return {
      targetPath,
      libPath,
      relativePath: getRelativePath(targetPath, projectRoot),
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
      console.log(`📦 Monorepo detected. Analyzing: ${pkg.name} (${pkg.libPath})`);
      console.log(`   Available packages: ${packages.map((p) => p.name).join(', ')}`);
      console.log(`   Use --package <name> to analyze a specific package\n`);

      return resolvePackagePaths(projectRoot, pkg, isTypeAnalysis ?? false);
    }
  }

  // Not a monorepo or no packages found - use default paths
  const defaultPath = isTypeAnalysis ? 'src' : path.join('src', 'lib');
  const targetPath = path.join(projectRoot, defaultPath);
  const libPath = isTypeAnalysis ? findLibPath(projectRoot) : targetPath;

  return {
    targetPath,
    libPath,
    relativePath: defaultPath,
  };
}

/**
 * Resolve paths for a specific monorepo package
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
    // For structure/function analysis, use the lib directory directly
    targetPath = libPath;
  }

  return {
    targetPath,
    libPath,
    relativePath: getRelativePath(targetPath, projectRoot),
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
