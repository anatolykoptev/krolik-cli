/**
 * Tests for ClaudeLlm implementation
 */

import { BaseLlm } from '@google/adk';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  ClaudeCliLlm,
  ClaudeLlm,
  createClaudeLlm,
  getApiLlm,
  getCliLlm,
  getLlm,
  getModelRegistry,
  resetModelRegistry,
} from '@/lib/@felix';

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

describe('ModelRegistry', () => {
  it('should be a singleton', () => {
    const registry1 = getModelRegistry();
    const registry2 = getModelRegistry();
    expect(registry1).toBe(registry2);
  });

  it('should resolve model aliases via getLlm', () => {
    const registry = getModelRegistry();

    // Pass-through API: getLlm accepts aliases
    const sonnetLlm = registry.getLlm('sonnet', 'api');
    expect(sonnetLlm).toBeInstanceOf(ClaudeLlm);

    const opusLlm = registry.getLlm('opus', 'api');
    expect(opusLlm).toBeInstanceOf(ClaudeLlm);

    // Gemini alias
    expect(registry.isSupported('flash')).toBe(true);
    expect(registry.isSupported('gemini-2.0-flash')).toBe(true);
  });

  it('should check if model is supported', () => {
    const registry = getModelRegistry();

    expect(registry.isSupported('sonnet')).toBe(true);
    expect(registry.isSupported('claude-sonnet-4-20250514')).toBe(true);
    expect(registry.isSupported('gemini-2.0-flash')).toBe(true);
    expect(registry.isSupported('unknown-model')).toBe(false);
  });

  it('should support both anthropic and google providers', () => {
    const registry = getModelRegistry();

    // Pass-through API validates providers via isSupported
    expect(registry.isSupported('sonnet')).toBe(true); // anthropic
    expect(registry.isSupported('opus')).toBe(true); // anthropic
    expect(registry.isSupported('haiku')).toBe(true); // anthropic
    expect(registry.isSupported('flash')).toBe(true); // google
    expect(registry.isSupported('pro')).toBe(true); // google
    expect(registry.isSupported('claude-sonnet-4-20250514')).toBe(true); // full model name
    expect(registry.isSupported('gemini-2.0-flash')).toBe(true); // full model name
  });
});

describe('getLlm', () => {
  beforeEach(() => {
    resetModelRegistry();
  });

  it('should return ClaudeCliLlm by default (CLI backend)', () => {
    const llm = getLlm('sonnet');
    expect(llm).toBeInstanceOf(ClaudeCliLlm);
  });

  it('should return ClaudeLlm when using API backend', () => {
    const llm = getApiLlm('sonnet');
    expect(llm).toBeInstanceOf(ClaudeLlm);
  });

  it('should return ClaudeCliLlm when using CLI backend', () => {
    const llm = getCliLlm('sonnet');
    expect(llm).toBeInstanceOf(ClaudeCliLlm);
  });

  it('should cache LLM instances per backend', () => {
    const llm1 = getLlm('sonnet');
    const llm2 = getLlm('sonnet');
    expect(llm1).toBe(llm2);

    // Different backend should create different instance
    const llmApi = getApiLlm('sonnet');
    expect(llmApi).not.toBe(llm1);
    expect(llmApi).toBeInstanceOf(ClaudeLlm);
  });
});
