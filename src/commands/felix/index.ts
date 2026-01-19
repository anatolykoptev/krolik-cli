/**
 * @module commands/felix
 * @description Krolik Felix - Autonomous agent loop for executing PRD tasks
 */

import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
// ADK-based FelixOrchestrator
import { FelixOrchestrator } from '../../lib/@felix/orchestrator';
// Model Router
import {
  estimateTotalCost,
  formatCostEstimateXml,
  formatRoutingDecisionsXml,
  getRoutingPlanSummary,
  getRoutingStats,
  routeTasks,
  type TaskAttributes,
} from '../../lib/@felix/router';
import {
  getTaskExecutionOrder,
  type PRD,
  type PRDTask,
  validatePRD,
} from '../../lib/@felix/schemas/prd.schema';
import { cancelSession, getActiveSession, getSessionStats } from '../../lib/@storage/felix';
import { getAttemptStats } from '../../lib/@storage/felix/attempts';
import { getGuardrailStats } from '../../lib/@storage/felix/guardrails';
import type { OutputFormat } from '../../types/commands/base';

// ============================================================================
// ORCHESTRATOR REGISTRY
// ============================================================================

/**
 * Active orchestrators by project
 * Stored globally so pause/resume/cancel work across MCP calls
 */
const activeOrchestrators = new Map<string, FelixOrchestrator>();

/**
 * Get orchestrator for project
 */
export function getOrchestrator(project: string): FelixOrchestrator | undefined {
  return activeOrchestrators.get(project);
}

/**
 * Store orchestrator for project
 */
function setOrchestrator(project: string, orchestrator: FelixOrchestrator): void {
  activeOrchestrators.set(project, orchestrator);
}

/**
 * Remove orchestrator for project
 */
function removeOrchestrator(project: string): void {
  activeOrchestrators.delete(project);
}

// ============================================================================
// TYPES
// ============================================================================

export interface RalphOptions {
  prd?: string;
  action?: 'status' | 'start' | 'resume' | 'pause' | 'cancel' | 'validate';
  dryRun?: boolean;
  verbose?: boolean;
  format?: OutputFormat;
}

