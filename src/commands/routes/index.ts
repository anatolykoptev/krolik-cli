/**
 * @module commands/routes
 * @description tRPC routes analysis command
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { saveKrolikFile } from '../../lib';
import type { CommandContext, OutputFormat } from '../../types';
import {
  calculateStats,
  formatAI,
  formatJson,
  formatMarkdown,
  printRoutes,
  type RoutesOutput,
} from './output';
import { parseRoutersDirectory } from './parser';

/**
 * Routes command options
 */
export interface RoutesOptions {
  format?: OutputFormat;
  save?: boolean;
}

/**
 * Analyze tRPC routes
 */
export function analyzeRoutes(routersDir: string): RoutesOutput {
  const routers = parseRoutersDirectory(routersDir);
  return calculateStats(routers);
}

/**
 * Find tRPC routers directory
 */
function findRoutersDir(projectRoot: string, configRoutersDir?: string): string | null {
  // Check config-specified path first
  if (configRoutersDir) {
    const configPath = path.isAbsolute(configRoutersDir)
      ? configRoutersDir
      : path.join(projectRoot, configRoutersDir);
    if (fs.existsSync(configPath)) return configPath;
  }

  // Common tRPC router locations
  const candidates = [
    'packages/api/src/routers', // Monorepo
    'src/server/routers', // Next.js
    'src/routers', // Simple
    'server/routers', // Alternative
    'src/trpc/routers', // tRPC specific
  ];

  for (const candidate of candidates) {
    const fullPath = path.join(projectRoot, candidate);
    if (fs.existsSync(fullPath)) return fullPath;
  }

  return null;
}

/**
 * Run routes command
 */
export async function runRoutes(ctx: CommandContext & { options: RoutesOptions }): Promise<void> {
  const { config, logger, options } = ctx;

  // Find routers directory
  const routersDir = findRoutersDir(config.projectRoot, config.trpc?.routersDir);

  if (!routersDir) {
    logger.error('tRPC routers directory not found');
    logger.info('Checked: packages/api/src/routers, src/server/routers, src/routers');
    return;
  }

  const result = analyzeRoutes(routersDir);
  const format = options.format ?? 'ai';

  // Generate XML output for auto-saving
  const xmlOutput = formatAI(result);

  // Always save to .krolik/ROUTES.xml for AI access
  saveKrolikFile(config.projectRoot, 'ROUTES.xml', xmlOutput);

  // Handle --save option separately
  if (options.save) {
    const md = formatMarkdown(result);
    const outPath = path.join(config.projectRoot, 'ROUTES.md');
    fs.writeFileSync(outPath, md, 'utf-8');
    logger.success(`Saved to: ROUTES.md`);
    return;
  }

  if (format === 'json') {
    console.log(formatJson(result));
    return;
  }

  if (format === 'markdown') {
    console.log(formatMarkdown(result));
    return;
  }

  if (format === 'text') {
    printRoutes(result, logger);
    return;
  }

  // Default: AI-friendly XML
  console.log(xmlOutput);
}

export type { RoutesOutput } from './output';
// Re-export types
export type { TrpcProcedure, TrpcRouter } from './parser';
