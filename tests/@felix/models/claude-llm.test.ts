/**
 * Tests for ClaudeLlm implementation
 */

import { BaseLlm } from '@google/adk';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  ClaudeCliLlm,
  ClaudeLlm,
  createApiLlm,
  createClaudeLlm,
  createCliLlm,
  createLlm,
  getLlmFactory,
  isValidModelAlias,
  resetLlmFactory,
} from '@/lib/@felix/models';

describe('ClaudeLlm', () => {
  it('should extend BaseLlm', () => {
    const llm = new ClaudeLlm({ model: 'claude-sonnet-4-20250514' });
    expect(llm).toBeInstanceOf(BaseLlm);
    expect(llm.model).toBe('claude-sonnet-4-20250514');
  });

  it('should support Claude model patterns', () => {
    expect(ClaudeLlm.supportedModels).toHaveLength(1);
    expect(ClaudeLlm.supportedModels[0]).toBeInstanceOf(RegExp);

    const regex = ClaudeLlm.supportedModels[0] as RegExp;
    expect(regex.test('claude-sonnet-4-20250514')).toBe(true);
    expect(regex.test('claude-opus-4-20250514')).toBe(true);
    expect(regex.test('claude-3-5-haiku-20241022')).toBe(true);
    expect(regex.test('gemini-2.0-flash')).toBe(false);
  });
});

describe('createClaudeLlm', () => {
  it('should create ClaudeLlm with default model', () => {
    const llm = createClaudeLlm();
    expect(llm).toBeInstanceOf(ClaudeLlm);
    expect(llm.model).toBe('claude-sonnet-4-20250514');
  });

  it('should create ClaudeLlm with custom model', () => {
    const llm = createClaudeLlm('claude-opus-4-20250514');
    expect(llm.model).toBe('claude-opus-4-20250514');
  });
});

describe('LlmFactory', () => {
  beforeEach(() => {
    resetLlmFactory();
  });

  it('should be a singleton', () => {
    const factory1 = getLlmFactory();
    const factory2 = getLlmFactory();
    expect(factory1).toBe(factory2);
  });

  it('should validate model aliases (pass-through)', () => {
    // Known aliases
    expect(isValidModelAlias('sonnet')).toBe(true);
    expect(isValidModelAlias('opus')).toBe(true);
    expect(isValidModelAlias('haiku')).toBe(true);
    expect(isValidModelAlias('flash')).toBe(true);
    expect(isValidModelAlias('pro')).toBe(true);
    // Unknown models are passed through to CLI for validation
    expect(isValidModelAlias('unknown-model')).toBe(true);
  });

  it('should support both anthropic and google providers', () => {
    // Anthropic aliases
    expect(isValidModelAlias('sonnet')).toBe(true);
    expect(isValidModelAlias('opus')).toBe(true);
    expect(isValidModelAlias('haiku')).toBe(true);

    // Google aliases
    expect(isValidModelAlias('flash')).toBe(true);
    expect(isValidModelAlias('pro')).toBe(true);
  });
});

describe('createLlm', () => {
  beforeEach(() => {
    resetLlmFactory();
  });

  it('should return ClaudeCliLlm by default (CLI backend)', () => {
    const llm = createLlm('sonnet');
    expect(llm).toBeInstanceOf(ClaudeCliLlm);
  });

  it('should return ClaudeLlm when using API backend', () => {
    const llm = createApiLlm('sonnet');
    expect(llm).toBeInstanceOf(ClaudeLlm);
  });

  it('should return ClaudeCliLlm when using CLI backend', () => {
    const llm = createCliLlm('sonnet');
    expect(llm).toBeInstanceOf(ClaudeCliLlm);
  });

  it('should cache LLM instances per backend', () => {
    const llm1 = createLlm('sonnet');
    const llm2 = createLlm('sonnet');
    expect(llm1).toBe(llm2);

    // Different backend should create different instance
    const llmApi = createApiLlm('sonnet');
    expect(llmApi).not.toBe(llm1);
    expect(llmApi).toBeInstanceOf(ClaudeLlm);
  });
});
