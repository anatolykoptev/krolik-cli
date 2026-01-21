/**
 * @module commands/refactor/analyzers/core/duplicates/parsing
 * @description File parsing and function extraction from source files
 *
 * PERFORMANCE: Uses incremental cache to avoid re-parsing unchanged files.
 * Cache stores extracted functions per file (hash-based).
 */

import * as path from 'node:path';
import {
  generateFingerprint,
  getProject,
  type Project,
  releaseProject,
} from '../../../../../lib/@ast';
import { calculateHash, loadCache, saveCache } from '../../../../../lib/@core/cache';
import { findFiles, readFile } from '../../../../../lib/@core/fs';
import { logger } from '../../../../../lib/@core/logger';
import { Spinner } from '../../../../../lib/@core/ui';
import type { FunctionSignature } from '../../../core/types';
import { findTsConfig, LIMITS } from '../../shared';
import { extractFunctionsSwc } from '../swc-parser';
import { extractFunctions } from './extraction';
import { normalizeBody } from './normalization';

/**
 * Parse a single file using SWC
 */
function parseFileWithSwc(
  file: string,
  projectRoot: string,
  verbose: boolean,
): FunctionSignature[] {
  const functions: FunctionSignature[] = [];

  try {
    const content = readFile(file);
    if (!content) return functions;

    // Skip large files
    if (content.length > LIMITS.MAX_FILE_SIZE) {
      if (verbose) {
        logger.warn(`Skipping large file: ${path.relative(projectRoot, file)}`);
      }
      return functions;
    }

    const relPath = path.relative(projectRoot, file);
    const swcFunctions = extractFunctionsSwc(file, content);

    // Convert SWC functions to FunctionSignature format
    for (const swcFunc of swcFunctions) {
      const bodyText = content.slice(swcFunc.bodyStart, swcFunc.bodyEnd);
      const normalizedBodyText = normalizeBody(bodyText);
      const tokens = new Set(normalizedBodyText.split(/\s+/).filter((t) => t.length > 0));

      // Calculate structural fingerprint for clone detection
      const fpResult = generateFingerprint(bodyText);

      functions.push({
        name: swcFunc.name,
        file: relPath,
        line: swcFunc.line,
        params: [], // SWC doesn't provide type info
        returnType: 'unknown',
        exported: swcFunc.isExported,
        bodyHash: swcFunc.bodyHash,
        normalizedBody: normalizedBodyText,
        tokens,
        isAsync: swcFunc.isAsync,
        paramCount: swcFunc.paramCount,
        // Fingerprint catches renamed clones (same structure, different identifiers)
        ...(fpResult.fingerprint && { fingerprint: fpResult.fingerprint }),
        ...(fpResult.complexity > 0 && { complexity: fpResult.complexity }),
      });
    }
  } catch (error) {
    if (verbose) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.warn(`Failed to parse ${path.relative(projectRoot, file)}: ${message}`);
    }
  }

  return functions;
}

/**
 * Parse files using SWC (fast path, 10-20x faster than ts-morph)
 *
 * PERFORMANCE: Uses incremental cache - unchanged files are not re-parsed.
 * Cache hit provides ~100x speedup for individual files.
 *
 * @param files - Absolute file paths to parse
 * @param projectRoot - Project root for relative path calculation
 * @param verbose - Enable verbose logging
 * @returns Extracted function signatures from all files
 */
