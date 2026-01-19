/**
 * @ralph - ADK-based multi-agent orchestration for Krolik Felix
 */

import type { Content, Part } from '@google/genai';

// Model types
export type ModelProvider = 'anthropic' | 'google';

export interface ModelConfig {
  provider: ModelProvider;
  model: string;
  apiKey?: string;
  maxTokens?: number;
  temperature?: number;
}

// Re-export ADK types for convenience
export type { Content, Part };

// LLM Response types
export interface LlmMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | Part[];
}

// Task execution types
export interface TaskConfig {
  id: string;
  title: string;
  prompt: string;
  model?: string;
  maxAttempts?: number;
  timeout?: number;
  dependencies?: string[];
}

export interface TaskResult {
  taskId: string;
  status: 'success' | 'failed' | 'skipped';
  output?: string;
  error?: string;
  duration: number;
  attempts: number;
  tokenUsage?: {
    input: number;
    output: number;
  };
}

// PRD types
export interface PRDConfig {
  name: string;
  description?: string;
  tasks: TaskConfig[];
  defaultModel?: string;
  continueOnFailure?: boolean;
}

// Session types
export interface FelixSession {
  id: string;
  projectPath: string;
  prdPath: string;
  status: 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  currentTaskIndex: number;
  results: TaskResult[];
  startedAt: Date;
  completedAt?: Date;
}
