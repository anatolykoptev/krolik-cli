/**
 * @module bin/cli
 * @description KROLIK CLI entry point
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig } from '../config';
import { createLogger, syncClaudeMd, needsSync } from '../lib';
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

  // Auto-sync CLAUDE.md documentation (silent mode)
  // Skip for mcp and sync commands to avoid recursion
  const command = process.argv[2];
  if (command !== 'mcp' && command !== 'sync' && !globalOpts.noSync) {
    try {
      if (needsSync(config.projectRoot)) {
        const result = syncClaudeMd(config.projectRoot, { silent: true });
        if (globalOpts.verbose && result.action !== 'skipped') {
          logger.debug(`CLAUDE.md ${result.action}: ${result.path}`);
        }
      }
    } catch {
      // Silently ignore sync errors
    }
  }

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
    .option('--no-color', 'Disable colored output')
    .option('--no-sync', 'Disable auto-sync of CLAUDE.md documentation');

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

  // Audit command
  program
    .command('audit')
    .description('Code quality audit — generates AI-REPORT.md with issues, priorities, and action plan')
    .option('--path <path>', 'Path to analyze (default: project root)')
    .option('--show-fixes', 'Show fix previews (diffs) for quick wins')
    .action(async (options: CommandOptions) => {
      const { runAudit } = await import('../commands/audit');
      const ctx = await createContext(program, {
        ...options,
        showFixes: options.showFixes,
      });
      await runAudit(ctx);
    });

  // Review command
  program
    .command('review')
    .description('AI-assisted code review')
    .option('--pr <number>', 'Review specific PR')
    .option('--staged', 'Review staged changes only')
    .option('--base <branch>', 'Base branch to compare against (default: main)')
    .option('--with-agents', 'Run security, performance, and architecture agents')
    .option('--agents <list>', 'Specific agents to run (comma-separated)')
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
    .option('--with-audit', 'Include quality issues for related files')
    .option('--full', 'Enable all enrichment options (--include-code --domain-history --show-deps --with-audit)')
    .action(async (options: CommandOptions) => {
      const { runContext } = await import('../commands/context');
      // --full enables --with-audit
      if (options.full) {
        options.withAudit = true;
      }
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

  // Refactor command
  program
    .command('refactor')
    .description('Analyze and refactor module structure (duplicates, imports, @namespace organization)')
    .option('--path <path>', 'Path to analyze (default: auto-detect for monorepo)')
    .option('--lib-path <path>', 'Alias for --path (deprecated: use --path)')
    .option('--package <name>', 'Monorepo package to analyze (e.g., web, api)')
    .option('--all-packages', 'Analyze all packages in monorepo')
    .option('--duplicates-only', 'Only analyze duplicate functions')
    .option('--types-only', 'Only analyze duplicate types/interfaces')
    .option('--include-types', 'Include type/interface duplicate detection')
    .option('--structure-only', 'Only analyze module structure')
    .option('--dry-run', 'Show migration plan without applying')
    .option('--apply', 'Apply migrations (move files, update imports)')
    .option('--yes', 'Auto-confirm all changes')
    .option('--ai', 'AI-native enhanced output with dependency graphs and navigation hints')
    .option('--generate-config', 'Generate ai-config.ts for AI assistants')
    .option('--backup', 'Create git backup before applying (default: true)')
    .option('--no-backup', 'Skip git backup before applying')
    .action(async (options: CommandOptions) => {
      const { refactorCommand } = await import('../commands/refactor');
      const globalOpts = program.opts();
      const projectRoot = globalOpts.projectRoot || globalOpts.cwd || process.cwd();
      const refactorOpts: Record<string, unknown> = {
        format: globalOpts.json ? 'json' : globalOpts.text ? 'text' : 'xml',
      };
      // Support both --path and --lib-path (deprecated alias)
      if (options.path || options.libPath) {
        refactorOpts.path = options.path || options.libPath;
      }
      // Monorepo package options
      if (options.package) refactorOpts.package = options.package;
      if (options.allPackages) refactorOpts.allPackages = true;
      if (options.duplicatesOnly) refactorOpts.duplicatesOnly = true;
      if (options.typesOnly) refactorOpts.typesOnly = true;
      if (options.includeTypes) refactorOpts.includeTypes = true;
      if (options.structureOnly) refactorOpts.structureOnly = true;
      if (options.dryRun) refactorOpts.dryRun = true;
      if (options.apply) refactorOpts.apply = true;
      if (options.yes) refactorOpts.yes = true;
      if (globalOpts.verbose) refactorOpts.verbose = true;
      if (options.ai) refactorOpts.aiNative = true;
      if (options.generateConfig) refactorOpts.generateConfig = true;
      // backup defaults to true, only set if explicitly specified
      if (options.backup !== undefined) refactorOpts.backup = options.backup;
      await refactorCommand(projectRoot, refactorOpts);
    });

  // Quality command (deprecated - redirects to audit)
  program
    .command('quality')
    .alias('lint')
    .description('[DEPRECATED] Use "audit" instead. Analyze code quality.')
    .option('--path <path>', 'Path to analyze (default: project root)')
    .action(async (options: CommandOptions) => {
      console.log('\x1b[33m⚠️  "quality" command is deprecated. Use "krolik audit" instead.\x1b[0m\n');
      const { runAudit } = await import('../commands/audit');
      const ctx = await createContext(program, options);
      await runAudit(ctx);
    });

  // Fix command (autofixer)
  program
    .command('fix')
    .description('Auto-fix code quality issues')
    .option('--path <path>', 'Path to analyze/fix (default: project root)')
    .option('--category <cat>', 'Only fix specific category: lint, type-safety, complexity')
    .option('--dry-run', 'Show what would be fixed without applying')
    .option('--format <fmt>', 'Output format: ai (default), text')
    .option('--diff', 'Show unified diff output (use with --dry-run)')
    .option('--trivial', 'Only fix trivial issues (console, debugger)')
    .option('--safe', 'Fix trivial + safe issues (excludes risky refactoring)')
    .option('--all', 'Include risky fixers (requires explicit confirmation)')
    .option('--from-audit', 'Use cached audit data (from krolik audit)')
    .option('--quick-wins', 'Only fix quick wins from audit (use with --from-audit)')
    // Preset flags for common combinations
    .option('--quick', 'Quick mode: --trivial --biome --typecheck')
    .option('--deep', 'Deep mode: --safe --biome --typecheck')
    .option('--full', 'Full mode: --all --biome --typecheck --backup')
    .option('--list-fixers', 'List all available fixers and exit')
    .option('--yes', 'Auto-confirm all fixes')
    .option('--backup', 'Create backup before fixing')
    .option('--limit <n>', 'Max fixes to apply', parseInt)
    .option('--biome', 'Run Biome auto-fix (default if available)')
    .option('--biome-only', 'Only run Biome, skip custom fixes')
    .option('--no-biome', 'Skip Biome even if available')
    .option('--typecheck', 'Run TypeScript check (default)')
    .option('--typecheck-only', 'Only run TypeScript check')
    .option('--no-typecheck', 'Skip TypeScript check')
    // Fixer flags - enable specific fixers
    .option('--fix-console', 'Fix console.log statements')
    .option('--fix-debugger', 'Fix debugger statements')
    .option('--fix-alert', 'Fix alert() calls')
    .option('--fix-ts-ignore', 'Fix @ts-ignore comments')
    .option('--fix-any', 'Fix `any` type usage')
    .option('--fix-complexity', 'Fix high complexity functions')
    .option('--fix-long-functions', 'Fix long functions')
    .option('--fix-magic-numbers', 'Fix magic numbers')
    .option('--fix-urls', 'Fix hardcoded URLs')
    .option('--fix-srp', 'Fix SRP violations')
    // Disable specific fixers
    .option('--no-console', 'Skip console.log fixes')
    .option('--no-debugger', 'Skip debugger fixes')
    .option('--no-any', 'Skip any type fixes')
    .action(async (options: CommandOptions) => {
      // Handle --list-fixers
      if (options.listFixers) {
        const { listFixers } = await import('../commands/fix');
        await listFixers();
        return;
      }

      const { runFix } = await import('../commands/fix');

      // Handle preset flags
      const presetOptions: {
        trivialOnly?: boolean;
        safe?: boolean;
        all?: boolean;
        biome?: boolean;
        typecheck?: boolean;
        backup?: boolean;
      } = {};

      // --quick = --trivial --biome --typecheck
      if (options.quick) {
        presetOptions.trivialOnly = true;
        presetOptions.biome = true;
        presetOptions.typecheck = true;
      }
      // --deep = --safe --biome --typecheck
      if (options.deep) {
        presetOptions.safe = true;
        presetOptions.biome = true;
        presetOptions.typecheck = true;
      }
      // --full = --all --biome --typecheck --backup
      if (options.full) {
        presetOptions.all = true;
        presetOptions.biome = true;
        presetOptions.typecheck = true;
        presetOptions.backup = true;
      }

      const ctx = await createContext(program, {
        ...options,
        ...presetOptions,
        dryRun: options.dryRun,
        format: options.format,
        showDiff: options.diff,
        trivialOnly: presetOptions.trivialOnly ?? options.trivial,
        safe: presetOptions.safe ?? options.safe,
        all: presetOptions.all ?? options.all,
        // Audit integration
        fromAudit: options.fromAudit,
        quickWinsOnly: options.quickWins,
        // Tool options
        biome: presetOptions.biome ?? options.biome,
        biomeOnly: options.biomeOnly,
        noBiome: options.biome === false,
        typecheck: presetOptions.typecheck ?? options.typecheck,
        typecheckOnly: options.typecheckOnly,
        noTypecheck: options.typecheck === false,
        backup: presetOptions.backup ?? options.backup,
        // Fixer flags
        fixConsole: options.fixConsole ?? (options.console !== false ? undefined : false),
        fixDebugger: options.fixDebugger ?? (options.debugger !== false ? undefined : false),
        fixAlert: options.fixAlert,
        fixTsIgnore: options.fixTsIgnore,
        fixAny: options.fixAny ?? (options.any !== false ? undefined : false),
        fixComplexity: options.fixComplexity,
        fixLongFunctions: options.fixLongFunctions,
        fixMagicNumbers: options.fixMagicNumbers,
        fixUrls: options.fixUrls,
        fixSrp: options.fixSrp,
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

  // Sync command - manually sync CLAUDE.md documentation
  program
    .command('sync')
    .description('Sync krolik documentation to CLAUDE.md')
    .option('--force', 'Force update even if versions match')
    .option('--dry-run', 'Preview without changes')
    .option('--status', 'Show current sync status')
    .action(async (options: CommandOptions) => {
      const { runSync } = await import('../commands/sync');
      const globalOpts = program.opts();
      const projectRoot = globalOpts.projectRoot || globalOpts.cwd || process.cwd();
      const config = await loadConfig({ projectRoot });
      const logger = createLogger({ level: globalOpts.verbose ? 'debug' : 'info' });
      await runSync({ config, logger, options });
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

  // Setup command - install recommended plugins
  program
    .command('setup')
    .description('Install plugins, agents, and MCP servers for krolik')
    .option('--all', 'Install everything (plugins + agents + MCP servers)')
    .option('--plugins', 'Install only Claude Code MCP plugins')
    .option('--agents', 'Install only AI agents (wshobson/agents)')
    .option('--mem', 'Install claude-mem (persistent memory)')
    .option('--mcp [server]', 'Install MCP server(s) — specify name or omit for all recommended')
    .option('--check', 'Check installed components and show recommendations')
    .option('--update', 'Update all installed components')
    .option('--list', 'List available plugins and agents')
    .option('--dry-run', 'Preview without installing')
    .option('--force', 'Reinstall even if already installed')
    .action(async (options: CommandOptions) => {
      if (options.list) {
        const { listPlugins } = await import('../commands/setup');
        listPlugins();
        return;
      }
      if (options.check) {
        const { printDiagnostics } = await import('../commands/setup');
        printDiagnostics();
        return;
      }
      const { runSetup } = await import('../commands/setup');
      const ctx = await createContext(program, options);
      await runSetup(ctx);
    });

  // Agent command
  program
    .command('agent [name]')
    .description('Run specialized AI agents with project context (from wshobson/agents)')
    .option('--list', 'List all available agents')
    .option('--install', 'Install agents from wshobson/agents to ~/.krolik/agents')
    .option('--update', 'Update installed agents to latest version')
    .option('--category <cat>', 'Filter by category: security, perf, arch, quality, debug, docs')
    .option('--file <path>', 'Target file for analysis')
    .option('--feature <name>', 'Feature/domain to focus on')
    .option('--no-schema', 'Skip including Prisma schema')
    .option('--no-routes', 'Skip including tRPC routes')
    .option('--no-git', 'Skip including git info')
    .option('--dry-run', 'Show agent prompt without executing')
    .action(async (name: string | undefined, options: CommandOptions) => {
      const { runAgent } = await import('../commands/agent');
      const ctx = await createContext(program, {
        ...options,
        agentName: name,
        install: options.install,
        update: options.update,
        includeSchema: options.schema !== false,
        includeRoutes: options.routes !== false,
        includeGit: options.git !== false,
      });
      await runAgent(ctx);
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
