import { BasePlugin, type BaseTool, FunctionTool } from '@google/adk';
import { z } from 'zod';
import { ActionRuntime } from '../tools/runtime';

interface ActionPluginConfig {
  projectRoot: string;
  dryRun?: boolean;
  verbose?: boolean;
}

export class ActionPlugin extends BasePlugin {
  private runtime: ActionRuntime;

  constructor(config: ActionPluginConfig) {
    super('action-plugin');
    this.runtime = new ActionRuntime({
      projectRoot: config.projectRoot,
      dryRun: !!config.dryRun,
      verbose: !!config.verbose,
    });
  }

  /**
   * Return tools exposed by this plugin
   */
  getTools(): BaseTool[] {
    return [
      new FunctionTool({
        name: 'read_file',
        description: 'Read the contents of a file. Returns the full string content.',
        parameters: z.object({
          path: z.string().describe('Relative path to the file to read'),
        }),
        execute: async ({ path }) => {
          return this.runtime.readFile(path);
        },
      }),
      new FunctionTool({
        name: 'write_file',
        description:
          'Write content to a file. Overwrites existing content. Creates directories if needed.',
        parameters: z.object({
          path: z.string().describe('Relative path to the file'),
          content: z.string().describe('Content to write'),
        }),
        execute: async ({ path, content }) => {
          return this.runtime.writeFile(path, content);
        },
      }),
      new FunctionTool({
        name: 'replace_in_file',
        description:
          'Replace a specific string in a file with new content. Use this for small, precise edits.',
        parameters: z.object({
          path: z.string().describe('Relative path to the file'),
          search: z.string().describe('Exact string to replace (must match exactly)'),
          replace: z.string().describe('New content string'),
        }),
        execute: async ({ path, search, replace }) => {
          return this.runtime.replaceInFile(path, search, replace);
        },
      }),
      new FunctionTool({
        name: 'list_dir',
        description: 'List contents of a directory. Returns relative paths.',
        parameters: z.object({
          path: z.string().describe('Directory path to list'),
          depth: z.number().optional().describe('Traversal depth (default 1)'),
        }),
        execute: async ({ path, depth }) => {
          return this.runtime.listDir(path, depth);
        },
      }),
      new FunctionTool({
        name: 'run_command',
        description: 'Execute a shell command in the project root. Capture stdout and stderr.',
        parameters: z.object({
          command: z.string().describe('Shell command to execute'),
        }),
        execute: async ({ command }) => {
          return this.runtime.runCommand(command);
        },
      }),
      new FunctionTool({
        name: 'search_files',
        description: 'Search for files by name or keywords across the project.',
        parameters: z.object({
          keywords: z.array(z.string()).describe('Keywords or filename parts to search for'),
        }),
        execute: async ({ keywords }) => {
          return this.runtime.searchFiles(keywords);
        },
      }),
      new FunctionTool({
        name: 'grep_search',
        description: 'Search for string content in files (grep). Returns line numbers and content.',
        parameters: z.object({
          query: z.string().describe('String or pattern to search for'),
          includes: z
            .array(z.string())
            .optional()
            .describe('File patterns to include (e.g. "*.ts")'),
        }),
        execute: async ({ query, includes }) => {
          return this.runtime.grepSearch(query, includes);
        },
      }),
    ];
  }
}
