/**
 * @module lib/@utils/@context/file-context
 * @description File context builder
 */

import { relative } from 'node:path';
import type { FileContext, FileContextOptions } from './types';
import {
  detectFileType,
  isCliFile,
  isTestFile,
  isConfigFile,
  isOutputFile,
  shouldSkipConsole,
  shouldSkipLint,
} from './detectors';

/**
 * Build file context for quality analysis and fixing
 *
 * @param absolutePath - Absolute file path
 * @param options - Context options
 * @returns FileContext object
 */
export function buildFileContext(
  absolutePath: string,
  options: FileContextOptions = {},
): FileContext {
  const { projectRoot = process.cwd(), forceType } = options;
  const relativePath = relative(projectRoot, absolutePath);
  const type = forceType ?? detectFileType(absolutePath);

  return {
    path: absolutePath,
    relativePath,
    type,
    skipLint: shouldSkipLint(absolutePath),
    skipConsole: shouldSkipConsole(absolutePath),
    isTest: isTestFile(absolutePath),
    isCli: isCliFile(absolutePath),
    isConfig: isConfigFile(absolutePath),
    isOutput: isOutputFile(absolutePath),
  };
}

/**
 * Build file context from relative path
 */
export function buildFileContextFromRelative(
  relativePath: string,
  projectRoot: string,
): FileContext {
  const absolutePath = `${projectRoot}/${relativePath}`;
  return buildFileContext(absolutePath, { projectRoot });
}

/**
 * Check if file context allows console statements
 */
export function contextAllowsConsole(ctx: FileContext): boolean {
  return ctx.skipConsole || ctx.isCli || ctx.isOutput || ctx.isTest;
}

/**
 * Check if file context requires strict linting
 */
export function contextRequiresStrictLint(ctx: FileContext): boolean {
  return !ctx.skipLint && !ctx.isConfig && ctx.type !== 'schema';
}
