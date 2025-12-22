/**
 * @module bin/cli
 * @description AI Rabbit CLI entry point
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig } from '../config';
import { createLogger } from '../lib/logger';

const VERSION = '1.0.0';

/**
 * ASCII art logo
 */
const LOGO = `
${chalk.cyan('╔══════════════════════════════════════════════════════════════╗')}
${chalk.cyan('║')}  ${chalk.bold.white('🐰 AI RABBIT TOOLKIT')} ${chalk.dim(`v${VERSION}`)}                            ${chalk.cyan('║')}
${chalk.cyan('║')}  ${chalk.dim('Fast AI-assisted development for TypeScript projects')}       ${chalk.cyan('║')}
${chalk.cyan('╚══════════════════════════════════════════════════════════════╝')}
`;

/** Command options type */
interface CommandOptions {
  [key: string]: unknown;
}

/** Helper to create command context */
async function createContext(program: Command, options: CommandOptions) {
  const config = await loadConfig();
  const globalOpts = program.opts();
  const logger = createLogger({ level: globalOpts.verbose ? 'debug' : 'info' });
  return { config, logger, options: { ...globalOpts, ...options } };
}

/**
 * Create main CLI program
 */
function createProgram(): Command {
  const program = new Command();

  program
    .name('rabbit')
    .description('AI Rabbit — fast AI-assisted development toolkit')
    .version(VERSION, '-V, --version', 'Output version number')
    .option('-c, --config <path>', 'Path to config file')
    .option('--project-root <path>', 'Project root directory')
    .option('--json', 'Output as JSON')
    .option('-v, --verbose', 'Verbose output')
    .option('--no-color', 'Disable colored output');

  // Status command
  program
    .command('status')
    .description('Quick project diagnostics')
    .option('--fast', 'Skip slow checks (typecheck, lint)')
    .action(async (options: CommandOptions) => {
      const { runStatus } = await import('../commands/status');
      const ctx = await createContext(program, options);
      await runStatus(ctx);
    });

  // Review command
  program
    .command('review')
    .description('AI-assisted code review')
    .option('--pr <number>', 'Review specific PR')
    .option('--staged', 'Review staged changes only')
    .option('-o, --output <format>', 'Output format (text, json, markdown)')
    .action(async (options: CommandOptions) => {
      const { runReview } = await import('../commands/review');
      const ctx = await createContext(program, options);
      await runReview(ctx);
    });

  // Schema command
  program
    .command('schema')
    .description('Analyze Prisma schema')
    .option('--save', 'Save to SCHEMA.md')
    .action(async (options: CommandOptions) => {
      const { runSchema } = await import('../commands/schema');
      const ctx = await createContext(program, options);
      await runSchema(ctx);
    });

  // Routes command
  program
    .command('routes')
    .description('Analyze tRPC routes')
    .option('--save', 'Save to ROUTES.md')
    .action(async (options: CommandOptions) => {
      const { runRoutes } = await import('../commands/routes');
      const ctx = await createContext(program, options);
      await runRoutes(ctx);
    });

  // Issue command
  program
    .command('issue [number]')
    .description('Parse GitHub issue')
    .option('-u, --url <url>', 'Issue URL')
    .option('-o, --output <format>', 'Output format (text, json, markdown)')
    .action(async (number: string | undefined, options: CommandOptions) => {
      const { runIssue } = await import('../commands/issue');
      const ctx = await createContext(program, {
        ...options,
        number: number ? parseInt(number, 10) : undefined,
      });
      await runIssue(ctx);
    });

  // Context command
  program
    .command('context')
    .description('Generate AI context for a task')
    .option('--issue <number>', 'Context for GitHub issue')
    .option('--feature <name>', 'Context for feature')
    .option('--file <path>', 'Context for file')
    .action(async (options: CommandOptions) => {
      const { runContext } = await import('../commands/context');
      const ctx = await createContext(program, options);
      await runContext(ctx);
    });

  // Codegen command
  program
    .command('codegen <target>')
    .description('Generate code (hooks, schemas, tests, barrels, docs)')
    .option('--path <path>', 'Target path')
    .option('--dry-run', 'Preview without changes')
    .option('--force', 'Overwrite existing files')
    .action(async (target: string, options: CommandOptions) => {
      const { runCodegen } = await import('../commands/codegen');
      const ctx = await createContext(program, { ...options, target });
      await runCodegen(ctx);
    });

  // Security command
  program
    .command('security')
    .description('Run security audit')
    .option('--fix', 'Attempt to fix issues')
    .action(async (options: CommandOptions) => {
      const { runSecurity } = await import('../commands/security');
      const ctx = await createContext(program, options);
      await runSecurity(ctx);
    });

  // Init command
  program
    .command('init')
    .description('Initialize rabbit.config.ts')
    .option('--force', 'Overwrite existing config')
    .action(async (options: CommandOptions) => {
      const { runInit } = await import('../commands/init');
      const ctx = await createContext(program, options);
      await runInit(ctx);
    });

  // MCP server command
  program
    .command('mcp')
    .description('Start MCP server for Claude Code')
    .option('-p, --port <port>', 'Server port', '3100')
    .action(async (options: CommandOptions) => {
      const { startMCPServer } = await import('../mcp/server');
      const config = await loadConfig();
      const port = typeof options.port === 'string' ? parseInt(options.port, 10) : 3100;
      await startMCPServer({ config, port });
    });

  // Default action (show help with logo)
  program.action(() => {
    console.log(LOGO);
    program.help();
  });

  return program;
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const program = createProgram();

  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    const logger = createLogger();
    if (error instanceof Error) {
      logger.error(`Error: ${error.message}`);
    } else {
      logger.error('An unexpected error occurred');
    }
    process.exit(1);
  }
}

main();
