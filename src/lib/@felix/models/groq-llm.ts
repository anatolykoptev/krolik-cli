/**
 * GroqLlm - Groq API implementation for ADK
 *
 * Uses Groq's OpenAI-compatible API for fast, free inference.
 * Supports Llama 3.3 70B, Mixtral, and other models.
 *
 * @module @felix/models/groq-llm
 */

import type { BaseLlmConnection, LlmRequest, LlmResponse } from '@google/adk';
import { BaseLlm } from '@google/adk';
import type { Content, Part } from '@google/genai';
import { FinishReason } from '@google/genai';

// ============================================================================
// TYPES
// ============================================================================

export interface GroqLlmParams {
  /** Model name (llama-3.3-70b-versatile, mixtral-8x7b-32768, etc.) */
  model?: string;
  /** Groq API key (defaults to GROQ_API_KEY env var) */
  apiKey?: string;
  /** Max tokens to generate */
  maxTokens?: number;
  /** Temperature (0-2) */
  temperature?: number;
}

interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GroqChoice {
  index: number;
  message: {
    role: string;
    content: string;
  };
  finish_reason: string;
}

interface GroqUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface GroqResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: GroqChoice[];
  usage: GroqUsage;
}

interface GroqError {
  error: {
    message: string;
    type: string;
    code?: string;
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';
const DEFAULT_MAX_TOKENS = 8192;
const DEFAULT_TEMPERATURE = 0.7;

/**
 * Model ID mapping: alias -> Groq model ID
 */
const MODEL_ALIASES: Record<string, string> = {
  'llama-70b': 'llama-3.3-70b-versatile',
  'llama-8b': 'llama-3.1-8b-instant',
  mixtral: 'mixtral-8x7b-32768',
  'deepseek-r1': 'deepseek-r1-distill-llama-70b',
};

// ============================================================================
// GROQ LLM
// ============================================================================

/**
 * Groq API-based LLM adapter
 *
 * Uses Groq's fast inference API (OpenAI-compatible).
 * Free tier: 14,400 requests/day, 300+ tokens/sec.
 */
export class GroqLlm extends BaseLlm {
  static readonly supportedModels: Array<string | RegExp> = [/^llama-/, /^mixtral-/, /^deepseek-/];

  private apiKey: string;
  private maxTokens: number;
  private temperature: number;
  private actualModel: string;

  constructor(params: GroqLlmParams = {}) {
    const inputModel = params.model ?? DEFAULT_MODEL;
    const actualModel = MODEL_ALIASES[inputModel] ?? inputModel;

    super({ model: actualModel });
    this.actualModel = actualModel;
    this.apiKey = params.apiKey ?? process.env.GROQ_API_KEY ?? '';
    this.maxTokens = params.maxTokens ?? DEFAULT_MAX_TOKENS;
    this.temperature = params.temperature ?? DEFAULT_TEMPERATURE;

    if (!this.apiKey) {
      console.warn('[groq-llm] Warning: No GROQ_API_KEY found. Set it in environment.');
    }
  }

  async *generateContentAsync(
    llmRequest: LlmRequest,
    _stream = false,
  ): AsyncGenerator<LlmResponse, void> {
    try {
      const messages = this.convertContentsToMessages(llmRequest.contents, llmRequest.config);
      const response = await this.callGroqApi(messages);
      yield this.convertGroqResponseToLlmResponse(response);
    } catch (error) {
      yield this.createErrorResponse(error);
    }
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  private async callGroqApi(messages: GroqMessage[]): Promise<GroqResponse> {
    const response = await fetch(GROQ_API_URL, {
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
      const errorData = (await response.json()) as GroqError;
      throw new Error(
        `Groq API error: ${errorData.error?.message ?? response.statusText} (${response.status})`,
      );
    }

    return response.json() as Promise<GroqResponse>;
  }

  private convertContentsToMessages(
    contents: Content[],
    config?: LlmRequest['config'],
  ): GroqMessage[] {
    const messages: GroqMessage[] = [];

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

  private convertGroqResponseToLlmResponse(response: GroqResponse): LlmResponse {
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
      errorCode: 'GROQ_ERROR',
      errorMessage: message,
    };
  }

  async connect(_llmRequest: LlmRequest): Promise<BaseLlmConnection> {
    throw new Error('Live connection not supported for Groq');
  }
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Create a Groq LLM instance
 */
export function createGroqLlm(model = DEFAULT_MODEL, apiKey?: string): GroqLlm {
  return new GroqLlm({
    model,
    apiKey: apiKey ?? process.env.GROQ_API_KEY ?? '',
  });
}
