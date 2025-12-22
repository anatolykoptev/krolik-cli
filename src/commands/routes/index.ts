/**
 * @module commands/routes
 * @description tRPC routes analysis command
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { CommandContext, RoutesResult } from '../../types';
import { parseRoutersDirectory, type TrpcRouter, type TrpcProcedure } from './parser';
import { printRoutes, formatJson, formatMarkdown, calculateStats, type RoutesOutput } from './output';

/**
 * Routes command options
 */
export interface RoutesOptions {
  json?: boolean;
  markdown?: boolean;
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
    'packages/api/src/routers',   // Monorepo
    'src/server/routers',         // Next.js
    'src/routers',                // Simple
    'server/routers',             // Alternative
    'src/trpc/routers',           // tRPC specific
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

  if (options.json) {
    console.log(formatJson(result));
    return;
  }

  if (options.markdown || options.save) {
    const md = formatMarkdown(result);

    if (options.save) {
      const outPath = path.join(config.projectRoot, 'ROUTES.md');
      fs.writeFileSync(outPath, md, 'utf-8');
      logger.success(`Saved to: ROUTES.md`);
    } else {
      console.log(md);
    }
    return;
  }

  printRoutes(result, logger);
}

// Re-export types
export type { TrpcRouter, TrpcProcedure } from './parser';
export type { RoutesOutput } from './output';
