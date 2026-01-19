/**
 * ClaudeCliLlm - Claude CLI-based LLM adapter for ADK
 *
 * Implements BaseLlm interface using the `claude` CLI command.
 * Allows ADK to work without API keys by using local Claude CLI.
 *
 * @module @felix/models/claude-cli-llm
 */

import { BaseCliLlm, type ProviderConfig } from './base-cli-llm.js';
import type { BaseCliLlmParams } from './cli-shared.js';
import { getCliModelName, isValidModelAlias } from './model-config.js';

// Re-export shared types for backwards compatibility
export type { BaseCliLlmParams, CliResult } from './cli-shared.js';
export {
  DEFAULT_TIMEOUT_MS,
  getTimeoutForComplexity,
  TIMEOUT_BY_COMPLEXITY,
} from './timeout-config.js';

// ============================================================================
// TYPES
// ============================================================================

export interface ClaudeCliLlmParams extends BaseCliLlmParams {
  /** Model alias (sonnet, opus, haiku) or full model ID - passed to claude CLI */
  model?: string;
  /** Skip model validation (allow any model, let CLI handle errors) */
  skipValidation?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_EXECUTABLE = 'claude';
const DEFAULT_MODEL = 'sonnet';

// ============================================================================
// PROVIDER CONFIG
// ============================================================================

const CLAUDE_PROVIDER_CONFIG: ProviderConfig = {
  providerName: 'Claude',
  errorCodePrefix: 'CLAUDE_CLI',
  defaultExecutable: DEFAULT_EXECUTABLE,
  defaultModel: DEFAULT_MODEL,
  useStdin: true, // Claude CLI reads prompt from stdin
  useRoleMarkers: true, // Use [USER]/[ASSISTANT] markers
};

// ============================================================================
// CLAUDE CLI LLM
// ============================================================================

/**
 * Claude CLI-based LLM adapter
 *
 * Uses the `claude` CLI command for execution instead of API calls.
 * This allows ADK to work in environments where only CLI is available.
 */
export class ClaudeCliLlm extends BaseCliLlm {
  static readonly supportedModels: Array<string | RegExp> = [/^claude-cli/];

  private modelAlias: string;

  constructor(params: ClaudeCliLlmParams = {}) {
    const inputModel = params.model ?? DEFAULT_MODEL;

    // Validate model if not skipped
    if (!params.skipValidation && !isValidModelAlias(inputModel, 'anthropic')) {
      console.warn(
        `[claude-cli] Warning: Model "${inputModel}" not in known models. ` +
          `CLI will handle validation.`,
      );
    }

    // Get CLI-compatible model name
    const cliModel = getCliModelName(inputModel);

    // Use a special model name to identify CLI backend
    super(`claude-cli:${cliModel}`, params, CLAUDE_PROVIDER_CONFIG);
    this.modelAlias = cliModel;
  }

  // ==========================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS
  // ==========================================================================

  protected getProviderConfig(): ProviderConfig {
    return CLAUDE_PROVIDER_CONFIG;
  }

  protected buildCliArgs(): string[] {
    const args: string[] = [
      '--print', // Print output, don't open editor
      '--dangerously-skip-permissions', // Auto-approve for autonomous operation
    ];

    // Add model if not default
    if (this.modelAlias && this.modelAlias !== 'sonnet') {
      args.push('--model', this.modelAlias);
    }

    return args;
  }
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Create a Claude CLI LLM instance
 */
export function createClaudeCliLlm(
  model = DEFAULT_MODEL,
  options?: Omit<ClaudeCliLlmParams, 'model'>,
): ClaudeCliLlm {
  return new ClaudeCliLlm({
    model,
    ...options,
  });
}
