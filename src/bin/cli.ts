/**
 * @module bin/cli
 * @description KROLIK CLI entry point
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
${chalk.green('   (\\(\\ ')}
${chalk.green('   (-.-) ')}  ${chalk.bold.white('KROLIK CLI')} ${chalk.dim(`v${VERSION}`)}
${chalk.green('   o_(")(")')} ${chalk.dim('Fast AI-assisted development toolkit')}
`;

/** Command options type */
interface CommandOptions {
  [key: string]: unknown;
}

/** Helper to create command context */
async function createContext(program: Command, options: CommandOptions) {
  const globalOpts = program.opts();
  // Support --project-root and --cwd (alias) options
  const projectRoot = globalOpts.projectRoot || globalOpts.cwd || process.env.KROLIK_PROJECT_ROOT;
  const config = await loadConfig({ projectRoot });
  const logger = createLogger({ level: globalOpts.verbose ? 'debug' : 'info' });
  return { config, logger, options: { ...globalOpts, ...options } };
}

/**
 * Create main CLI program
 */
function createProgram(): Command {
  const program = new Command();

  program
    .name('krolik')
    .description('KROLIK — fast AI-assisted development toolkit')
    .version(VERSION, '-V, --version', 'Output version number')
    .option('-c, --config <path>', 'Path to config file')
    .option('--project-root <path>', 'Project root directory')
    .option('--cwd <path>', 'Project root directory (alias for --project-root)')
    .option('--json', 'Output as JSON')
    .option('-v, --verbose', 'Verbose output')
    .option('--no-color', 'Disable colored output');

  // Status command
  program
    .command('status')
    .description('Quick project diagnostics')
    .option('--fast', 'Skip slow checks (typecheck, lint)')
    .option('-j, --json', 'Output as JSON')
    .option('--markdown', 'Output as markdown')
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
    .option('-j, --json', 'Output as JSON')
    .option('--markdown', 'Output as markdown')
    .action(async (options: CommandOptions) => {
      const { runReview } = await import('../commands/review');
      const ctx = await createContext(program, options);
      await runReview(ctx);
    });

  // Schema command
  program
    .command('schema')
    .description('Analyze Prisma schema')
    .option('-j, --json', 'Output as JSON')
    .option('--markdown', 'Output as markdown')
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
    .option('-j, --json', 'Output as JSON')
    .option('--markdown', 'Output as markdown')
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
    .option('-j, --json', 'Output as JSON')
    .option('--markdown', 'Output as markdown')
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
    .option('-j, --json', 'Output as JSON')
    .option('--markdown', 'Output as markdown')
    .option('--ai', 'Output structured XML for AI assistants (Claude, GPT)')
    .option('--include-code', 'Include Zod schemas and example code snippets')
    .option('--domain-history', 'Include git history filtered by domain files')
    .option('--show-deps', 'Show domain dependencies from package.json')
    .option('--full', 'Enable all enrichment options (--include-code --domain-history --show-deps)')
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

  // Quality command
  program
    .command('quality')
    .alias('lint')
    .description('Analyze code quality: SRP, complexity, type-safety, documentation')
    .option('--path <path>', 'Path to analyze (default: project root)')
    .option('--include-tests', 'Include test files in analysis')
    .option('--max-function-lines <n>', 'Max lines per function (default: 50)', parseInt)
    .option('--max-functions <n>', 'Max functions per file (default: 10)', parseInt)
    .option('--max-exports <n>', 'Max exports per file (default: 5)', parseInt)
    .option('--max-lines <n>', 'Max lines per file (default: 400)', parseInt)
    .option('--max-complexity <n>', 'Max cyclomatic complexity per function (default: 10)', parseInt)
    .option('--no-jsdoc', 'Disable JSDoc requirement for exported functions')
    .option('--category <cat>', 'Filter by category: srp, hardcoded, complexity, mixed-concerns, size, documentation, type-safety, lint')
    .option('--severity <sev>', 'Filter by severity: error, warning, info')
    .option('--issues-only', 'Show only issues, no stats')
    .option('-j, --json', 'Output as JSON')
    .option('--ai', 'Output as AI-friendly XML')
    .action(async (options: CommandOptions) => {
      const { runQuality } = await import('../commands/quality');
      const ctx = await createContext(program, {
        ...options,
        format: options.json ? 'json' : options.ai ? 'ai' : 'text',
        maxFunctionLines: options.maxFunctionLines,
        maxFunctionsPerFile: options.maxFunctions,
        maxExportsPerFile: options.maxExports,
        maxFileLines: options.maxLines,
        maxComplexity: options.maxComplexity,
        requireJSDoc: options.jsdoc !== false,
        issuesOnly: options.issuesOnly,
      });
      await runQuality(ctx);
    });

  // Fix command (autofixer)
  program
    .command('fix')
    .description('Auto-fix code quality issues')
    .option('--path <path>', 'Path to fix (default: project root)')
    .option('--category <cat>', 'Only fix specific category: lint, type-safety, complexity')
    .option('--dry-run', 'Show what would be fixed without applying')
    .option('--trivial', 'Only fix trivial issues (console, debugger)')
    .option('--yes', 'Auto-confirm all fixes')
    .option('--backup', 'Create backup before fixing')
    .option('--limit <n>', 'Max fixes to apply', parseInt)
    .action(async (options: CommandOptions) => {
      const { runFix } = await import('../commands/fix');
      const ctx = await createContext(program, {
        ...options,
        dryRun: options.dryRun,
        trivialOnly: options.trivial,
      });
      await runFix(ctx);
    });

  // Init command
  program
    .command('init')
    .description('Initialize krolik.config.ts')
    .option('--force', 'Overwrite existing config')
    .action(async (options: CommandOptions) => {
      const { runInit } = await import('../commands/init');
      const ctx = await createContext(program, options);
      await runInit(ctx);
    });

  // MCP server command
  program
    .command('mcp')
    .description('Start MCP server for Claude Code integration (stdio transport)')
    .action(async () => {
      const { startMCPServer } = await import('../mcp/server');
      const config = await loadConfig();
      await startMCPServer(config);
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
