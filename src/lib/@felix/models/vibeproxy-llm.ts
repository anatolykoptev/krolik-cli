/**
 * VibeProxyLlm - VibeProxy/CLIProxyAPIPlus implementation for ADK
 *
 * Uses VibeProxy's OpenAI-compatible API to access multiple providers:
 * - Antigravity (Claude Opus/Sonnet via Google account)
 * - Claude Code subscription
 * - ChatGPT subscription
 * - Gemini
 *
 * @module @ralph/models/vibeproxy-llm
 */

import type { BaseLlmConnection, LlmRequest, LlmResponse } from '@google/adk';
import { BaseLlm } from '@google/adk';
import type { Content, Part } from '@google/genai';
import { FinishReason } from '@google/genai';

// ============================================================================
// TYPES
// ============================================================================

export interface VibeProxyLlmParams {
  /** Model name (gemini-claude-opus-4-5-thinking, etc.) */
  model?: string;
  /** VibeProxy API key (defaults to VIBEPROXY_API_KEY env var or dummy key) */
  apiKey?: string;
  /** VibeProxy base URL (defaults to http://localhost:8318) */
  baseUrl?: string;
  /** Max tokens to generate */
  maxTokens?: number;
  /** Temperature (0-2) */
  temperature?: number;
}

interface VibeProxyMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface VibeProxyChoice {
  index: number;
  message: {
    role: string;
    content: string;
  };
  finish_reason: string;
}

interface VibeProxyUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface VibeProxyResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: VibeProxyChoice[];
  usage: VibeProxyUsage;
}

interface VibeProxyError {
  error: {
    message: string;
    type: string;
    code?: string;
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_BASE_URL = 'http://localhost:8318';
const DEFAULT_API_KEY = 'sk-vibeproxy-dummy';
const DEFAULT_MODEL = 'gemini-claude-sonnet-4-5-thinking';
const DEFAULT_MAX_TOKENS = 8192;
const DEFAULT_TEMPERATURE = 0.7;

/**
 * Model ID mapping: alias -> VibeProxy model ID
 */
const MODEL_ALIASES: Record<string, string> = {
  'vibe-opus': 'gemini-claude-opus-4-5-thinking',
  'vibe-sonnet': 'gemini-claude-sonnet-4-5-thinking',
  'vibe-sonnet-fast': 'gemini-claude-sonnet-4-5',
  'antigravity-opus': 'gemini-claude-opus-4-5-thinking',
  'antigravity-sonnet': 'gemini-claude-sonnet-4-5-thinking',
  'gemini-3-pro': 'gemini-3-pro-image-preview',
};

// ============================================================================
// VIBEPROXY LLM
// ============================================================================

/**
 * VibeProxy API-based LLM adapter
 *
 * Connects to local VibeProxy server for access to:
 * - Antigravity (free Claude Opus/Sonnet via Google)
 * - Claude Code subscription
 * - ChatGPT subscription
 * - Other providers
 */
export class VibeProxyLlm extends BaseLlm {
  static readonly supportedModels: Array<string | RegExp> = [
    /^gemini-claude-/,
    /^vibe-/,
    /^antigravity-/,
  ];

  private apiKey: string;
  private baseUrl: string;
  private maxTokens: number;
  private temperature: number;
  private actualModel: string;

  constructor(params: VibeProxyLlmParams = {}) {
    const inputModel = params.model ?? DEFAULT_MODEL;
    const actualModel = MODEL_ALIASES[inputModel] ?? inputModel;

    super({ model: actualModel });
    this.actualModel = actualModel;
    this.apiKey = params.apiKey ?? process.env.VIBEPROXY_API_KEY ?? DEFAULT_API_KEY;
    this.baseUrl = params.baseUrl ?? process.env.VIBEPROXY_BASE_URL ?? DEFAULT_BASE_URL;
    this.maxTokens = params.maxTokens ?? DEFAULT_MAX_TOKENS;
    this.temperature = params.temperature ?? DEFAULT_TEMPERATURE;

    if (!this.apiKey || this.apiKey === DEFAULT_API_KEY) {
      console.warn(
        '[vibeproxy-llm] Using default API key. Set VIBEPROXY_API_KEY if VibeProxy requires authentication.',
      );
    }
  }

  async *generateContentAsync(
    llmRequest: LlmRequest,
    _stream = false,
  ): AsyncGenerator<LlmResponse, void> {
    try {
      const messages = this.convertContentsToMessages(llmRequest.contents, llmRequest.config);
      const response = await this.callVibeProxyApi(messages);
      yield this.convertVibeProxyResponseToLlmResponse(response);
    } catch (error) {
      yield this.createErrorResponse(error);
    }
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  private async callVibeProxyApi(messages: VibeProxyMessage[]): Promise<VibeProxyResponse> {
    const url = `${this.baseUrl}/v1/chat/completions`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.actualModel,
        messages,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
      }),
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as VibeProxyError;
      throw new Error(
        `VibeProxy API error: ${errorData.error?.message ?? response.statusText} (${response.status})`,
      );
    }

    return response.json() as Promise<VibeProxyResponse>;
  }

