/**
 * @module cli/commands/felix
 * @description Krolik Felix CLI command registration
 */

import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import type { Command } from 'commander';
import { addProjectOption } from '../builders';
import type { CommandOptions } from '../types';
import { createContext, handleProjectOption } from './helpers';

/**
 * Felix base directory
 */
const FELIX_DIR = '.krolik/felix';

/**
 * Default PRD directory within project
 */
const PRD_DEFAULT_DIR = `${FELIX_DIR}/prd`;

/**
 * Felix logs directory
 */
const FELIX_LOGS_DIR = `${FELIX_DIR}/logs`;

/**
 * Extract project root from PRD path
 * PRD paths are typically: /path/to/project/.krolik/felix/prd/issue-123.json
 * Returns the project root: /path/to/project
 */
function extractProjectRootFromPrd(prdPath: string): string {
  // Check if path contains .krolik/felix/prd
  const krolikPrdPattern = /(.+)\/\.krolik\/ralph\/prd\/.+\.json$/;
  const match = prdPath.match(krolikPrdPattern);
  if (match?.[1]) {
    return match[1];
  }

  // Fallback: use directory containing the PRD file
  return dirname(prdPath);
}

/**
 * Find the latest log file in the logs directory
 */
function findLatestLogFile(projectRoot: string): string | null {
  const logsDir = join(projectRoot, FELIX_LOGS_DIR);
  if (!existsSync(logsDir)) return null;

  const files = readdirSync(logsDir)
    .filter((f) => f.endsWith('.log'))
    .map((f) => ({
      name: f,
      path: join(logsDir, f),
      mtime: statSync(join(logsDir, f)).mtime.getTime(),
    }))
    .sort((a, b) => b.mtime - a.mtime);

  return files.length > 0 ? files[0]!.path : null;
}

/**
 * Tail a log file in real-time using spawn
 */
function tailLogFile(logFile: string): void {
  console.log(`\n📋 Watching: ${logFile}\n${'─'.repeat(60)}\n`);

  const tail = spawn('tail', ['-f', '-n', '+1', logFile], {
    stdio: ['ignore', 'inherit', 'inherit'],
  });

  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    tail.kill();
    console.log('\n\n✋ Stopped watching.');
    process.exit(0);
  });

  tail.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`\n❌ tail exited with code ${code}`);
    }
  });
}

/**
 * Spawn Felix in background and return immediately
 */
