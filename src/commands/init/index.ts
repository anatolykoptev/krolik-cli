/**
 * @module commands/init
 * @description Project initialization command
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CommandContext } from '../../types';
import { createDefaultConfig } from '../../config';

interface InitOptions {
  force?: boolean;
  typescript?: boolean;
}

const CONFIG_TEMPLATE = `import { defineConfig } from 'krolik-cli';

export default defineConfig({
  // Project name (auto-detected from package.json if not specified)
  // name: 'my-project',

  // Custom paths (auto-detected if not specified)
  // paths: {
  //   web: 'apps/web',
  //   api: 'packages/api',
  //   db: 'packages/db',
  //   components: 'apps/web/components',
  // },

  // Feature detection overrides (auto-detected if not specified)
  // features: {
  //   prisma: true,
  //   trpc: true,
  //   nextjs: true,
  //   monorepo: true,
  // },

  // Prisma configuration
  // prisma: {
  //   schemaPath: 'packages/db/prisma/schema',
  // },

  // tRPC configuration
  // trpc: {
  //   routerPath: 'packages/api/src/routers',
  // },

  // Files/directories to exclude from analysis
  // exclude: ['node_modules', 'dist', '.next', '.git'],
});
`;

export async function runInit(context: CommandContext & { options: InitOptions }): Promise<void> {
  const { logger, config, options } = context;

  logger.section('Initialize Krolik Config');

  const configPath = join(config.projectRoot, 'krolik.config.ts');

  try {
    writeFileSync(configPath, CONFIG_TEMPLATE, { flag: options.force ? 'w' : 'wx' });
    logger.success(`Created ${configPath}`);
    logger.info('Edit the config file to customize settings for your project.');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      logger.warn('Config file already exists. Use --force to overwrite.');
    } else {
      throw error;
    }
  }
}
