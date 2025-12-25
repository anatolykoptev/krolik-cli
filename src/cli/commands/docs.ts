/**
 * @module cli/commands/docs
 * @description Documentation cache CLI commands
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
 * Register docs command with subcommands
 */
export function registerDocsCommand(program: Command): void {
  const docs = program.command('docs').description('Library documentation cache (Context7)');

  // docs fetch <library>
  docs
    .command('fetch <library>')
    .description('Fetch documentation for a library')
    .option('--topic <topic>', 'Specific topic to fetch')
    .option('--mode <mode>', 'Context7 mode: code or info', 'code')
    .option('--force', 'Force refresh even if not expired')
    .option('--max-pages <n>', 'Maximum pages to fetch', '3')
    .option('--json', 'Output as JSON')
    .action(async (library: string, options: CommandOptions) => {
      const { runDocsFetch } = await import('../../commands/docs');
      const ctx = await createContext(program, {
        ...options,
        library,
        maxPages: options.maxPages ? parseInt(String(options.maxPages), 10) : 3,
        format: options.json ? 'json' : 'ai',
      });
      await runDocsFetch(ctx as Parameters<typeof runDocsFetch>[0]);
    });

  // docs search <query>
  docs
    .command('search <query>')
    .description('Search cached documentation')
    .option('--library <name>', 'Filter by library')
    .option('--topic <topic>', 'Filter by topic')
    .option('--limit <n>', 'Maximum results', '10')
    .option('--json', 'Output as JSON')
    .action(async (query: string, options: CommandOptions) => {
      const { runDocsSearch } = await import('../../commands/docs');
      const ctx = await createContext(program, {
        ...options,
        query,
        limit: options.limit ? parseInt(String(options.limit), 10) : 10,
        format: options.json ? 'json' : 'ai',
      });
      await runDocsSearch(ctx as Parameters<typeof runDocsSearch>[0]);
    });

  // docs list
  docs
    .command('list')
    .description('List cached libraries')
    .option('--expired', 'Show only expired entries')
    .option('--json', 'Output as JSON')
    .action(async (options: CommandOptions) => {
      const { runDocsList } = await import('../../commands/docs');
      const ctx = await createContext(program, {
        ...options,
        format: options.json ? 'json' : 'ai',
      });
      await runDocsList(ctx);
    });

  // docs detect
  docs
    .command('detect')
    .description('Detect libraries from package.json')
    .option('--json', 'Output as JSON')
    .action(async (options: CommandOptions) => {
      const { runDocsDetect } = await import('../../commands/docs');
      const ctx = await createContext(program, {
        ...options,
        format: options.json ? 'json' : 'ai',
      });
      await runDocsDetect(ctx);
    });

  // docs clear
  docs
    .command('clear')
    .description('Clear documentation cache')
    .option('--library <name>', 'Clear specific library only')
    .option('--expired', 'Clear only expired entries')
    .option('--json', 'Output as JSON')
    .action(async (options: CommandOptions) => {
      const { runDocsClear } = await import('../../commands/docs');
      const ctx = await createContext(program, {
        ...options,
        format: options.json ? 'json' : 'ai',
      });
      await runDocsClear(ctx);
    });
}