export interface FelixStatus {
  hasActiveSession: boolean;
  session?: {
    id: string;
    status: string;
    progress: {
      completed: number;
      failed: number;
      skipped: number;
      total: number;
      percentage: number;
    };
    cost: {
      tokens: number;
      usd: number;
    };
    currentTask?: string;
    startedAt: string;
  };
  prd?: {
    path: string;
    valid: boolean;
    taskCount: number;
    errors?: string[];
  };
  stats: {
    totalSessions: number;
    totalAttempts: number;
    totalGuardrails: number;
    successRate: number;
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function findPrdPath(projectRoot: string, customPath?: string): string | undefined {
  if (customPath) {
    const fullPath = customPath.startsWith('/') ? customPath : join(projectRoot, customPath);
    return existsSync(fullPath) ? fullPath : undefined;
  }

  // Search for PRD.json in common locations
  const candidates = ['PRD.json', 'prd.json', '.ralph/PRD.json', 'docs/PRD.json'];

  for (const candidate of candidates) {
    const fullPath = join(projectRoot, candidate);
    if (existsSync(fullPath)) {
      return fullPath;
    }
  }

  return undefined;
}

function loadAndValidatePRD(
  prdPath: string,
): { prd: PRD; errors: string[] } | { prd: null; errors: string[] } {
  try {
    const content = readFileSync(prdPath, 'utf-8');
    const data = JSON.parse(content) as unknown;
    const result = validatePRD(data);

    if (result.success) {
      return { prd: result.data, errors: [] };
    }

    return {
      prd: null,
      errors: result.errors,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { prd: null, errors: [`Failed to load PRD: ${message}`] };
  }
}

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * Get current Felix status
 */
export function getFelixStatus(projectRoot: string, prdPath?: string): FelixStatus {
  const project = projectRoot.split('/').pop() ?? 'unknown';

  // Check for active session (from project-level DB)
  const activeSession = getActiveSession(project, projectRoot);

  // Find and validate PRD
  const foundPrdPath = findPrdPath(projectRoot, prdPath);
  let prdInfo: FelixStatus['prd'];

  if (foundPrdPath) {
    const { prd, errors } = loadAndValidatePRD(foundPrdPath);
    prdInfo = {
      path: foundPrdPath,
      valid: prd !== null,
      taskCount: prd?.tasks.length ?? 0,
      ...(errors.length > 0 ? { errors } : {}),
    };
  }

  // Get statistics (from project-level DB)
  const sessionStats = getSessionStats(project, projectRoot);
  const attemptStats = getAttemptStats(project, projectRoot);
  const guardrailStats = getGuardrailStats(project, projectRoot);

  const successRate =
    attemptStats.totalAttempts > 0
      ? (attemptStats.successfulAttempts / attemptStats.totalAttempts) * 100
      : 0;

  const status: FelixStatus = {
    hasActiveSession: !!activeSession,
    stats: {
      totalSessions: sessionStats.totalSessions,
      totalAttempts: attemptStats.totalAttempts,
      totalGuardrails: guardrailStats.total,
      successRate: Math.round(successRate * 10) / 10,
    },
  };

  if (activeSession) {
    const total = activeSession.totalTasks;
    const completed = activeSession.completedTasks;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    status.session = {
      id: activeSession.id,
      status: activeSession.status,
      progress: {
        completed: activeSession.completedTasks,
        failed: activeSession.failedTasks,
        skipped: activeSession.skippedTasks,
        total: activeSession.totalTasks,
        percentage,
      },
      cost: {
        tokens: activeSession.totalTokens,
        usd: activeSession.totalCostUsd,
      },
      ...(activeSession.currentTaskId ? { currentTask: activeSession.currentTaskId } : {}),
      startedAt: activeSession.startedAt,
    };
  }

  if (prdInfo) {
    status.prd = prdInfo;
  }

  return status;
}

/**
 * Validate PRD file
 */
export function validatePrdFile(
  projectRoot: string,
  prdPath?: string,
): {
  valid: boolean;
  path?: string;
  taskCount?: number;
  executionOrder?: string[];
  errors: string[];
} {
  const foundPath = findPrdPath(projectRoot, prdPath);

  if (!foundPath) {
    return {
      valid: false,
      errors: ['PRD file not found. Create PRD.json in project root or specify --prd path.'],
    };
  }

  const { prd, errors } = loadAndValidatePRD(foundPath);

  if (!prd) {
    return { valid: false, path: foundPath, errors };
  }

  const orderedTasks = getTaskExecutionOrder(prd.tasks);
  const executionOrder = orderedTasks.map((t) => t.id);

  return {
    valid: true,
    path: foundPath,
    taskCount: prd.tasks.length,
    executionOrder,
    errors: [],
  };
}

/**
 * Options for starting a Felix session
 */
export interface StartSessionOptions {
  dryRun?: boolean;
  verbose?: boolean;
  maxAttempts?: number;
  continueOnFailure?: boolean;
  /** Model: claude (opus|sonnet|haiku) or gemini (flash|pro) */
  model?: 'opus' | 'sonnet' | 'haiku' | 'flash' | 'pro';
  /** Backend: cli (Claude Code/Gemini CLI) or api (requires API keys) */
  backend?: 'cli' | 'api';
  /** Wait for completion (blocking mode for CLI) */
  wait?: boolean;
  /**
   * @deprecated Router now decides execution mode automatically.
   * This option is ignored - Router analyzes PRD complexity and chooses mode.
   */
  useMultiAgentMode?: boolean;
}

/**
 * Start a new Felix session
 *
 * Creates orchestrator and starts it in background.
 * Returns immediately with session ID - poll status to check progress.
 * Use options.wait=true for blocking mode (CLI).
 */
export async function startSession(
  projectRoot: string,
  prdPath?: string,
  options?: StartSessionOptions,
): Promise<{ success: boolean; sessionId?: string; error?: string }> {
  const project = projectRoot.split('/').pop() ?? 'unknown';

  // Check for existing active session (from project-level DB)
  const existing = getActiveSession(project, projectRoot);
  if (existing) {
    return {
      success: false,
      error: `Active session already exists (${existing.id}). Use 'resume' or 'cancel' first.`,
    };
  }

  // Check for existing orchestrator
  const existingOrchestrator = getOrchestrator(project);
  if (existingOrchestrator) {
    const state = existingOrchestrator.getState();
    if (state.status === 'running' || state.status === 'paused') {
      return {
        success: false,
        error: `Orchestrator already running for this project. Use 'resume' or 'cancel' first.`,
      };
    }
    // Clean up stale orchestrator
    removeOrchestrator(project);
  }

  // Validate PRD
  const validation = validatePrdFile(projectRoot, prdPath);
  if (!validation.valid || !validation.path) {
    return {
      success: false,
      error: validation.errors.join('\n'),
    };
  }

  // Dry run - just validate without starting
  if (options?.dryRun) {
    return {
      success: true,
      sessionId: '[dry-run]',
    };
  }

  // Build orchestrator config
  const config: {
    projectRoot: string;
    prdPath: string;
    maxAttempts?: number;
    verbose?: boolean;
    continueOnFailure?: boolean;
    model?: 'opus' | 'sonnet' | 'haiku' | 'flash' | 'pro';
    backend?: 'cli' | 'api';
    useMultiAgentMode?: boolean;
  } = {
    projectRoot,
    prdPath: validation.path,
  };
  if (options?.maxAttempts !== undefined) {
    config.maxAttempts = options.maxAttempts;
  }
  if (options?.verbose !== undefined) {
    config.verbose = options.verbose;
  }
  if (options?.continueOnFailure !== undefined) {
    config.continueOnFailure = options.continueOnFailure;
  }
  if (options?.model !== undefined) {
    config.model = options.model;
  }
  if (options?.backend !== undefined) {
    config.backend = options.backend;
  }
  if (options?.useMultiAgentMode !== undefined) {
    config.useMultiAgentMode = options.useMultiAgentMode;
  }

  // Create orchestrator
  const orchestrator = new FelixOrchestrator(config);

  // Store orchestrator for pause/resume/cancel
  setOrchestrator(project, orchestrator);

  console.error(`[ralph] Starting orchestrator for ${project}...`);

  // Blocking mode for CLI
  if (options?.wait) {
    try {
      await orchestrator.start();
      console.error(`[ralph] Orchestrator completed for ${project}`);
      const state = orchestrator.getState();
      removeOrchestrator(project);
      const success = state.status === 'completed';
      const result: { success: boolean; sessionId?: string; error?: string } = { success };
      if (state.sessionId) result.sessionId = state.sessionId;
      if (!success) {
        const failedCount = state.failedTasks?.length ?? 0;
        const skippedCount = state.skippedTasks?.length ?? 0;
        result.error = `Session ${state.status}. Failed: ${failedCount}, Skipped: ${skippedCount}`;
      }
      return result;
    } catch (error) {
      console.error(`[ralph] Orchestrator failed for ${project}:`, error);
      const state = orchestrator.getState();
      removeOrchestrator(project);
      const result: { success: boolean; sessionId?: string; error: string } = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
      if (state.sessionId) result.sessionId = state.sessionId;
      return result;
    }
  }

  // Non-blocking mode for MCP - return immediately, poll status to track progress
  orchestrator
    .start()
    .then(() => {
      console.error(`[ralph] Orchestrator completed for ${project}`);
    })
    .catch((error) => {
      console.error(`[ralph] Orchestrator failed for ${project}:`, error);
      removeOrchestrator(project);
    });

  // Get session ID from orchestrator state
  const state = orchestrator.getState();

  return {
    success: true,
    sessionId: state.sessionId ?? `${project}:status=${state.status}`,
  };
}

// ============================================================================
// BACKGROUND SESSION (for MCP)
// ============================================================================

const RALPH_LOGS_DIR = '.krolik/felix/logs';

/**
 * Start session in background process (for MCP tool)
 * Unlike startSession which runs in-memory, this spawns a detached CLI process
 */
export function startSessionBackground(
  projectRoot: string,
  prdPath?: string,
  options?: StartSessionOptions,
): { success: boolean; sessionId?: string; logFile?: string; error?: string } {
  const project = projectRoot.split('/').pop() ?? 'unknown';

  // Check for existing active session
  const existing = getActiveSession(project, projectRoot);
  if (existing) {
    return {
      success: false,
      error: `Active session already exists (${existing.id}). Use 'resume' or 'cancel' first.`,
    };
  }

  // Validate PRD
  const validation = validatePrdFile(projectRoot, prdPath);
  if (!validation.valid || !validation.path) {
    return {
      success: false,
      error: validation.errors.join('\n'),
    };
  }

  // Dry run - just validate
  if (options?.dryRun) {
    return {
      success: true,
      sessionId: '[dry-run]',
    };
  }

  // Generate session ID
  const sessionId = `ralph-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const logsDir = join(projectRoot, RALPH_LOGS_DIR);
  const logFile = join(logsDir, `${sessionId}.log`);

  // Ensure logs directory exists
  mkdirSync(logsDir, { recursive: true });

  // Build args for internal _run command
  // Note: useMultiAgentMode is deprecated - Router decides execution mode automatically
  const args = ['ralph', '_run', '--prd', validation.path, '--session-id', sessionId];
  if (options?.model) args.push('--model', options.model);
  if (options?.backend) args.push('--backend', options.backend);
  if (options?.maxAttempts !== undefined) args.push('--max-attempts', String(options.maxAttempts));
  if (options?.continueOnFailure) args.push('--continue-on-failure');

  // Log start
  const startMsg = `[${new Date().toISOString()}] Starting Felix session ${sessionId}\nPRD: ${validation.path}\n\n`;
  appendFileSync(logFile, startMsg);

  // Find krolik-cli directory - we're running from within krolik-cli package
  // Use __dirname or process.cwd() to find the CLI
  const krolikCliDir = join(projectRoot, '..', 'krolik-cli');

  // Spawn detached process
  const child = spawn('pnpm', ['krolik', ...args], {
    cwd: krolikCliDir,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Pipe output to log file
  child.stdout?.on('data', (data: Buffer) => {
    appendFileSync(logFile, data);
  });
  child.stderr?.on('data', (data: Buffer) => {
    appendFileSync(logFile, data);
  });

  child.on('exit', (code) => {
    const endMsg = `\n[${new Date().toISOString()}] Session ${sessionId} exited with code ${code}\n`;
    appendFileSync(logFile, endMsg);
  });

  // Detach child process so it continues after parent exits
  child.unref();

  return {
    success: true,
    sessionId,
    logFile,
  };
}

/**
 * Pause active session
 */
export function pauseActiveSession(projectRoot: string): { success: boolean; error?: string } {
  const project = projectRoot.split('/').pop() ?? 'unknown';

  const orchestrator = getOrchestrator(project);
  if (!orchestrator) {
    const session = getActiveSession(project, projectRoot);
    if (session) {
      return {
        success: false,
        error: 'Session exists but orchestrator not running. Use cancel to clean up.',
      };
    }
    return { success: false, error: 'No active session to pause.' };
  }

  const state = orchestrator.getState();
  if (state.status !== 'running') {
    return { success: false, error: `Session is ${state.status}, cannot pause.` };
  }

  orchestrator.pause();
  return { success: true };
}

/**
 * Resume paused session
 */
export function resumeActiveSession(projectRoot: string): {
  success: boolean;
  sessionId?: string;
  error?: string;
} {
  const project = projectRoot.split('/').pop() ?? 'unknown';

  const orchestrator = getOrchestrator(project);
  if (!orchestrator) {
    const session = getActiveSession(project, projectRoot);
    if (session) {
      return {
        success: false,
        error: 'Session exists but orchestrator not running. Cannot resume orphaned session.',
      };
    }
    return { success: false, error: 'No active session to resume.' };
  }

  const state = orchestrator.getState();
  if (state.status !== 'paused') {
    return { success: false, error: `Session is ${state.status}, cannot resume.` };
  }

  orchestrator.resume().catch((error) => {
    console.error(`[ralph] Resume failed for ${project}:`, error);
    removeOrchestrator(project);
  });

  const result: { success: boolean; sessionId?: string; error?: string } = { success: true };
  if (state.sessionId) {
    result.sessionId = state.sessionId;
  }
  return result;
}

/**
 * Cancel active session
 */
export function cancelActiveSession(projectRoot: string): { success: boolean; error?: string } {
  const project = projectRoot.split('/').pop() ?? 'unknown';

  const orchestrator = getOrchestrator(project);
  if (orchestrator) {
    orchestrator.cancel();
    removeOrchestrator(project);
    return { success: true };
  }

  // Check for orphaned session in storage
  const session = getActiveSession(project, projectRoot);
  if (session) {
    cancelSession(session.id, projectRoot);
    return { success: true };
  }

  return { success: false, error: 'No active session to cancel.' };
}

// ============================================================================
// OUTPUT FORMATTERS
// ============================================================================

export function formatStatusXML(status: FelixStatus): string {
  const lines: string[] = ['<felix-status>'];

  // Session info
  if (status.session) {
    const s = status.session;
    lines.push(`  <session id="${s.id}" status="${s.status}">`);
    lines.push(
      `    <progress completed="${s.progress.completed}" failed="${s.progress.failed}" skipped="${s.progress.skipped}" total="${s.progress.total}" percentage="${s.progress.percentage}%"/>`,
    );
    lines.push(`    <cost tokens="${s.cost.tokens}" usd="${s.cost.usd.toFixed(4)}"/>`);
    if (s.currentTask) {
      lines.push(`    <current-task>${s.currentTask}</current-task>`);
    }
    lines.push(`    <started-at>${s.startedAt}</started-at>`);
    lines.push('  </session>');
  } else {
    lines.push('  <session active="false"/>');
  }

  // PRD info
  if (status.prd) {
    const p = status.prd;
    lines.push(`  <prd path="${p.path}" valid="${p.valid}" tasks="${p.taskCount}">`);
    if (p.errors && p.errors.length > 0) {
      lines.push('    <errors>');
      for (const err of p.errors) {
        lines.push(`      <error>${escapeXml(err)}</error>`);
      }
      lines.push('    </errors>');
    }
    lines.push('  </prd>');
  } else {
    lines.push('  <prd found="false"/>');
  }

  // Stats
  lines.push('  <stats>');
  lines.push(`    <sessions total="${status.stats.totalSessions}"/>`);
  lines.push(
    `    <attempts total="${status.stats.totalAttempts}" success-rate="${status.stats.successRate}%"/>`,
  );
  lines.push(`    <guardrails total="${status.stats.totalGuardrails}"/>`);
  lines.push('  </stats>');

  lines.push('</felix-status>');
  return lines.join('\n');
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatValidationXML(result: ReturnType<typeof validatePrdFile>): string {
  const lines: string[] = ['<prd-validation>'];

  lines.push(`  <valid>${result.valid}</valid>`);

  if (result.path) {
    lines.push(`  <path>${result.path}</path>`);
  }

  if (result.taskCount !== undefined) {
    lines.push(`  <task-count>${result.taskCount}</task-count>`);
  }

  if (result.executionOrder && result.executionOrder.length > 0) {
    lines.push('  <execution-order>');
    for (const taskId of result.executionOrder) {
      lines.push(`    <task>${taskId}</task>`);
    }
    lines.push('  </execution-order>');
  }

  if (result.errors.length > 0) {
    lines.push('  <errors>');
    for (const err of result.errors) {
      lines.push(`    <error>${escapeXml(err)}</error>`);
    }
    lines.push('  </errors>');
  }

  lines.push('</prd-validation>');
  return lines.join('\n');
}

// ============================================================================
// MODEL ROUTING COMMANDS
// ============================================================================

/**
 * Convert PRDTask to TaskAttributes for router
 */
function prdTaskToAttributes(task: PRDTask): TaskAttributes {
  return {
    id: task.id,
    complexity: task.complexity,
    filesAffected: task.files_affected,
    acceptanceCriteria: task.acceptance_criteria.map((c) =>
      typeof c === 'string' ? c : c.description,
    ),
    tags: task.tags,
  };
}

/**
 * Get routing plan for PRD tasks
 */
export function getRoutingPlan(
  projectRoot: string,
  prdPath?: string,
): {
  success: boolean;
  xml?: string;
  summary?: ReturnType<typeof getRoutingPlanSummary>;
  error?: string;
} {
  const foundPath = findPrdPath(projectRoot, prdPath);

  if (!foundPath) {
    return {
      success: false,
      error: 'PRD file not found. Create PRD.json or specify --prd path.',
    };
  }

  const { prd, errors } = loadAndValidatePRD(foundPath);

  if (!prd) {
    return { success: false, error: errors.join('\n') };
  }

  const orderedTasks = getTaskExecutionOrder(prd.tasks);
  const taskAttributes = orderedTasks.map(prdTaskToAttributes);
  const decisions = routeTasks(taskAttributes, projectRoot);
  const summary = getRoutingPlanSummary(decisions);

  return {
    success: true,
    xml: formatRoutingDecisionsXml(decisions),
    summary,
  };
}

/**
 * Get cost estimate for PRD tasks
 */
export function getCostEstimate(
  projectRoot: string,
  prdPath?: string,
): {
  success: boolean;
  xml?: string;
  estimate?: {
    optimistic: number;
    expected: number;
    pessimistic: number;
  };
  error?: string;
} {
  const foundPath = findPrdPath(projectRoot, prdPath);

  if (!foundPath) {
    return {
      success: false,
      error: 'PRD file not found. Create PRD.json or specify --prd path.',
    };
  }

  const { prd, errors } = loadAndValidatePRD(foundPath);

  if (!prd) {
    return { success: false, error: errors.join('\n') };
  }

  const orderedTasks = getTaskExecutionOrder(prd.tasks);
  const taskAttributes = orderedTasks.map(prdTaskToAttributes);
  const estimate = estimateTotalCost(taskAttributes, projectRoot);

  return {
    success: true,
    xml: formatCostEstimateXml(estimate),
    estimate: {
      optimistic: estimate.optimistic,
      expected: estimate.expected,
      pessimistic: estimate.pessimistic,
    },
  };
}

/**
 * Get routing statistics
 */
export function getRouterStats(projectRoot: string): {
  success: boolean;
  xml: string;
  stats: ReturnType<typeof getRoutingStats>;
} {
  const stats = getRoutingStats(projectRoot);

  const lines: string[] = ['<routing-stats>'];
  lines.push(`  <total-patterns>${stats.totalPatterns}</total-patterns>`);
  lines.push(`  <patterns-with-data>${stats.patternsWithSufficientData}</patterns-with-data>`);
  lines.push(`  <escalation-rate>${(stats.avgEscalationRate * 100).toFixed(1)}%</escalation-rate>`);

  lines.push('  <model-distribution>');
  for (const [model, data] of Object.entries(stats.modelDistribution)) {
    const total = data.success + data.fail;
    const successRate = total > 0 ? ((data.success / total) * 100).toFixed(1) : '0';
    lines.push(
      `    <model name="${model}" success="${data.success}" fail="${data.fail}" rate="${successRate}%"/>`,
    );
  }
  lines.push('  </model-distribution>');

  lines.push('</routing-stats>');

  return {
    success: true,
    xml: lines.join('\n'),
    stats,
  };
}
