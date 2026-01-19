/**
 * Krolik Felix Types
 *
 * Core TypeScript interfaces for the autonomous agent loop.
 *
 * @module @felix/types
 */

import type { QualityGateIssue, QualityGateSummary } from './executor/quality-gate.js';

// ============================================================================
// Test Framework Types (defined locally to avoid broken imports)
// ============================================================================

export type TestFramework = 'vitest' | 'jest' | 'bun' | 'mocha' | 'ava' | 'playwright' | 'unknown';

// ============================================================================
// Test Runner Types
// ============================================================================

export type TestType = 'unit' | 'integration' | 'e2e' | 'typecheck' | 'lint';

export interface TestCommand {
  framework: TestFramework;
  type: TestType;
  command: string;
  cwd?: string;
  timeout?: number;
  env?: Record<string, string>;
}

// ============================================================================
// Test Result Types
// ============================================================================

export type TestStatus = 'passed' | 'failed' | 'skipped' | 'flaky' | 'timeout' | 'error';

export interface TestFailure {
  testName: string;
  testFile: string;
  errorMessage: string;
  stackTrace?: string | undefined;
  line?: number | undefined;
  column?: number | undefined;
  expected?: unknown;
  actual?: unknown;
  diff?: string | undefined;
  isDeterministic: boolean;
  retryable: boolean;
}

export interface TestSuite {
  name: string;
  file: string;
  duration: number;
  passed: number;
  failed: number;
  skipped: number;
  tests: TestCase[];
}

export interface TestCase {
  name: string;
  status: TestStatus;
  duration: number;
  errorMessage?: string;
  stackTrace?: string;
  retryCount?: number;
}

export interface CoverageReport {
  lines: CoverageMetric;
  statements: CoverageMetric;
  functions: CoverageMetric;
  branches: CoverageMetric;
}

export interface CoverageMetric {
  total: number;
  covered: number;
  percentage: number;
}

export interface TestResult {
  framework: TestFramework;
  type: TestType;
  status: 'success' | 'failure' | 'error';
  exitCode: number;
  duration: number;
  timestamp: string;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  suites: TestSuite[];
  failures: TestFailure[];
  coverage?: CoverageReport | undefined;
  stdout: string;
  stderr: string;
  retryCount: number;
  maxRetries: number;
}

// ============================================================================
// Parser Types
// ============================================================================

export interface ParserOutput {
  framework: TestFramework;
  result: TestResult;
  rawOutput: string;
}

export interface TestOutputParser {
  framework: TestFramework;
  parse(stdout: string, stderr: string, exitCode: number): TestResult;
  extractFailures(output: string): TestFailure[];
  detectFlaky(failure: TestFailure, history: TestFailure[]): boolean;
}

// ============================================================================
// Retry Strategy Types
// ============================================================================

export type BackoffStrategy = 'linear' | 'exponential' | 'fibonacci';

export interface RetryConfig {
  maxRetries: number;
  backoffStrategy: BackoffStrategy;
  baseDelay: number;
  maxDelay: number;
  retryableErrors: string[];
  flakyTestPatterns: string[];
  deterministicFailureThreshold: number;
}

export interface RetryDecision {
  shouldRetry: boolean;
  reason: string;
  delay: number;
  contextForNextAttempt: string;
  suggestedActions: string[];
}

// ============================================================================
// Claude Integration Types
// ============================================================================

export type ClaudeModel = 'opus' | 'sonnet' | 'haiku';

export interface ClaudeRequest {
  prompt: string;
  systemPrompt?: string;
  model?: ClaudeModel;
  maxTokens?: number;
  temperature?: number;
  tools?: ClaudeTool[];
}

export interface ClaudeTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ClaudeResponse {
  content: string;
  model: string;
  usage: TokenUsage;
  stopReason: string;
  toolCalls?: ClaudeToolCall[];
}

export interface ClaudeToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface CostInfo {
  inputCost: number;
  outputCost: number;
  totalCost: number;
}

// ============================================================================
// File Change Types
// ============================================================================

export type FileChangeType = 'created' | 'modified' | 'deleted';

export interface FileChange {
  type: FileChangeType;
  path: string;
  content?: string;
}

// ============================================================================
// Implementation Types
// ============================================================================

export interface ImplementationRequest {
  taskId: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  relatedFiles: string[];
  failureContext?: FailureContextForRetry;
  guardrails?: string[];
  projectContext?: string;
}

export interface ImplementationResponse {
  success: boolean;
  fileChanges: FileChange[];
  commandsExecuted: string[];
  reasoning: string;
  usage: TokenUsage;
  cost: CostInfo;
  error?: string;
  rawResponse?: string;
}

export interface FailureContextForRetry {
  summary: string;
  affectedFiles: string[];
  suggestedFixes: string[];
  errorPatterns: string[];
  previousAttempts: number;
  maxAttempts: number;
}

// ============================================================================
// Krolik Felix Orchestrator Types
// ============================================================================

export interface RalphLoopOptions {
  projectRoot: string;
  prdPath?: string;
  progressPath?: string;
  guardrailsPath?: string;
  dryRun?: boolean;
  verbose?: boolean;
  maxConcurrentTasks?: number;
  continueOnFailure?: boolean;
}

export interface RalphLoopState {
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  sessionId?: string;
  currentTaskId?: string;
  completedTasks: string[];
  failedTasks: string[];
  skippedTasks: string[];
  totalTokensUsed: number;
  totalCostUsd: number;
  startedAt?: string;
  completedAt?: string;
}

export interface TaskExecutionResult {
  taskId: string;
  success: boolean;
  attempts: number;
  tokensUsed: number;
  costUsd: number;
  duration: number;
  fileChanges: FileChange[];
  error?: string;
  commitSha?: string;
}

// ============================================================================
// Event Types
// ============================================================================

export type CircuitBreakerState = 'closed' | 'open' | 'half_open';

export type RalphLoopEvent =
  | { type: 'loop_started'; timestamp: string }
  | { type: 'loop_completed'; timestamp: string; state: RalphLoopState }
  | { type: 'loop_failed'; timestamp: string; error: string }
  | { type: 'loop_cancelled'; timestamp: string }
  | { type: 'task_started'; timestamp: string; taskId: string }
  | { type: 'task_completed'; timestamp: string; taskId: string; result: TaskExecutionResult }
  | { type: 'task_failed'; timestamp: string; taskId: string; error: string }
  | { type: 'attempt_started'; timestamp: string; taskId: string; attempt: number }
  | {
      type: 'attempt_completed';
      timestamp: string;
      taskId: string;
      attempt: number;
      success: boolean;
    }
  | { type: 'validation_started'; timestamp: string; taskId: string }
  | { type: 'validation_completed'; timestamp: string; taskId: string; passed: boolean }
  | { type: 'file_changed'; timestamp: string; change: FileChange }
  | { type: 'cost_update'; timestamp: string; cost: CostInfo; totalCost: number }
  | { type: 'guardrail_created'; timestamp: string; guardrailId: string }
  | {
      type: 'circuit_breaker_tripped';
      timestamp: string;
      state: CircuitBreakerState;
      failures: number;
    }
  | {
      type: 'quality_gate_failed';
      timestamp: string;
      issues: QualityGateIssue[];
      summary: QualityGateSummary;
    };

export type RalphLoopEventHandler = (event: RalphLoopEvent) => void;

/**
 * Event emitter function type (alias for RalphLoopEventHandler)
 */
export type EventEmitter = (event: RalphLoopEvent) => void;