  private convertContentsToMessages(
    contents: Content[],
    config?: LlmRequest['config'],
  ): VibeProxyMessage[] {
    const messages: VibeProxyMessage[] = [];

    // Add system instruction if present
    if (config?.systemInstruction) {
      const sysInst = config.systemInstruction;
      let systemText = '';

      if (typeof sysInst === 'string') {
        systemText = sysInst;
      } else if (typeof sysInst === 'object' && sysInst !== null) {
        const inst = sysInst as Content;
        if (inst.parts) {
          systemText = inst.parts
            .filter((p): p is Part & { text: string } => 'text' in p && typeof p.text === 'string')
            .map((p) => p.text)
            .join('\n');
        } else if ('text' in inst && typeof (inst as Part).text === 'string') {
          systemText = (inst as Part).text as string;
        }
      }

      if (systemText) {
        messages.push({ role: 'system', content: systemText });
      }
    }

    // Convert contents
    for (const content of contents) {
      if (!content.parts) continue;

      const text = content.parts
        .filter((p): p is Part & { text: string } => 'text' in p && typeof p.text === 'string')
        .map((p) => p.text)
        .join('\n');

      if (text) {
        const role = content.role === 'user' ? 'user' : 'assistant';
        messages.push({ role, content: text });
      }
    }

    return messages;
  }

  private convertVibeProxyResponseToLlmResponse(response: VibeProxyResponse): LlmResponse {
    const choice = response.choices[0];
    const text = choice?.message?.content ?? '';

    const parts: Part[] = [{ text }];

    return {
      content: {
        role: 'model',
        parts,
      },
      turnComplete: true,
      usageMetadata: {
        promptTokenCount: response.usage.prompt_tokens,
        candidatesTokenCount: response.usage.completion_tokens,
        totalTokenCount: response.usage.total_tokens,
      },
      finishReason: this.mapFinishReason(choice?.finish_reason),
    };
  }

  private mapFinishReason(reason: string | undefined): FinishReason {
    switch (reason) {
      case 'stop':
        return FinishReason.STOP;
      case 'length':
        return FinishReason.MAX_TOKENS;
      default:
        return FinishReason.STOP;
    }
  }

  private createErrorResponse(error: unknown): LlmResponse {
    const message = error instanceof Error ? error.message : String(error);
    return {
      errorCode: 'VIBEPROXY_ERROR',
      errorMessage: message,
    };
  }

  async connect(_llmRequest: LlmRequest): Promise<BaseLlmConnection> {
    throw new Error('Live connection not supported for VibeProxy');
  }
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Create a VibeProxy LLM instance
 */
export function createVibeProxyLlm(
  model = DEFAULT_MODEL,
  apiKey?: string,
  baseUrl?: string,
): VibeProxyLlm {
  return new VibeProxyLlm({
    model,
    apiKey: apiKey ?? process.env.VIBEPROXY_API_KEY ?? DEFAULT_API_KEY,
    baseUrl: baseUrl ?? process.env.VIBEPROXY_BASE_URL ?? DEFAULT_BASE_URL,
  });
}