export function parseFilesWithSwc(
  files: string[],
  projectRoot: string,
  verbose: boolean,
): FunctionSignature[] {
  // Load incremental cache
  const cache = loadCache(projectRoot);
  let cacheModified = false;
  let cacheHits = 0;
  let cacheMisses = 0;

  const allFunctions: FunctionSignature[] = [];

  // Initialize progress spinner
  const spinner = new Spinner(`Parsing ${files.length} files`);
  spinner.start();
  let processedFiles = 0;

  // Process each file with cache check
  for (const file of files) {
    processedFiles++;
    const percent = Math.round((processedFiles / files.length) * 100);
    spinner.update(
      `Parsing... ${percent}% (${processedFiles}/${files.length}) - Cache: ${cacheHits}/${processedFiles}`,
    );
    try {
      const content = readFile(file);
      if (!content) continue;

      // Skip large files
      if (content.length > LIMITS.MAX_FILE_SIZE) {
        if (verbose) {
          logger.warn(`Skipping large file: ${path.relative(projectRoot, file)}`);
        }
        continue;
      }

      const relativePath = path.relative(projectRoot, file);
      const hash = calculateHash(content);

      // Check cache
      const cached = cache.files[relativePath];
      if (cached && cached.hash === hash) {
        // Cache hit - reuse parsed functions
        const cachedFunctions = cached.result as FunctionSignature[] | undefined;
        if (cachedFunctions && Array.isArray(cachedFunctions)) {
          // Update file paths to absolute in case project moved
          const absoluteFunctions = cachedFunctions.map((fn) => ({
            ...fn,
            file: relativePath, // Keep relative for consistency
          }));
          allFunctions.push(...absoluteFunctions);
          cacheHits++;
          continue;
        }
      }

      // Cache miss - parse file
      cacheMisses++;
      const functions = parseFileWithSwc(file, projectRoot, verbose);
      allFunctions.push(...functions);

      // Update cache
      cache.files[relativePath] = {
        hash,
        timestamp: Date.now(),
        result: functions,
      };
      cacheModified = true;
    } catch (error) {
      if (verbose) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.warn(`Failed to process ${path.relative(projectRoot, file)}: ${message}`);
      }
    }
  }

  // Stop spinner
  spinner.stop();

  // Log cache statistics
  const total = cacheHits + cacheMisses;
  const hitRate = total > 0 ? Math.round((cacheHits / total) * 100) : 0;
  console.log(`✓ Parsed ${files.length} files - Cache: ${cacheHits} hits (${hitRate}% hit rate)`);

  // Save cache if modified
  if (cacheModified) {
    saveCache(projectRoot, cache);
  }

  return allFunctions;
}

/**
 * Parse files using ts-morph (slow path, full type information)
 */
export function parseFilesWithTsMorph(
  files: string[],
  projectRoot: string,
  targetPath: string,
  verbose: boolean,
  existingProject?: Project,
): FunctionSignature[] {
  const allFunctions: FunctionSignature[] = [];

  const project =
    existingProject ??
    (() => {
      const tsConfigPath = findTsConfig(targetPath, projectRoot);
      return tsConfigPath ? getProject({ tsConfigPath }) : getProject({});
    })();

  const shouldReleaseProject = !existingProject;

  try {
    for (const file of files) {
      try {
        const content = readFile(file);
        if (!content) continue;

        // Skip large files
        if (content.length > LIMITS.MAX_FILE_SIZE) {
          if (verbose) {
            logger.warn(`Skipping large file: ${path.relative(projectRoot, file)}`);
          }
          continue;
        }

        // Add source file to project if not already there
        let sourceFile = project.getSourceFile(file);
        if (!sourceFile) {
          sourceFile = project.createSourceFile(file, content, {
            overwrite: true,
          });
        }

        const relPath = path.relative(projectRoot, file);
        const functions = extractFunctions(sourceFile, relPath);
        allFunctions.push(...functions);
      } catch (error) {
        if (verbose) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          logger.warn(`Failed to parse ${path.relative(projectRoot, file)}: ${message}`);
        }
        // Continue processing other files
      }
    }
  } finally {
    // Release project back to pool if we created it
    if (shouldReleaseProject) {
      releaseProject(project);
    }
  }

  return allFunctions;
}

/**
 * Find and filter TypeScript files for analysis
 */
export async function findSourceFiles(targetPath: string, ignoreTests: boolean): Promise<string[]> {
  const allFiles = await findFiles(targetPath, {
    extensions: ['.ts', '.tsx'],
    skipDirs: ['node_modules', 'dist', '.next', 'coverage'],
  });

  // Filter out test files and .d.ts
  let files = allFiles.filter((f) => !f.endsWith('.d.ts'));
  if (ignoreTests) {
    files = files.filter((f) => !f.includes('.test.') && !f.includes('.spec.'));
  }

  // Resource exhaustion protection
  if (files.length > LIMITS.MAX_FILES) {
    logger.warn(`Too many files (${files.length}), limiting to ${LIMITS.MAX_FILES}`);
    files = files.slice(0, LIMITS.MAX_FILES);
  }

  return files;
}
