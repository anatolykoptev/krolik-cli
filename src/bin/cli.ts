/**
 * @module bin/cli
 * @description KROLIK CLI entry point
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig } from '../config';
import { createLogger } from '../lib/logger';
import type { OutputFormat } from '../types';

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

/**
 * Determine output format from options
 * Priority: --json > --text > default (ai)
 */
function getOutputFormat(globalOpts: CommandOptions, cmdOpts: CommandOptions): OutputFormat {
  if (globalOpts.json || cmdOpts.json) return 'json';
  if (globalOpts.text || cmdOpts.text) return 'text';
  return 'ai'; // Default: AI-friendly XML
}

/** Helper to create command context */
async function createContext(program: Command, options: CommandOptions) {
  const globalOpts = program.opts();
  // Support --project-root and --cwd (alias) options
  const projectRoot = globalOpts.projectRoot || globalOpts.cwd || process.env.KROLIK_PROJECT_ROOT;
  const config = await loadConfig({ projectRoot });
  const logger = createLogger({ level: globalOpts.verbose ? 'debug' : 'info' });
  const format = getOutputFormat(globalOpts, options);
  return { config, logger, options: { ...globalOpts, ...options, format } };
}

/**
 * Create main CLI program
 */
function createProgram(): Command {
  const program = new Command();

  program
    .name('krolik')
    .description('KROLIK — fast AI-assisted development toolkit (AI-friendly output by default)')
    .version(VERSION, '-V, --version', 'Output version number')
    .option('-c, --config <path>', 'Path to config file')
    .option('--project-root <path>', 'Project root directory')
    .option('--cwd <path>', 'Project root directory (alias for --project-root)')
    .option('-t, --text', 'Human-readable text output (default: AI-friendly XML)')
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

  // Refine command
  program
    .command('refine')
    .description('Analyze and reorganize lib/ structure to @namespace pattern')
    .option('--lib-path <path>', 'Custom lib directory path')
    .option('--apply', 'Apply migration (move directories, update imports)')
    .option('--dry-run', 'Preview changes without applying')
    .option('--generate-config', 'Generate ai-config.ts for AI assistants')
    .action(async (options: CommandOptions) => {
      const { runRefine } = await import('../commands/refine');
      const ctx = await createContext(program, {
        ...options,
        libPath: options.libPath,
        generateConfig: options.generateConfig,
        dryRun: options.dryRun,
      });
      await runRefine(ctx);
    });

  // Quality command (deprecated - redirects to fix --analyze-only)
  program
    .command('quality')
    .alias('lint')
    .description('[DEPRECATED] Use "fix --analyze-only" instead. Analyze code quality.')
    .option('--path <path>', 'Path to analyze (default: project root)')
    .option('--include-tests', 'Include test files in analysis')
    .option('--category <cat>', 'Filter by category: srp, hardcoded, complexity, mixed-concerns, size, documentation, type-safety, lint')
    .option('--severity <sev>', 'Filter by severity: error, warning, info')
    .option('--format <fmt>', 'Output format: ai (default), text', 'ai')
    .action(async (options: CommandOptions) => {
      console.log('\x1b[33m⚠️  "quality" command is deprecated. Use "fix --analyze-only" instead.\x1b[0m\n');
      const { runFix } = await import('../commands/fix');
      const ctx = await createContext(program, {
        ...options,
        analyzeOnly: true,
        format: options.format || 'ai',
        noTypecheck: true,
        noBiome: true,
      });
      await runFix(ctx);
    });

  // Fix command (autofixer + quality analysis)
  program
    .command('fix')
    .description('Auto-fix code quality issues (also replaces quality command with --analyze-only)')
    .option('--path <path>', 'Path to analyze/fix (default: project root)')
    .option('--category <cat>', 'Only fix specific category: lint, type-safety, complexity')
    .option('--dry-run', 'Show what would be fixed without applying')
    .option('--analyze-only', 'Analyze only, no fix plan (replaces quality command)')
    .option('--recommendations', 'Include Airbnb-style recommendations (default: true for --analyze-only)')
    .option('--format <fmt>', 'Output format: ai (default), text')
    .option('--diff', 'Show unified diff output (use with --dry-run)')
    .option('--trivial', 'Only fix trivial issues (console, debugger)')
    .option('--yes', 'Auto-confirm all fixes')
    .option('--backup', 'Create backup before fixing')
    .option('--limit <n>', 'Max fixes to apply', parseInt)
    .option('--biome', 'Run Biome auto-fix (default if available)')
    .option('--biome-only', 'Only run Biome, skip custom fixes')
    .option('--no-biome', 'Skip Biome even if available')
    .option('--typecheck', 'Run TypeScript check (default)')
    .option('--typecheck-only', 'Only run TypeScript check')
    .option('--no-typecheck', 'Skip TypeScript check')
    .action(async (options: CommandOptions) => {
      const { runFix } = await import('../commands/fix');
      const ctx = await createContext(program, {
        ...options,
        dryRun: options.dryRun,
        analyzeOnly: options.analyzeOnly,
        recommendations: options.recommendations,
        format: options.format,
        showDiff: options.diff,
        trivialOnly: options.trivial,
        biome: options.biome,
        biomeOnly: options.biomeOnly,
        noBiome: options.biome === false,
        typecheck: options.typecheck,
        typecheckOnly: options.typecheckOnly,
        noTypecheck: options.typecheck === false,
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
