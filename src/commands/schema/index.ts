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
 * Run schema command
 */
export async function runSchema(ctx: CommandContext & { options: SchemaOptions }): Promise<void> {
  const { config, logger, options } = ctx;

  // Determine schema directory
  const schemaDir = config.prisma?.schemaDir
    ?? path.join(config.projectRoot, 'packages/db/prisma');

  if (!fs.existsSync(schemaDir)) {
    logger.error(`Prisma schema directory not found: ${schemaDir}`);
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
