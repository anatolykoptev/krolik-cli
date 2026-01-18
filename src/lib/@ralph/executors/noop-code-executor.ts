/**
 * NoOp Code Executor
 *
 * A BuiltInCodeExecutor subclass that does nothing for non-Gemini models.
 * This is needed because ADK's Runner automatically sets codeExecutor
 * to BuiltInCodeExecutor for all LlmAgents, which throws an error for
 * non-Gemini models like Claude.
 *
 * By extending BuiltInCodeExecutor, this class:
 * 1. Passes the `instanceof BuiltInCodeExecutor` check in Runner
 * 2. Overrides processLlmRequest to do nothing (skips Gemini code execution setup)
 *
 * @module @ralph/executors/noop-code-executor
 */

import type { LlmRequest } from '@google/adk';
import { BuiltInCodeExecutor } from '@google/adk';

/**
 * A code executor that does nothing.
 * Used for non-Gemini models to prevent the "not supported" error.
 */
export class NoOpBuiltInCodeExecutor extends BuiltInCodeExecutor {
  /**
   * Override processLlmRequest to do nothing.
   * The parent implementation throws an error for non-Gemini models.
   */
  processLlmRequest(_llmRequest: LlmRequest): void {
    // Do nothing - this skips the Gemini code execution setup
    // which is not supported for Claude and other non-Gemini models
  }
}
