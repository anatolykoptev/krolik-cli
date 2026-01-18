/**
 * BaseCliLlm - Abstract base class for CLI-based LLM adapters
 *
 * Provides common functionality for CLI-based LLMs (Claude, Gemini, etc.)
 * Concrete implementations only need to override provider-specific methods.
 *
 * @module @ralph/models/base-cli-llm
 */

import { type ChildProcess, spawn } from 'node:child_process';
import type { BaseLlmConnection, LlmRequest, LlmResponse } from '@google/adk';
import { BaseLlm } from '@google/adk';

import {
  type BaseCliLlmParams,
  buildPromptWithRoles,
  buildSafeEnv,
  buildSimplePrompt,
  type CliResult,
  createErrorResponse,
  createSuccessResponse,
  MAX_OUTPUT_SIZE,
  truncateOutput,
  validateWorkingDirectory,
} from './cli-shared.js';
import { DEFAULT_TIMEOUT_MS } from './timeout-config.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Configuration for CLI execution
 */
export interface CliExecutionConfig {
  /** CLI executable path */
  executable: string;
  /** CLI arguments */
  args: string[];
  /** Working directory */
  cwd: string;
  /** Timeout in milliseconds */
  timeout: number;
  /** Environment variables */
  env: Record<string, string>;
  /** Whether to use stdin for prompt */
  useStdin: boolean;
  /** Stream output to console */
  streamOutput: boolean;
}

/**
 * Provider-specific configuration interface
 */
export interface ProviderConfig {
  /** Provider name for logging */
  providerName: string;
  /** Error code prefix */
  errorCodePrefix: string;
  /** Default executable */
  defaultExecutable: string;
  /** Default model */
  defaultModel: string;
  /** Whether to use stdin for prompt (vs args) */
  useStdin: boolean;
  /** Whether to use role markers in prompt */
  useRoleMarkers: boolean;
}

// ============================================================================
// BASE CLI LLM
// ============================================================================

/**
 * Abstract base class for CLI-based LLM adapters
 *
 * Concrete implementations must provide:
 * - getProviderConfig(): Provider-specific configuration
 * - buildCliArgs(): CLI arguments for execution
 * - validateModel(): Model validation logic
 * - processOutput(): Optional output post-processing
 */
export abstract class BaseCliLlm extends BaseLlm {
  protected executablePath: string;
  protected timeoutMs: number;
  protected workingDirectory?: string;
  protected streamOutput: boolean;
  protected cachedVersion: string | null = null;

  constructor(modelIdentifier: string, params: BaseCliLlmParams, providerConfig: ProviderConfig) {
    super({ model: modelIdentifier });
    this.executablePath = params.executablePath ?? providerConfig.defaultExecutable;
    this.timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.streamOutput = params.streamOutput ?? false;

    // Security: Validate working directory (CWE-22 prevention)
    if (params.workingDirectory) {
      this.workingDirectory = validateWorkingDirectory(params.workingDirectory);
    }
  }

  // ==========================================================================
  // ABSTRACT METHODS (must be implemented by subclasses)
  // ==========================================================================

  /**
   * Get provider-specific configuration
   */
  protected abstract getProviderConfig(): ProviderConfig;

  /**
   * Build CLI arguments for execution
   */
  protected abstract buildCliArgs(prompt?: string): string[];

  // ==========================================================================
  // OVERRIDABLE METHODS (can be customized by subclasses)
  // ==========================================================================

  /**
   * Process CLI output before creating response
   * Override to filter/transform output
   */
  protected processOutput(output: string): string {
    return output;
  }

  /**
   * Build prompt from request
   * Override for custom prompt building
   */
  protected buildPrompt(request: LlmRequest): string {
    const config = this.getProviderConfig();
    if (config.useRoleMarkers) {
      return buildPromptWithRoles(request.contents, request.config);
    }
    return buildSimplePrompt(request.contents);
  }

  // ==========================================================================
  // PUBLIC METHODS
  // ==========================================================================

  /**
   * Set timeout for next execution (used for complexity-based timeouts)
   */
  setTimeoutMs(timeoutMs: number): void {
    this.timeoutMs = timeoutMs;
  }

  /**
   * Get current timeout
   */
  getTimeoutMs(): number {
    return this.timeoutMs;
  }

