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
 * Run routes command
 */
export async function runRoutes(ctx: CommandContext & { options: RoutesOptions }): Promise<void> {
  const { config, logger, options } = ctx;

  // Determine routers directory
  const routersDir = config.trpc?.routersDir ?? path.join(config.projectRoot, 'packages/api/src/routers');

  if (!fs.existsSync(routersDir)) {
    logger.error(`Routers directory not found: ${routersDir}`);
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
