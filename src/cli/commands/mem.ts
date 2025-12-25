/**
 * @module cli/commands/mem
 * @description Memory command registration
 */

import type { Command } from 'commander';

/** Command options type */
interface CommandOptions {
  [key: string]: unknown;
}

/** Helper to create command context */
async function createContext(program: Command, options: CommandOptions) {
  const { createContext: createCtx } = await import('../context');
  return createCtx(program, options);
}

/**
 * Register mem command with subcommands
 */
export function registerMemCommand(program: Command): void {
  const mem = program.command('mem').description('Memory system for persistent AI context');

  // mem save
  mem
    .command('save')
    .description('Save a memory entry')
    .requiredOption('--type <type>', 'Memory type: observation, decision, pattern, bugfix, feature')
    .requiredOption('--title <title>', 'Short title/summary')
    .requiredOption('--description <desc>', 'Detailed description')
    .option('--importance <level>', 'Importance: low, medium, high, critical', 'medium')
    .option('--tags <tags>', 'Comma-separated tags')
    .option('--files <files>', 'Comma-separated file paths')
    .option('--features <features>', 'Comma-separated features/domains')
    .option('--json', 'Output as JSON')
    .action(async (options: CommandOptions) => {
      const { runMemSave } = await import('../../commands/memory');
      const ctx = await createContext(program, {
        ...options,
        format: options.json ? 'json' : 'ai',
      });
      await runMemSave(ctx);
    });

  // mem search
  mem
    .command('search')
    .description('Search memory entries')
    .option('--query <query>', 'Search query (FTS5 full-text search)')
    .option('--type <type>', 'Filter by type: observation, decision, pattern, bugfix, feature')
    .option('--importance <level>', 'Filter by importance: low, medium, high, critical')
    .option('--tags <tags>', 'Filter by tags (comma-separated)')
    .option('--features <features>', 'Filter by features/domains (comma-separated)')
    .option('--project <name>', 'Filter by project name')
    .option('--limit <n>', 'Maximum results', '10')
    .option('--json', 'Output as JSON')
    .action(async (options: CommandOptions) => {
      const { runMemSearch } = await import('../../commands/memory');
      const ctx = await createContext(program, {
        ...options,
        limit: options.limit ? parseInt(String(options.limit), 10) : 10,
        format: options.json ? 'json' : 'ai',
      });
      await runMemSearch(ctx);
    });

  // mem recent
  mem
    .command('recent')
    .description('Get recent memory entries')
    .option('--limit <n>', 'Maximum entries', '10')
    .option('--type <type>', 'Filter by type')
    .option('--json', 'Output as JSON')
    .action(async (options: CommandOptions) => {
      const { runMemRecent } = await import('../../commands/memory');
      const ctx = await createContext(program, {
        ...options,
        limit: options.limit ? parseInt(String(options.limit), 10) : 10,
        format: options.json ? 'json' : 'ai',
      });
      await runMemRecent(ctx);
    });

  // mem stats
  mem
    .command('stats')
    .description('Show memory statistics')
    .option('--json', 'Output as JSON')
    .action(async (options: CommandOptions) => {
      const { runMemStats } = await import('../../commands/memory');
      const ctx = await createContext(program, {
        ...options,
        format: options.json ? 'json' : 'ai',
      });
      await runMemStats(ctx);
    });
}
