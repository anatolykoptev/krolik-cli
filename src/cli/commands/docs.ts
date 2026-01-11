/**
 * @module cli/commands/docs
 * @description Documentation cache CLI commands
 */

import type { Command } from 'commander';
import { addForceOption, addJsonOption, addProjectOption } from '../builders';
import type { CommandOptions } from '../types';
import { createContext } from './helpers';

/**
 * Register docs command with subcommands
 */
export function registerDocsCommand(program: Command): void {
  const docs = program.command('docs').description('Library documentation cache (Context7)');

  // docs fetch <library>
  const fetchCmd = docs.command('fetch <library>').description('Fetch documentation for a library');

  // Common options using builders
  addProjectOption(fetchCmd);
  addForceOption(fetchCmd);
  addJsonOption(fetchCmd);

  // Command-specific options
  fetchCmd
    .option('--topic <topic>', 'Specific topic to fetch (single topic)')
    .option('--topics <topics>', 'Comma-separated topics to fetch')
    .option('--with-topics', 'Use predefined topics for the library (recommended)')
    .option('--mode <mode>', 'Context7 mode: code or info', 'code')
    .option('--max-pages <n>', 'Maximum pages to fetch (general mode)', '10')
    .option('--pages-per-topic <n>', 'Pages per topic (multi-topic mode)', '3')
    .action(async (library: string, options: CommandOptions) => {
      const { runDocsFetch } = await import('../../commands/docs');
      const topics = options.topics
        ? String(options.topics)
            .split(',')
            .map((t: string) => t.trim())
        : undefined;
      const ctx = await createContext(program, {
        ...options,
        library,
        topics,
        withTopics: options.withTopics,
        maxPages: options.maxPages ? parseInt(String(options.maxPages), 10) : 10,
        pagesPerTopic: options.pagesPerTopic ? parseInt(String(options.pagesPerTopic), 10) : 3,
        format: options.json ? 'json' : 'ai',
      });
      await runDocsFetch(ctx as Parameters<typeof runDocsFetch>[0]);
    });

  // docs search <query>
  const searchCmd = docs.command('search <query>').description('Search cached documentation');

  // Common options using builders
  addProjectOption(searchCmd);
  addJsonOption(searchCmd);

  // Command-specific options
  searchCmd
    .option('--library <name>', 'Filter by library')
    .option('--topic <topic>', 'Filter by topic')
    .option('--limit <n>', 'Maximum results', '10')
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
  const listCmd = docs.command('list').description('List cached libraries');

  // Common options using builders
  addProjectOption(listCmd);
  addJsonOption(listCmd);

  // Command-specific options
  listCmd
    .option('--expired', 'Show only expired entries')
    .action(async (options: CommandOptions) => {
      const { runDocsList } = await import('../../commands/docs');
      const ctx = await createContext(program, {
        ...options,
        format: options.json ? 'json' : 'ai',
      });
      await runDocsList(ctx);
    });

  // docs detect
  const detectCmd = docs.command('detect').description('Detect libraries from package.json');

  // Common options using builders
  addProjectOption(detectCmd);
  addJsonOption(detectCmd);

  detectCmd.action(async (options: CommandOptions) => {
    const { runDocsDetect } = await import('../../commands/docs');
    const ctx = await createContext(program, {
      ...options,
      format: options.json ? 'json' : 'ai',
    });
    await runDocsDetect(ctx);
  });

  // docs clear
  const clearCmd = docs.command('clear').description('Clear documentation cache');

  // Common options using builders
  addProjectOption(clearCmd);
  addJsonOption(clearCmd);

  // Command-specific options
  clearCmd
    .option('--library <name>', 'Clear specific library only')
    .option('--expired', 'Clear only expired entries')
    .action(async (options: CommandOptions) => {
      const { runDocsClear } = await import('../../commands/docs');
      const ctx = await createContext(program, {
        ...options,
        format: options.json ? 'json' : 'ai',
      });
      await runDocsClear(ctx);
    });
}
