/**
 * @module commands/codegen
 * @description Code generation command
 *
 * Usage:
 *   krolik codegen trpc-route --name booking --path apps/web/src/server/routers
 *   krolik codegen zod-schema --name Booking --output packages/shared/src/schemas
 *   krolik codegen test --file apps/web/src/components/Button.tsx
 *   krolik codegen --list  # List available generators
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import chalk from 'chalk';
import type { BaseCommandOptions, CommandContext } from '../../types';
import { getAllGenerators, getGenerator, getValidTargets, isValidTarget } from './generators';
import { clearEnhancerCache } from './services/docs-enhancer';
import type { CodegenOptions, GeneratedFile, GeneratorTarget } from './types';

/**
 * Extended options for codegen command
 */
interface CodegenCommandOptions extends BaseCommandOptions, CodegenOptions {
  target?: string;
  noDocs?: boolean;
}

/**
 * List all available generators
 */
function listGenerators(): void {
  console.log(chalk.bold('\nAvailable Code Generators:\n'));

  const generators = getAllGenerators();

  for (const generator of generators) {
    const { id, name, description, example } = generator.metadata;
    console.log(`  ${chalk.cyan(id.padEnd(15))} ${name}`);
    console.log(`  ${''.padEnd(15)} ${chalk.dim(description)}`);
    console.log(`  ${''.padEnd(15)} ${chalk.dim.italic(example)}`);
    console.log('');
  }

  console.log(chalk.dim(`Valid targets: ${getValidTargets().join(', ')}`));
  console.log('');
}

/**
 * Format file preview for dry run
 */
function formatFilePreview(file: GeneratedFile, projectRoot: string): string {
  const lines: string[] = [];
  const fullPath = path.join(projectRoot, file.path);

  lines.push(chalk.bold(`\n${file.action.toUpperCase()}: ${file.path}`));
  lines.push(chalk.dim(`  Full path: ${fullPath}`));
  lines.push('');

  // Show first 30 lines of content
  const contentLines = file.content.split('\n');
  const preview = contentLines.slice(0, 30);

  for (let i = 0; i < preview.length; i++) {
    lines.push(chalk.dim(`${String(i + 1).padStart(3)} | `) + preview[i]);
  }

  if (contentLines.length > 30) {
    lines.push(chalk.dim(`... ${contentLines.length - 30} more lines`));
  }

  return lines.join('\n');
}

/**
 * Write generated files to disk
 */
function writeFiles(
  files: GeneratedFile[],
  projectRoot: string,
  options: { force?: boolean },
  logger: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  },
): { written: string[]; skipped: string[] } {
  const written: string[] = [];
  const skipped: string[] = [];

  for (const file of files) {
    const fullPath = path.join(projectRoot, file.path);
    const dir = path.dirname(fullPath);

    // Check if file exists
    if (fs.existsSync(fullPath) && !options.force) {
      logger.warn(`Skipping ${file.path} (exists, use --force to overwrite)`);
      skipped.push(file.path);
      continue;
    }

    // Create directory if needed
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write file
    try {
      if (file.action === 'append') {
        fs.appendFileSync(fullPath, file.content);
      } else {
        fs.writeFileSync(fullPath, file.content);
      }
      written.push(file.path);
      logger.info(`Created: ${file.path}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to write ${file.path}: ${msg}`);
      skipped.push(file.path);
    }
  }

  return { written, skipped };
}

/**
 * Run codegen command
 */
export async function runCodegen(
  context: CommandContext & { options: CodegenCommandOptions },
): Promise<void> {
  const { config, logger, options } = context;
  const projectRoot = config.projectRoot;

  // Handle --list flag
  if (options.list) {
    listGenerators();
    return;
  }

  // Get target from options
  const target = options.target as GeneratorTarget | undefined;

  if (!target) {
    logger.error('No target specified. Use --list to see available generators.');
    console.log(chalk.dim('  Example: krolik codegen trpc-route --name booking'));
    return;
  }

  // Validate target
  if (!isValidTarget(target)) {
    logger.error(`Invalid target: ${target}`);
    console.log(chalk.dim(`Valid targets: ${getValidTargets().join(', ')}`));
    return;
  }

  // Get generator
  const generator = getGenerator(target);
  if (!generator) {
    logger.error(`Generator not found: ${target}`);
    return;
  }

  logger.section(`Codegen: ${generator.metadata.name}`);

  // Prepare generator options
  const generatorOptions: import('./types').GeneratorOptions = {
    name: options.name ?? '',
    projectRoot,
    ...(options.path !== undefined || options.output !== undefined
      ? { path: options.path ?? options.output }
      : {}),
    ...(options.file !== undefined ? { file: options.file } : {}),
    ...(options.dryRun !== undefined ? { dryRun: options.dryRun } : {}),
    ...(options.force !== undefined ? { force: options.force } : {}),
    ...(options.noDocs !== undefined ? { noDocs: options.noDocs } : {}),
  };

  // Generate files
  let files: GeneratedFile[];
  try {
    files = generator.generate(generatorOptions);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error(msg);
    return;
  }

  if (files.length === 0) {
    logger.info('No files to generate.');
    return;
  }

  // Dry run: show preview
  if (options.dryRun) {
    console.log(chalk.yellow('\nDry run - no files will be written.\n'));

    for (const file of files) {
      console.log(formatFilePreview(file, projectRoot));
    }

    console.log(chalk.dim('\nRun without --dry-run to create files.'));
    return;
  }

  // Write files
  const { written, skipped } = writeFiles(
    files,
    projectRoot,
    { force: options.force ?? false },
    logger,
  );

  // Show docs enhancement info
  const enhancedFiles = files.filter((f) => f.docsEnhanced);
  if (enhancedFiles.length > 0) {
    console.log('');
    console.log(chalk.cyan('Docs Enhancement:'));
    for (const file of enhancedFiles) {
      const meta = file.docsEnhanced!;
      console.log(`  ${chalk.dim('-')} ${file.path}`);
      console.log(`    ${chalk.dim('Source:')} ${meta.library}`);
      if (meta.topics.length > 0) {
        console.log(`    ${chalk.dim('Topics:')} ${meta.topics.join(', ')}`);
      }
      console.log(`    ${chalk.dim('Snippets:')} ${meta.snippetsCount}`);
    }
  }

  // Summary
  console.log('');
  if (written.length > 0) {
    console.log(chalk.green(`Created ${written.length} file(s).`));
  }
  if (skipped.length > 0) {
    console.log(chalk.yellow(`Skipped ${skipped.length} file(s).`));
  }

  // Clear enhancer cache
  clearEnhancerCache();
}

export { getAllGenerators, getGenerator, getValidTargets, isValidTarget } from './generators';
// Re-export types and generators
export type {
  CodegenOptions,
  GeneratedFile,
  Generator,
  GeneratorOptions,
  GeneratorTarget,
} from './types';
