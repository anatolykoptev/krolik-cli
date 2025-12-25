/**
 * @module commands/sync
 * @description Sync krolik documentation to CLAUDE.md
 *
 * This command manages the krolik section in CLAUDE.md to ensure
 * AI assistants always have up-to-date documentation.
 */

import chalk from 'chalk';
import {
  createMissingSubDocs,
  DOCS_VERSION,
  getMissingSubDocs,
  getSyncStatus,
  syncClaudeMd,
} from '../../lib';
import type { CommandContext } from '../../types';

interface SyncOptions {
  force?: boolean;
  dryRun?: boolean;
  status?: boolean;
  createSubdocs?: boolean;
}

/**
 * Run sync command
 */
export async function runSync(context: CommandContext & { options: SyncOptions }): Promise<void> {
  const { config, logger, options } = context;

  // Status mode
  if (options.status) {
    const status = getSyncStatus(config.projectRoot);

    logger.section('CLAUDE.md Sync Status');

    if (!status.exists) {
      console.log(chalk.yellow('⚠️  CLAUDE.md does not exist'));
      console.log(chalk.dim('   Run `krolik sync` to create it'));
      return;
    }

    if (!status.hasSection) {
      console.log(chalk.yellow('⚠️  Krolik section not found'));
      console.log(chalk.dim('   Run `krolik sync` to add it'));
      return;
    }

    if (status.needsUpdate) {
      console.log(chalk.yellow(`⚠️  Outdated version: ${status.version} → ${DOCS_VERSION}`));
      console.log(chalk.dim('   Run `krolik sync` to update'));
      return;
    }

    console.log(chalk.green(`✅ Up to date (v${status.version})`));
    return;
  }

  // Sync mode
  logger.section('Sync CLAUDE.md Documentation');

  const result = syncClaudeMd(config.projectRoot, {
    force: options.force ?? false,
    dryRun: options.dryRun ?? false,
  });

  if (options.dryRun) {
    console.log(chalk.dim('Dry run mode - no changes made\n'));
  }

  switch (result.action) {
    case 'created':
      console.log(chalk.green(`✅ Created ${result.path}`));
      console.log(chalk.dim(`   Version: ${result.version}`));
      break;

    case 'updated':
      console.log(chalk.green(`✅ Updated ${result.path}`));
      if (result.previousVersion) {
        console.log(chalk.dim(`   ${result.previousVersion} → ${result.version}`));
      } else {
        console.log(chalk.dim(`   Added krolik section (v${result.version})`));
      }
      break;

    case 'skipped':
      console.log(chalk.dim(`⏭️  Skipped - already up to date (v${result.version})`));
      if (!options.force) {
        console.log(chalk.dim('   Use --force to update anyway'));
      }
      break;
  }

  // Show what was done
  if (!options.dryRun && result.action !== 'skipped') {
    console.log('');
    console.log(chalk.dim('The krolik section in CLAUDE.md contains:'));
    console.log(chalk.dim('  • MCP tools documentation'));
    console.log(chalk.dim('  • CLI commands reference'));
    console.log(chalk.dim('  • Recommended workflow'));
    console.log(chalk.dim('  • AI agent rules'));
  }

  // Create missing sub-docs
  if (options.createSubdocs) {
    console.log('');
    logger.section('Create Missing Sub-docs');

    const missing = getMissingSubDocs(config.projectRoot);

    if (missing.length === 0) {
      console.log(chalk.green('✅ All sub-docs exist'));
      return;
    }

    console.log(chalk.dim(`Found ${missing.length} package(s) without CLAUDE.md:\n`));

    const results = createMissingSubDocs(config.projectRoot, {
      force: options.force,
      dryRun: options.dryRun,
    });

    for (const r of results) {
      switch (r.action) {
        case 'created':
          console.log(chalk.green(`✅ Created ${r.path}`));
          break;
        case 'skipped':
          if (r.error) {
            console.log(chalk.dim(`⏭️  Skipped ${r.path} (${r.error})`));
          } else {
            console.log(chalk.dim(`⏭️  Skipped ${r.path} (already exists)`));
          }
          break;
        case 'error':
          console.log(chalk.red(`❌ Error ${r.path}: ${r.error}`));
          break;
      }
    }

    const created = results.filter((r) => r.action === 'created').length;
    if (created > 0 && !options.dryRun) {
      console.log('');
      console.log(
        chalk.dim(
          `Created ${created} sub-doc(s). Run \`krolik sync --force\` to update main CLAUDE.md.`,
        ),
      );
    }
  }
}
