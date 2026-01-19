/**
 * GeminiCliLlm - Gemini CLI-based LLM adapter for ADK
 *
 * Implements BaseLlm interface using the `gemini` CLI command.
 * Allows ADK to work without API keys by using local Gemini CLI.
 *
 * @module @felix/models/gemini-cli-llm
 */

import { BaseCliLlm, type ProviderConfig } from './base-cli-llm.js';
import type { BaseCliLlmParams } from './cli-shared.js';
import { getCliModelName, isValidModelAlias } from './model-config.js';

// ============================================================================
// TYPES
// ============================================================================

export interface GeminiCliLlmParams extends BaseCliLlmParams {
  /** Model name (gemini-2.0-flash, gemini-2.0-pro, etc.) or alias (flash, pro) */
  model?: string;
  /** Auto-approve all actions (yolo mode) */
  autoApprove?: boolean;
  /** Skip model validation (allow any model, let CLI handle errors) */
  skipValidation?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_EXECUTABLE = 'gemini';
const DEFAULT_MODEL = 'gemini-2.0-flash';

// ============================================================================
// PROVIDER CONFIG
// ============================================================================

const GEMINI_PROVIDER_CONFIG: ProviderConfig = {
  providerName: 'Gemini',
  errorCodePrefix: 'GEMINI_CLI',
  defaultExecutable: DEFAULT_EXECUTABLE,
  defaultModel: DEFAULT_MODEL,
  useStdin: false, // Gemini CLI takes prompt as argument
  useRoleMarkers: false, // Simple text prompt
};

// ============================================================================
// GEMINI CLI LLM
// ============================================================================

/**
 * Gemini CLI-based LLM adapter
 *
 * Uses the `gemini` CLI command for execution instead of API calls.
 * This allows ADK to work in environments where only CLI is available.
 */
export class GeminiCliLlm extends BaseCliLlm {
  static readonly supportedModels: Array<string | RegExp> = [/^gemini-cli/];

  private actualModel: string;
  private autoApprove: boolean;

  constructor(params: GeminiCliLlmParams = {}) {
    const inputModel = params.model ?? DEFAULT_MODEL;

    // Validate model if not skipped
    if (!params.skipValidation && !isValidModelAlias(inputModel, 'google')) {
      console.warn(
        `[gemini-cli] Warning: Model "${inputModel}" not in known models. ` +
          `CLI will handle validation.`,
      );
    }

    // Get CLI-compatible model name
    const cliModel = getCliModelName(inputModel);

    // Use a special model name to identify CLI backend
    super(`gemini-cli:${cliModel}`, params, GEMINI_PROVIDER_CONFIG);
    this.actualModel = cliModel;
    this.autoApprove = params.autoApprove ?? true;
  }

  // ==========================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS
  // ==========================================================================

  protected getProviderConfig(): ProviderConfig {
    return GEMINI_PROVIDER_CONFIG;
  }

  protected buildCliArgs(prompt?: string): string[] {
    const args: string[] = [];

    // Model selection
    if (this.actualModel) {
      args.push('--model', this.actualModel);
    }

    // Output format
    args.push('--output-format', 'text');

    // Auto-approve (yolo mode) for autonomous operation
    if (this.autoApprove) {
      args.push('--yolo');
    }

    // Prompt as positional argument (Gemini CLI style)
    if (prompt) {
      args.push(prompt);
    }

    return args;
  }

  /**
   * Override to filter Gemini-specific output
   */
  protected processOutput(output: string): string {
    // Filter out "Loaded cached credentials" message
    return output.replace(/Loaded cached credentials\.\n?/g, '').trim();
  }
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Create a Gemini CLI LLM instance
 */
export function createGeminiCliLlm(
  model = DEFAULT_MODEL,
  options?: Omit<GeminiCliLlmParams, 'model'>,
): GeminiCliLlm {
  return new GeminiCliLlm({
    model,
    ...options,
  });
}