function spawnFelixBackground(
  prdPath: string,
  projectRoot: string,
  options: {
    model: string | undefined;
    backend: string | undefined;
    maxAttempts: string | undefined;
    continueOnFailure: boolean;
    verbose: boolean;
  },
): { sessionId: string; logFile: string } {
  const sessionId = `felix-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const logsDir = join(projectRoot, FELIX_LOGS_DIR);
  const logFile = join(logsDir, `${sessionId}.log`);

  // Ensure logs directory exists
  mkdirSync(logsDir, { recursive: true });

  // Build args for internal _run command
  const args = ['felix', '_run', '--prd', prdPath, '--session-id', sessionId];
  if (options.model) args.push('--model', options.model);
  if (options.backend) args.push('--backend', options.backend);
  if (options.maxAttempts) args.push('--max-attempts', options.maxAttempts);
  if (options.continueOnFailure) args.push('--continue-on-failure');
  if (options.verbose) args.push('--verbose');

  // Log start
  const startMsg = `[${new Date().toISOString()}] Starting Felix session ${sessionId}\nPRD: ${prdPath}\n\n`;
  appendFileSync(logFile, startMsg);

  // Spawn detached process - 'felix _run' is a subcommand of krolik
  // Use the CLI script path to find krolik-cli directory
  // process.argv[1] is the path to the CLI script (e.g., /path/to/krolik-cli/dist/bin/cli.js)
  const cliScriptPath = process.argv[1] ?? '';
  const krolikCliDir = cliScriptPath.includes('/dist/bin/')
    ? join(cliScriptPath, '..', '..', '..')
    : process.cwd();
  const child = spawn('pnpm', ['krolik', ...args], {
    cwd: krolikCliDir,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Pipe output to log file
  child.stdout?.on('data', (data) => {
    appendFileSync(logFile, data);
  });
  child.stderr?.on('data', (data) => {
    appendFileSync(logFile, data);
  });

  child.on('exit', (code) => {
    const endMsg = `\n[${new Date().toISOString()}] Session ${sessionId} exited with code ${code}\n`;
    appendFileSync(logFile, endMsg);
  });

  // Detach child process
  child.unref();

  return { sessionId, logFile };
}

/**
 * Validate that PRD file path is provided and exists
 */
function validatePrdPath(
  prdPath: string | undefined,
  projectRoot: string,
): { valid: true; path: string } | { valid: false; error: string } {
  if (!prdPath) {
    return {
      valid: false,
      error: `PRD file path is required. Use --prd <path> to specify the path.

Default location: ${PRD_DEFAULT_DIR}/

Examples:
  krolik felix start --prd .krolik/prd/feature.prd.json
  krolik felix start --prd ./my-task.prd.json`,
    };
  }

  const fullPath = isAbsolute(prdPath) ? prdPath : join(projectRoot, prdPath);

  if (!existsSync(fullPath)) {
    return {
      valid: false,
      error: `PRD file not found: ${fullPath}

Check that the file exists. PRD files are typically stored in ${PRD_DEFAULT_DIR}/`,
    };
  }

  return { valid: true, path: fullPath };
}

/**
 * Register felix command with subcommands
 */
export function registerFelixCommand(program: Command): void {
  const felix = program
    .command('felix')
    .description('Krolik Felix - Autonomous agent loop for executing PRD tasks');

  // felix status
  const statusCmd = felix.command('status').description('Get current Felix session status');
  addProjectOption(statusCmd);
  statusCmd
    .option('--prd <path>', 'Path to PRD.json file')
    .action(async (options: CommandOptions) => {
      const { getFelixStatus, formatStatusXML } = await import('../../commands/felix');
      handleProjectOption(options);
      const ctx = await createContext(program, options);
      const status = getFelixStatus(ctx.config.projectRoot, options.prd as string | undefined);
      console.log(formatStatusXML(status));

      // Close all database connections and exit immediately
      const { closeAllDatabases } = await import('../../lib/@storage/database');
      closeAllDatabases();
      process.exit(0);
    });

  // felix watch - watch logs in real-time
  const watchCmd = felix.command('watch').description('Watch Felix session logs in real-time');
  addProjectOption(watchCmd);
  watchCmd
    .option('--session <id>', 'Watch specific session by ID')
    .action(async (options: CommandOptions) => {
      const projectRoot = process.cwd();

      let logFile: string | null = null;

      if (options.session) {
        // Watch specific session
        const sessionLog = join(projectRoot, FELIX_LOGS_DIR, `${options.session}.log`);
        if (existsSync(sessionLog)) {
          logFile = sessionLog;
        } else {
          console.error(`<felix-error>Session log not found: ${sessionLog}</felix-error>`);
          process.exitCode = 1;
          return;
        }
      } else {
        // Watch latest session
        logFile = findLatestLogFile(projectRoot);
        if (!logFile) {
          console.error(`<felix-error>No session logs found in ${FELIX_LOGS_DIR}/

Start a session first:
  krolik felix start --prd .krolik/felix/prd/your-task.prd.json</felix-error>`);
          process.exitCode = 1;
          return;
        }
      }

      tailLogFile(logFile);
    });

  // felix validate
  const validateCmd = felix.command('validate').description('Validate PRD.json file');
  addProjectOption(validateCmd);
  validateCmd
    .requiredOption('--prd <path>', 'Path to PRD.json file (required)')
    .action(async (options: CommandOptions) => {
      // Validate PRD path FIRST - before any heavy imports
      const prdValidation = validatePrdPath(options.prd as string | undefined, process.cwd());
      if (!prdValidation.valid) {
        console.error(`<felix-error>${prdValidation.error}</felix-error>`);
        process.exitCode = 1;
        return;
      }

      // Import lightweight validation module (no heavy dependencies like orchestrator)
      const { validatePrdFile, formatValidationXML } = await import(
        '../../commands/felix/validate'
      );
      handleProjectOption(options);

      // Get project root from options or use cwd (no config loading needed)
      const globalOpts = program.opts();
      const projectRoot = globalOpts.projectRoot || globalOpts.cwd || process.cwd();

      const result = validatePrdFile(projectRoot, prdValidation.path);
      console.log(formatValidationXML(result));

      // Close all database connections and exit immediately
      const { closeAllDatabases } = await import('../../lib/@storage/database');
      closeAllDatabases();
      process.exit(0);
    });

  // felix start - runs in background by default
  const startCmd = felix
    .command('start')
    .description('Start a new Felix session (runs in background)');
  addProjectOption(startCmd);
  startCmd
    .requiredOption('--prd <path>', 'Path to PRD.json file (required)')
    .option('--dry-run', 'Validate without starting session')
    .option(
      '--model <model>',
      'AI model: claude (opus|sonnet|haiku) or gemini (flash|pro)',
      'sonnet',
    )
    .option(
      '--backend <type>',
      'Backend: cli (Claude Code/Gemini CLI) or api (requires API keys)',
      'cli',
    )
    .option('--max-attempts <number>', 'Maximum retry attempts per task', '3')
    .option('--continue-on-failure', 'Continue to next task on failure')
    .option('--verbose', 'Enable verbose debug output')
    .option('--wait', 'Wait for session to complete (blocking mode)')
    .option('--follow', 'Start and watch logs in real-time (like tail -f)')
    .action(async (options: CommandOptions) => {
      // Validate PRD path FIRST - before any heavy imports
      const prdValidation = validatePrdPath(options.prd as string | undefined, process.cwd());
      if (!prdValidation.valid) {
        console.error(`<felix-error>${prdValidation.error}</felix-error>`);
        process.exitCode = 1;
        return;
      }

      // Dry run - just validate
      if (options.dryRun) {
        const { validatePrdFile, formatValidationXML } = await import('../../commands/felix');
        const result = validatePrdFile(process.cwd(), prdValidation.path);
        console.log(formatValidationXML(result));
        return;
      }

      // Blocking mode with --wait
      if (options.wait) {
        const { startSession } = await import('../../commands/felix');
        handleProjectOption(options);
        const ctx = await createContext(program, options);

        const sessionOptions: {
          verbose?: boolean;
          maxAttempts?: number;
          continueOnFailure?: boolean;
          model?: 'opus' | 'sonnet' | 'haiku' | 'flash' | 'pro';
          backend?: 'cli' | 'api';
          wait: true;
        } = { wait: true };
        if (options.verbose) sessionOptions.verbose = true;
        if (options.continueOnFailure) sessionOptions.continueOnFailure = true;
        if (options.model) {
          sessionOptions.model = options.model as 'opus' | 'sonnet' | 'haiku' | 'flash' | 'pro';
        }
        if (options.backend) {
          sessionOptions.backend = options.backend as 'cli' | 'api';
        }
        if (options.maxAttempts) {
          sessionOptions.maxAttempts = parseInt(options.maxAttempts as string, 10);
        }

        const result = await startSession(
          ctx.config.projectRoot,
          prdValidation.path,
          sessionOptions,
        );
        if (result.success) {
          console.log(`<felix-session action="completed" id="${result.sessionId}"/>`);
        } else {
          console.log(`<felix-error>${result.error}</felix-error>`);
          process.exitCode = 1;
        }
        return;
      }

      // Default: background mode - spawn and return immediately
      // Extract project root from PRD path to save logs in the correct location
      const targetProjectRoot = extractProjectRootFromPrd(prdValidation.path);
      const { sessionId, logFile } = spawnFelixBackground(prdValidation.path, targetProjectRoot, {
        model: options.model as string | undefined,
        backend: options.backend as string | undefined,
        maxAttempts: options.maxAttempts as string | undefined,
        continueOnFailure: !!options.continueOnFailure,
        verbose: !!options.verbose,
      });

      // Follow mode - start tailing the log immediately
      if (options.follow) {
        console.log(`🚀 Started session ${sessionId}`);
        // Small delay to let the background process start writing
        await new Promise((resolve) => setTimeout(resolve, 500));
        tailLogFile(logFile);
        return;
      }

      console.log(`<felix-session action="started" id="${sessionId}" log="${logFile}">
  Session started in background.
  Check status: krolik felix status
  View logs: krolik felix watch
</felix-session>`);
    });

  // felix _run - internal command for background execution (hidden from help)
  // Note: Execution mode (single/multi-agent) is now decided by Router automatically
  const runCmd = felix.command('_run', { hidden: true }).description('Internal: run Felix session');
  addProjectOption(runCmd);
  runCmd
    .requiredOption('--prd <path>', 'Path to PRD.json file')
    .requiredOption('--session-id <id>', 'Session ID')
    .option('--model <model>', 'AI model', 'sonnet')
    .option('--backend <type>', 'Backend type', 'cli')
    .option('--max-attempts <number>', 'Maximum retry attempts', '3')
    .option('--continue-on-failure', 'Continue on failure')
    .option('--verbose', 'Verbose output')
    .action(async (options: CommandOptions) => {
      const { startSession } = await import('../../commands/felix');
      handleProjectOption(options);
      const ctx = await createContext(program, options);

      const sessionOptions: {
        verbose?: boolean;
        maxAttempts?: number;
        continueOnFailure?: boolean;
        model?: 'opus' | 'sonnet' | 'haiku' | 'flash' | 'pro';
        backend?: 'cli' | 'api';
        wait: true;
      } = { wait: true };
      if (options.verbose) sessionOptions.verbose = true;
      if (options.continueOnFailure) sessionOptions.continueOnFailure = true;
      if (options.model) {
        sessionOptions.model = options.model as 'opus' | 'sonnet' | 'haiku' | 'flash' | 'pro';
      }
      if (options.backend) {
        sessionOptions.backend = options.backend as 'cli' | 'api';
      }
      if (options.maxAttempts) {
        sessionOptions.maxAttempts = parseInt(options.maxAttempts as string, 10);
      }

      const result = await startSession(
        ctx.config.projectRoot,
        options.prd as string,
        sessionOptions,
      );
      if (result.success) {
        console.log(`Session ${options.sessionId} completed successfully`);
      } else {
        console.error(`Session ${options.sessionId} failed: ${result.error}`);
        process.exitCode = 1;
      }
    });

  // felix pause
  const pauseCmd = felix.command('pause').description('Pause the active session');
  addProjectOption(pauseCmd);
  pauseCmd.action(async (options: CommandOptions) => {
    const { pauseActiveSession } = await import('../../commands/felix');
    handleProjectOption(options);
    const ctx = await createContext(program, options);
    const result = pauseActiveSession(ctx.config.projectRoot);
    if (result.success) {
      console.log('<felix-session action="paused"/>');
    } else {
      console.log(`<felix-error>${result.error}</felix-error>`);
      process.exitCode = 1;
    }

    // Close all database connections and exit immediately
    const { closeAllDatabases } = await import('../../lib/@storage/database');
    closeAllDatabases();
    process.exit(result.success ? 0 : 1);
  });

  // felix resume
  const resumeCmd = felix.command('resume').description('Resume a paused session');
  addProjectOption(resumeCmd);
  resumeCmd.action(async (options: CommandOptions) => {
    const { resumeActiveSession } = await import('../../commands/felix');
    handleProjectOption(options);
    const ctx = await createContext(program, options);
    const result = resumeActiveSession(ctx.config.projectRoot);
    if (result.success) {
      console.log(`<felix-session action="resumed" id="${result.sessionId}"/>`);
    } else {
      console.log(`<felix-error>${result.error}</felix-error>`);
      process.exitCode = 1;
    }

    // Close all database connections and exit immediately
    const { closeAllDatabases } = await import('../../lib/@storage/database');
    closeAllDatabases();
    process.exit(result.success ? 0 : 1);
  });

  // felix cancel
  const cancelCmd = felix.command('cancel').description('Cancel the active session');
  addProjectOption(cancelCmd);
  cancelCmd.action(async (options: CommandOptions) => {
    const { cancelActiveSession } = await import('../../commands/felix');
    handleProjectOption(options);
    const ctx = await createContext(program, options);
    const result = cancelActiveSession(ctx.config.projectRoot);
    if (result.success) {
      console.log('<felix-session action="cancelled"/>');
    } else {
      console.log(`<felix-error>${result.error}</felix-error>`);
      process.exitCode = 1;
    }

    // Close all database connections and exit immediately
    const { closeAllDatabases } = await import('../../lib/@storage/database');
    closeAllDatabases();
    process.exit(result.success ? 0 : 1);
  });

  // felix plan - show model routing plan
  const planCmd = felix.command('plan').description('Show model selection for each task');
  addProjectOption(planCmd);
  planCmd
    .option('--prd <path>', 'Path to PRD.json file')
    .action(async (options: CommandOptions) => {
      const { getRoutingPlan } = await import('../../commands/felix');
      handleProjectOption(options);
      const ctx = await createContext(program, options);
      const result = getRoutingPlan(ctx.config.projectRoot, options.prd as string | undefined);
      if (result.success) {
        console.log(result.xml);
        if (result.summary) {
          console.log(
            `\nSummary: ${result.summary.totalTasks} tasks, ` +
              `${result.summary.escalatable} can escalate`,
          );
        }
      } else {
        console.log(`<felix-error>${result.error}</felix-error>`);
        process.exitCode = 1;
      }

      // Close all database connections and exit immediately
      const { closeAllDatabases } = await import('../../lib/@storage/database');
      closeAllDatabases();
      process.exit(result.success ? 0 : 1);
    });

  // felix estimate - estimate cost before execution
  const estimateCmd = felix.command('estimate').description('Estimate cost before execution');
  addProjectOption(estimateCmd);
  estimateCmd
    .option('--prd <path>', 'Path to PRD.json file')
    .action(async (options: CommandOptions) => {
      const { getCostEstimate } = await import('../../commands/felix');
      handleProjectOption(options);
      const ctx = await createContext(program, options);
      const result = getCostEstimate(ctx.config.projectRoot, options.prd as string | undefined);
      if (result.success) {
        console.log(result.xml);
        if (result.estimate) {
          console.log(`\nCost Summary:`);
          console.log(`  Optimistic:  $${result.estimate.optimistic.toFixed(4)}`);
          console.log(`  Expected:    $${result.estimate.expected.toFixed(4)}`);
          console.log(`  Pessimistic: $${result.estimate.pessimistic.toFixed(4)}`);
        }
      } else {
        console.log(`<felix-error>${result.error}</felix-error>`);
        process.exitCode = 1;
      }

      // Close all database connections and exit immediately
      const { closeAllDatabases } = await import('../../lib/@storage/database');
      closeAllDatabases();
      process.exit(result.success ? 0 : 1);
    });

  // felix stats - view routing statistics
  const statsCmd = felix.command('stats').description('View model routing statistics');
  addProjectOption(statsCmd);
  statsCmd.action(async (options: CommandOptions) => {
    const { getRouterStats } = await import('../../commands/felix');
    handleProjectOption(options);
    const ctx = await createContext(program, options);
    const result = getRouterStats(ctx.config.projectRoot);
    console.log(result.xml);

    // Close all database connections and exit immediately
    const { closeAllDatabases } = await import('../../lib/@storage/database');
    closeAllDatabases();
    process.exit(0);
  });
}
