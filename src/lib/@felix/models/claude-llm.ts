/**
 * ClaudeLlm - Anthropic Claude implementation for ADK
 */

import { randomUUID } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import type {
  MessageParam,
  TextBlockParam,
  Tool,
  ToolResultBlockParam,
  ToolUseBlockParam,
} from '@anthropic-ai/sdk/resources/messages';
import type { BaseLlmConnection, LlmRequest, LlmResponse } from '@google/adk';
import { BaseLlm } from '@google/adk';
import type { Content, FunctionCall, FunctionResponse, Part } from '@google/genai';
import { FinishReason } from '@google/genai';

export interface ClaudeLlmParams {
  model: string;
  apiKey?: string;
  maxTokens?: number;
}

export class ClaudeLlm extends BaseLlm {
  static readonly supportedModels: Array<string | RegExp> = [/^claude-/];

  private client: Anthropic;
  private maxTokens: number;

  constructor(params: ClaudeLlmParams) {
    super({ model: params.model });
    this.client = new Anthropic({
      apiKey: params.apiKey ?? process.env.ANTHROPIC_API_KEY,
    });
    this.maxTokens = params.maxTokens ?? 8192;
  }

  async *generateContentAsync(
    llmRequest: LlmRequest,
    stream = false,
  ): AsyncGenerator<LlmResponse, void> {
    const { messages, system } = this.convertContentsToMessages(llmRequest.contents);
    const tools = this.convertToolsToClaudeFormat(llmRequest);

    try {
      if (stream) {
        yield* this.streamResponse(messages, system, tools);
      } else {
        yield await this.generateResponse(messages, system, tools);
      }
    } catch (error) {
      yield this.createErrorResponse(error);
    }
  }

  private async generateResponse(
    messages: MessageParam[],
    system: string | undefined,
    tools: Tool[],
  ): Promise<LlmResponse> {
    const params: Anthropic.MessageCreateParamsNonStreaming = {
      model: this.model,
      max_tokens: this.maxTokens,
      messages: messages,
    };

    if (system) {
      params.system = system;
    }

    if (tools.length > 0) {
      params.tools = tools;
    }

    const response = await this.client.messages.create(params);
    return this.convertClaudeResponseToLlmResponse(response);
  }