  /**
   * Generate content using CLI
   */
  async *generateContentAsync(
    llmRequest: LlmRequest,
    _stream = false,
  ): AsyncGenerator<LlmResponse, void> {
    const config = this.getProviderConfig();
    const t0 = Date.now();

    try {
      this.log(`[${Date.now() - t0}ms] generateContentAsync called`);
      this.log(`[${Date.now() - t0}ms] contents: ${llmRequest.contents?.length ?? 0}`);

      // Build prompt
      const prompt = this.buildPrompt(llmRequest);
      this.log(`[${Date.now() - t0}ms] Prompt built, length: ${prompt.length}`);

      // Execute via CLI
      this.log(`[${Date.now() - t0}ms] Starting executeCli...`);
      const result = await this.executeCli(prompt);
      this.log(
        `[${Date.now() - t0}ms] CLI result: success=${result.success}, output=${result.output.length} chars, exitCode=${result.exitCode}`,
      );

      if (result.error) {
        this.log(`CLI error: ${result.error.slice(0, 500)}`);
      }

      if (!result.success) {
        yield createErrorResponse(
          result.error ?? 'CLI execution failed',
          `${config.errorCodePrefix}_ERROR`,
        );
        return;
      }

      // Process and yield response
      const processedOutput = this.processOutput(result.output);
      yield createSuccessResponse(processedOutput);
    } catch (error) {
      yield createErrorResponse(error, `${config.errorCodePrefix}_ERROR`);
    }
  }

  /**
   * Check if CLI is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const version = await this.getVersion();
      return version !== null;
    } catch {
      return false;
    }
  }

  /**
   * Get CLI version
   */
  async getVersion(): Promise<string | null> {
    if (this.cachedVersion) return this.cachedVersion;

    return new Promise((resolve) => {
      const proc = spawn(this.executablePath, ['--version'], {
        timeout: 5000,
      });

      let output = '';
      proc.stdout.on('data', (data) => {
        output += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0 && output) {
          this.cachedVersion = output.trim();
          resolve(this.cachedVersion);
        } else {
          resolve(null);
        }
      });

      proc.on('error', () => resolve(null));
    });
  }

  /**
   * Live connection not supported for CLI
   */
  async connect(_llmRequest: LlmRequest): Promise<BaseLlmConnection> {
    const config = this.getProviderConfig();
    throw new Error(`Live connection not supported for ${config.providerName} CLI`);
  }

  // ==========================================================================
  // PROTECTED METHODS
  // ==========================================================================

  /**
   * Execute CLI with prompt
   */
  protected executeCli(prompt: string): Promise<CliResult> {
    const config = this.getProviderConfig();

    return new Promise((resolve) => {
      const t0 = Date.now();
      const args = this.buildCliArgs(config.useStdin ? undefined : prompt);
      this.log(`[exec+${Date.now() - t0}ms] spawn args: ${args.join(' ')}`);

      const cwd = this.workingDirectory ?? process.cwd();
      this.log(`[exec+${Date.now() - t0}ms] Using cwd: ${cwd}`);

      const env = buildSafeEnv();

      const proc = spawn(this.executablePath, args, {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: this.timeoutMs,
        env,
      });

      this.log(`[exec+${Date.now() - t0}ms] spawn created`);

      this.handleCliProcess(proc, prompt, config.useStdin, t0, resolve);
    });
  }

  /**
   * Log message with provider prefix
   */
  protected log(message: string): void {
    const config = this.getProviderConfig();
    console.error(`[${config.providerName.toLowerCase()}-cli] ${message}`);
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  /**
   * Handle CLI process I/O
   */
  private handleCliProcess(
    proc: ChildProcess,
    prompt: string,
    useStdin: boolean,
    t0: number,
    resolve: (result: CliResult) => void,
  ): void {
    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => {
      const chunk = data.toString();
      this.log(`[exec+${Date.now() - t0}ms] stdout chunk: ${chunk.length} bytes`);

      if (stdout.length < MAX_OUTPUT_SIZE) {
        stdout += chunk;
      }

      if (this.streamOutput) {
        process.stdout.write(chunk);
      }
    });

    proc.stderr?.on('data', (data) => {
      const chunk = data.toString();
      stderr += chunk;
      if (this.streamOutput) {
        process.stderr.write(chunk);
      }
    });

    proc.on('close', (code) => {
      const { output, truncated } = truncateOutput(stdout);
      if (truncated) {
        this.log('Output was truncated');
      }

      const result: CliResult = {
        success: code === 0,
        output,
        exitCode: code ?? 1,
      };

      if (code !== 0) {
        result.error = stderr || `Exit code: ${code}`;
      }

      resolve(result);
    });

    proc.on('error', (error) => {
      resolve({
        success: false,
        output: '',
        exitCode: 1,
        error: error.message,
      });
    });

    // Write prompt to stdin if required
    if (useStdin) {
      proc.stdin?.write(prompt);
      proc.stdin?.end();
      this.log(`[exec+${Date.now() - t0}ms] stdin written and closed`);
    } else {
      proc.stdin?.end();
    }
  }
}
