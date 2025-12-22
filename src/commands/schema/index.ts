/**
 * @module commands/schema
 * @description Prisma schema analysis command
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { CommandContext, SchemaResult } from '../../types';
import { parseSchemaDirectory, type PrismaModel, type PrismaEnum } from './parser';
import { printSchema, formatJson, formatMarkdown, type SchemaOutput } from './output';

/**
 * Schema command options
 */
export interface SchemaOptions {
  json?: boolean;
  markdown?: boolean;
  save?: boolean;
  groupBy?: 'file' | 'domain';
}

/**
 * Analyze Prisma schema
 */
export function analyzeSchema(schemaDir: string): SchemaOutput {
  const { models, enums } = parseSchemaDirectory(schemaDir);

  return {
    models,
    enums,
    modelCount: models.length,
    enumCount: enums.length,
  };
}

/**
 * Find prisma schema directory
 */
function findSchemaDir(projectRoot: string, configSchemaDir?: string): string | null {
  // Check config-specified path first
  if (configSchemaDir) {
    const configPath = path.isAbsolute(configSchemaDir)
      ? configSchemaDir
      : path.join(projectRoot, configSchemaDir);
    if (fs.existsSync(configPath)) return configPath;
  }

  // Common prisma locations
  const candidates = [
    'packages/db/prisma',     // Monorepo
    'prisma',                 // Standard
    'src/prisma',             // Some projects
    'db/prisma',              // Alternative
  ];

  for (const candidate of candidates) {
    const fullPath = path.join(projectRoot, candidate);
    if (fs.existsSync(fullPath)) return fullPath;
  }

  return null;
}

/**
 * Run schema command
 */
export async function runSchema(ctx: CommandContext & { options: SchemaOptions }): Promise<void> {
  const { config, logger, options } = ctx;

  // Find schema directory
  const schemaDir = findSchemaDir(config.projectRoot, config.prisma?.schemaDir);

  if (!schemaDir) {
    logger.error('Prisma schema directory not found');
    logger.info('Checked: prisma, packages/db/prisma, src/prisma, db/prisma');
    return;
  }

  const result = analyzeSchema(schemaDir);

  if (options.json) {
    console.log(formatJson(result));
    return;
  }

  if (options.markdown || options.save) {
    const md = formatMarkdown(result);

    if (options.save) {
      const outPath = path.join(config.projectRoot, 'SCHEMA.md');
      fs.writeFileSync(outPath, md, 'utf-8');
      logger.success(`Saved to: SCHEMA.md`);
    } else {
      console.log(md);
    }
    return;
  }

  printSchema(result, logger, options.groupBy ?? 'file');
}

// Re-export types
export type { PrismaModel, PrismaEnum } from './parser';
export type { SchemaOutput } from './output';
