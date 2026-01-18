/**
 * Shared utilities for CLI-based LLM adapters
 *
 * Common types, constants, and functions used by both ClaudeCliLlm and GeminiCliLlm.
 *
 * @module @ralph/models/cli-shared
 */

import { existsSync, statSync } from 'node:fs';
import { normalize, resolve as resolvePath } from 'node:path';
import type { LlmRequest, LlmResponse } from '@google/adk';
import type { Content, Part } from '@google/genai';
import { FinishReason } from '@google/genai';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Result of CLI execution
 */
export interface CliResult {
  success: boolean;
  output: string;
  exitCode: number;
  error?: string;
}

/**
 * Common parameters for CLI-based LLMs
 */
export interface BaseCliLlmParams {
  /** Path to CLI executable */
  executablePath?: string;
  /** Timeout in milliseconds */
  timeoutMs?: number;
  /** Working directory for CLI execution */
  workingDirectory?: string;
  /** Stream output to console during execution */
  streamOutput?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum output size in bytes (500KB) */
export const MAX_OUTPUT_SIZE = 500_000;

/**
 * Environment variables allowed for child process
 * Security: Prevents leaking sensitive env vars (API keys, tokens)
 */
export const ALLOWED_ENV_VARS = [
  'PATH',
  'HOME',
  'USER',
  'SHELL',
  'LANG',
  'LC_ALL',
  'TERM',
  'TMPDIR',
  'XDG_CONFIG_HOME',
  'XDG_DATA_HOME',
  'XDG_CACHE_HOME',
] as const;

// ============================================================================
// SECURITY UTILITIES
// ============================================================================

/**
 * Security: Validate working directory to prevent path traversal (CWE-22)
 * @throws Error if directory is invalid or contains path traversal
 */
export function validateWorkingDirectory(dir: string, allowedRoot?: string): string {
  // Normalize and resolve to absolute path
  const normalized = normalize(dir);
  const resolved = resolvePath(normalized);

  // Check for path traversal patterns in original input
  if (dir.includes('..') || normalized !== dir.replace(/\\/g, '/')) {
    throw new Error(`Security: Working directory contains path traversal attempt: "${dir}"`);
  }

  // If allowed root specified, ensure resolved path is within it
  if (allowedRoot) {
    const resolvedRoot = resolvePath(allowedRoot);
    if (!resolved.startsWith(resolvedRoot)) {
      throw new Error(
        `Security: Working directory "${resolved}" is outside allowed root "${resolvedRoot}"`,
      );
    }
  }

  // Verify directory exists and is actually a directory
  if (!existsSync(resolved)) {
    throw new Error(`Working directory does not exist: "${resolved}"`);
  }

  const stat = statSync(resolved);
  if (!stat.isDirectory()) {
    throw new Error(`Working directory is not a directory: "${resolved}"`);
  }

  return resolved;
}

/**
 * Build safe environment with only allowed variables
 * Security: Prevents leaking sensitive env vars to child processes
 */
export function buildSafeEnv(): Record<string, string> {
  const safeEnv: Record<string, string> = { FORCE_COLOR: '0' };
  for (const key of ALLOWED_ENV_VARS) {
    if (process.env[key]) {
      safeEnv[key] = process.env[key]!;
    }
  }
  return safeEnv;
}

// ============================================================================
// RESPONSE UTILITIES
// ============================================================================

/**
 * Create success response in ADK format
 */
export function createSuccessResponse(output: string): LlmResponse {
  const parts: Part[] = [{ text: output }];

  return {
    content: {
      role: 'model',
      parts,
    },
    turnComplete: true,
    finishReason: FinishReason.STOP,
    // CLI doesn't provide token counts
    usageMetadata: {
      promptTokenCount: 0,
      candidatesTokenCount: 0,
      totalTokenCount: 0,
    },
  };
}

/**
 * Create error response in ADK format
 */
export function createErrorResponse(error: unknown, errorCode: string): LlmResponse {
  const message = error instanceof Error ? error.message : String(error);
  return {
    errorCode,
    errorMessage: message,
  };
}

// ============================================================================
// PROMPT UTILITIES
// ============================================================================

/**
 * Build prompt string from ADK Content array with role markers
 * Used for multi-turn conversations
 */
export function buildPromptWithRoles(
  contents: Content[],
  systemInstruction?: LlmRequest['config'],
): string {
  const parts: string[] = [];

  // Add system instruction first if present
  if (systemInstruction) {
    const sysInst = systemInstruction.systemInstruction;
    if (typeof sysInst === 'string') {
      parts.push(`[SYSTEM]\n${sysInst}`);
    } else if (typeof sysInst === 'object' && sysInst !== null) {
      // Handle Content (has role and parts)
      const inst = sysInst as Content;
      if (inst.parts) {
        for (const part of inst.parts) {
          if ('text' in part && typeof part.text === 'string') {
            parts.push(`[SYSTEM]\n${part.text}`);
          }
        }
      }
      // Handle Part directly (has text)
      else if ('text' in inst && typeof (inst as Part).text === 'string') {
        parts.push(`[SYSTEM]\n${(inst as Part).text}`);
      }
    }
  }

  for (const content of contents) {
    if (!content.parts) continue;

    const role = content.role === 'user' ? '[USER]' : '[ASSISTANT]';
    for (const part of content.parts) {
      if ('text' in part && typeof part.text === 'string') {
        parts.push(`${role}\n${part.text}`);
      }
    }
  }

  return parts.join('\n\n---\n\n');
}

/**
 * Build simple prompt string from ADK Content array (text only)
 * Used for single-turn conversations
 */
export function buildSimplePrompt(contents: Content[]): string {
  const parts: string[] = [];

  for (const content of contents) {
    if (!content.parts) continue;

    for (const part of content.parts) {
      if ('text' in part && typeof part.text === 'string') {
        parts.push(part.text);
      }
    }
  }

  return parts.join('\n\n---\n\n');
}

// ============================================================================
// OUTPUT UTILITIES
// ============================================================================

/**
 * Truncate output if it exceeds max size
 */
export function truncateOutput(
  output: string,
  maxSize: number = MAX_OUTPUT_SIZE,
): {
  output: string;
  truncated: boolean;
} {
  if (output.length <= maxSize) {
    return { output, truncated: false };
  }
  return {
    output: `${output.slice(0, maxSize)}\n\n[OUTPUT TRUNCATED]`,
    truncated: true,
  };
}
