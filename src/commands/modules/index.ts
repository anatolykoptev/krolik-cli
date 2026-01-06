/**
 * @module commands/modules
 * @description Analyze reusable lib modules
 */

import { detectLibPaths, getModule, scanLibModules, searchExports } from '@/lib/@discovery';
import type { CommandContext } from '@/types';

export interface ModulesOptions {
  action?: 'list' | 'search' | 'get' | 'paths';
  query?: string;
  module?: string;
}

/**
 * Run modules command
 */
export async function runModules(ctx: CommandContext, options: ModulesOptions = {}): Promise<void> {
  const { config, logger, options: cmdOptions } = ctx;
  const projectRoot = config.projectRoot;
  const outputFormat = cmdOptions.format ?? 'text';
  const action = options.action ?? 'list';

  // Detect lib paths first
  const detected = detectLibPaths(projectRoot);

  if (action === 'paths') {
    printPathsResult(detected, outputFormat, logger);
    return;
  }

  // Scan modules
  const result = scanLibModules(projectRoot);

  switch (action) {
    case 'list':
      printListResult(result, detected, outputFormat, logger);
      break;
    case 'search':
      if (!options.query) {
        logger.error('Query is required for search action');
        return;
      }
      printSearchResult(result, options.query, outputFormat, logger);
      break;
    case 'get':
      if (!options.module) {
        logger.error('Module name is required for get action');
        return;
      }
      printGetResult(result, options.module, outputFormat, logger);
      break;
    default:
      logger.error(`Unknown action: ${action}`);
  }
}

interface Logger {
  info(msg: string): void;
  error(msg: string): void;
}

function printPathsResult(
  detected: ReturnType<typeof detectLibPaths>,
  outputFormat: string,
  logger: Logger,
): void {
  if (outputFormat === 'json') {
    console.log(JSON.stringify(detected, null, 2));
    return;
  }

  logger.info('Detected lib paths:');
  console.log('');

  if (detected.paths.length === 0) {
    console.log('  No lib directories found.');
    console.log('  Checked: src/lib, lib, apps/*/lib, packages/*/src');
  } else {
    for (const d of detected.detected) {
      const pkg = d.packageName ? ` (${d.packageName})` : '';
      console.log(`  [${d.type}] ${d.path}${pkg}`);
    }
  }
}

function printListResult(
  result: ReturnType<typeof scanLibModules>,
  detected: ReturnType<typeof detectLibPaths>,
  outputFormat: string,
  logger: Logger,
): void {
  if (outputFormat === 'json') {
    console.log(JSON.stringify({ ...result, detected: detected.detected }, null, 2));
    return;
  }

  if (result.modules.length === 0) {
    logger.info('No lib modules found.');
    console.log('');
    if (detected.paths.length === 0) {
      console.log('Checked: src/lib, lib, apps/*/lib, packages/*/src');
      console.log('Hint: Create a lib directory with @-prefixed modules');
    } else {
      console.log('Searched in:');
      for (const d of detected.detected) {
        console.log(`  - ${d.path}`);
      }
      console.log('');
      console.log('Hint: Modules need an index.ts file to be discovered');
    }
    return;
  }

  logger.info(`Found ${result.modules.length} modules with ${result.totalExports} exports`);
  console.log('');

  for (const mod of result.modules) {
    const funcCount = mod.exports.filter((e) => e.kind === 'function').length;
    const typeCount = mod.exports.filter((e) =>
      ['type', 'interface', 'enum'].includes(e.kind),
    ).length;

    console.log(`${mod.importPath}`);
    console.log(`  ${funcCount} functions, ${typeCount} types`);

    if (mod.description) {
      const desc =
        mod.description.length > 80 ? `${mod.description.slice(0, 80)}...` : mod.description;
      console.log(`  ${desc}`);
    }

    const topExports = mod.exports.slice(0, 5).map((e) => e.name);
    if (topExports.length > 0) {
      const more = mod.exports.length > 5 ? ` (+${mod.exports.length - 5} more)` : '';
      console.log(`  Exports: ${topExports.join(', ')}${more}`);
    }
    console.log('');
  }
}

function printSearchResult(
  result: ReturnType<typeof scanLibModules>,
  query: string,
  outputFormat: string,
  logger: Logger,
): void {
  const matches = searchExports(result, query);

  if (outputFormat === 'json') {
    console.log(JSON.stringify({ query, matches }, null, 2));
    return;
  }

  if (matches.length === 0) {
    logger.info(`No exports found matching "${query}"`);
    return;
  }

  logger.info(`Found ${matches.length} exports matching "${query}":`);
  console.log('');

  for (const match of matches) {
    const asyncPrefix = match.export.isAsync ? 'async ' : '';
    const signature = match.export.signature ?? '';
    console.log(`${match.module.importPath}`);
    console.log(`  ${asyncPrefix}${match.export.name}${signature} (${match.export.kind})`);
    console.log('');
  }
}

function printGetResult(
  result: ReturnType<typeof scanLibModules>,
  moduleName: string,
  outputFormat: string,
  logger: Logger,
): void {
  const mod = getModule(result, moduleName);

  if (!mod) {
    const available = result.modules.map((m) => m.name).join(', ');
    logger.error(`Module "${moduleName}" not found. Available: ${available}`);
    return;
  }

  if (outputFormat === 'json') {
    console.log(JSON.stringify(mod, null, 2));
    return;
  }

  console.log(`Module: ${mod.name}`);
  console.log(`Import: ${mod.importPath}`);
  console.log(`Path: ${mod.relativePath}`);

  if (mod.description) {
    console.log(`Description: ${mod.description}`);
  }

  console.log('');

  // Group by kind
  const functions = mod.exports.filter((e) => e.kind === 'function');
  const types = mod.exports.filter((e) => ['type', 'interface'].includes(e.kind));
  const enums = mod.exports.filter((e) => e.kind === 'enum');
  const classes = mod.exports.filter((e) => e.kind === 'class');
  const consts = mod.exports.filter((e) => e.kind === 'const');

  if (functions.length > 0) {
    console.log(`Functions (${functions.length}):`);
    for (const fn of functions) {
      const asyncPrefix = fn.isAsync ? 'async ' : '';
      console.log(`  ${asyncPrefix}${fn.name}${fn.signature ?? '()'}`);
    }
    console.log('');
  }

  if (types.length > 0) {
    console.log(`Types (${types.length}): ${types.map((t) => t.name).join(', ')}`);
    console.log('');
  }

  if (enums.length > 0) {
    console.log(`Enums (${enums.length}): ${enums.map((e) => e.name).join(', ')}`);
    console.log('');
  }

  if (classes.length > 0) {
    console.log(`Classes (${classes.length}): ${classes.map((c) => c.name).join(', ')}`);
    console.log('');
  }

  if (consts.length > 0) {
    console.log(`Constants (${consts.length}): ${consts.map((c) => c.name).join(', ')}`);
  }
}