  private async *streamResponse(
    messages: MessageParam[],
    system: string | undefined,
    tools: Tool[],
  ): AsyncGenerator<LlmResponse, void> {
    const params: Anthropic.MessageCreateParams = {
      model: this.model,
      max_tokens: this.maxTokens,
      messages: messages,
    };

    if (system) {
      params.system = system;
    }

    if (tools.length > 0) {
      params.tools = tools;
    }

    const stream = this.client.messages.stream(params);

    let textContent = '';

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        textContent += event.delta.text;
        yield {
          content: {
            role: 'model',
            parts: [{ text: textContent }],
          },
          partial: true,
        };
      }
    }

    const finalMessage = await stream.finalMessage();
    yield this.convertClaudeResponseToLlmResponse(finalMessage);
  }

  private convertContentsToMessages(contents: Content[]): {
    messages: MessageParam[];
    system: string | undefined;
  } {
    const messages: MessageParam[] = [];
    let system: string | undefined;

    for (const content of contents) {
      if (content.role === 'user') {
        const text = this.extractText(content.parts ?? []);
        const toolResults = this.extractToolResults(content.parts ?? []);

        if (toolResults.length > 0) {
          messages.push({
            role: 'user',
            content: toolResults,
          });
        } else if (text) {
          messages.push({
            role: 'user',
            content: text,
          });
        }
      } else if (content.role === 'model') {
        const text = this.extractText(content.parts ?? []);
        const toolCalls = this.extractToolCalls(content.parts ?? []);

        if (toolCalls.length > 0 || text) {
          const contentBlocks: (TextBlockParam | ToolUseBlockParam)[] = [];
          if (text) {
            contentBlocks.push({ type: 'text', text });
          }
          for (const call of toolCalls) {
            contentBlocks.push({
              type: 'tool_use',
              id: call.id,
              name: call.name,
              input: call.args,
            });
          }
          messages.push({
            role: 'assistant',
            content: contentBlocks,
          });
        }
      }
    }

    return { messages, system };
  }

  private extractText(parts: Part[]): string {
    return parts
      .filter((p): p is Part & { text: string } => 'text' in p && typeof p.text === 'string')
      .map((p) => p.text)
      .join('');
  }

  private extractToolCalls(parts: Part[]): Array<{ id: string; name: string; args: object }> {
    return parts
      .filter((p): p is Part & { functionCall: FunctionCall } => 'functionCall' in p)
      .filter((p) => p.functionCall.name !== undefined)
      .map((p) => ({
        id: p.functionCall.id ?? `call_${randomUUID()}`,
        name: p.functionCall.name!,
        args: p.functionCall.args ?? {},
      }));
  }

  private extractToolResults(parts: Part[]): ToolResultBlockParam[] {
    return parts
      .filter((p): p is Part & { functionResponse: FunctionResponse } => 'functionResponse' in p)
      .map((p) => ({
        type: 'tool_result' as const,
        tool_use_id: p.functionResponse.id ?? `result_${randomUUID()}`,
        content: JSON.stringify(p.functionResponse.response),
      }));
  }

  private convertToolsToClaudeFormat(llmRequest: LlmRequest): Tool[] {
    const tools: Tool[] = [];
    const toolDeclarations = llmRequest.config?.tools ?? [];

    for (const toolGroup of toolDeclarations) {
      // Handle both object format and function declarations
      if ('functionDeclarations' in toolGroup && toolGroup.functionDeclarations) {
        for (const decl of toolGroup.functionDeclarations) {
          const { properties, required } = this.extractSchemaProperties(decl.parameters);
          tools.push({
            name: decl.name ?? 'unknown',
            description: decl.description ?? '',
            input_schema: {
              type: 'object' as const,
              properties,
              required,
            },
          });
        }
      }
    }

    return tools;
  }

  /**
   * Safely extract schema properties with type validation
   */
  private extractSchemaProperties(parameters: unknown): {
    properties: Record<string, unknown>;
    required: string[];
  } {
    if (!this.isSchemaObject(parameters)) {
      return { properties: {}, required: [] };
    }

    const properties = this.isPlainObject(parameters.properties) ? parameters.properties : {};
    const required =
      Array.isArray(parameters.required) &&
      parameters.required.every((r): r is string => typeof r === 'string')
        ? parameters.required
        : [];

    return { properties, required };
  }

  /**
   * Type guard for schema objects
   */
  private isSchemaObject(value: unknown): value is { properties?: unknown; required?: unknown } {
    return typeof value === 'object' && value !== null;
  }

  /**
   * Type guard for plain objects
   */
  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private convertClaudeResponseToLlmResponse(response: Anthropic.Message): LlmResponse {
    const parts: Part[] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        parts.push({ text: block.text });
      } else if (block.type === 'tool_use') {
        parts.push({
          functionCall: {
            id: block.id,
            name: block.name,
            args: block.input as Record<string, unknown>,
          },
        });
      }
    }

    return {
      content: {
        role: 'model',
        parts,
      },
      turnComplete: true,
      usageMetadata: {
        promptTokenCount: response.usage.input_tokens,
        candidatesTokenCount: response.usage.output_tokens,
        totalTokenCount: response.usage.input_tokens + response.usage.output_tokens,
      },
      finishReason: this.mapStopReason(response.stop_reason),
    };
  }

  private mapStopReason(stopReason: string | null): FinishReason {
    switch (stopReason) {
      case 'end_turn':
        return FinishReason.STOP;
      case 'tool_use':
        return FinishReason.STOP; // ADK doesn't have TOOL_CALL, uses STOP
      case 'max_tokens':
        return FinishReason.MAX_TOKENS;
      default:
        return FinishReason.STOP;
    }
  }

  private createErrorResponse(error: unknown): LlmResponse {
    const message = error instanceof Error ? error.message : String(error);
    return {
      errorCode: 'CLAUDE_ERROR',
      errorMessage: message,
    };
  }

  async connect(_llmRequest: LlmRequest): Promise<BaseLlmConnection> {
    throw new Error('Live connection not supported for Claude');
  }
}

/**
 * Factory function for creating Claude LLM instances
 */
export function createClaudeLlm(model = 'claude-sonnet-4-20250514', apiKey?: string): ClaudeLlm {
  return new ClaudeLlm({
    model,
    apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY ?? '',
  });
}
