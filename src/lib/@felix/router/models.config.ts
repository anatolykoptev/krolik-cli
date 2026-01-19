/**
 * @module lib/@felix/router/models.config
 * @description Dynamic Model Configuration
 *
 * Declarative model definitions - add new models here without code changes.
 * Models are registered at runtime from this config.
 */

import type { ModelTier } from './types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Provider type - extensible for new providers
 */
export type ProviderType =
  | 'anthropic'
  | 'google'
  | 'groq'
  | 'openai'
  | 'ollama'
  | 'mistral'
  | 'vibeproxy';

/**
 * Backend type for model
 */
export type BackendSupport = 'cli' | 'api' | 'both';

/**
 * Model definition - all info needed to use a model
 */
export interface ModelDefinition {
  /** Unique model identifier (used as key) */
  id: string;
  /** Display name */
  displayName: string;
  /** Provider (anthropic, google, groq, etc.) */
  provider: ProviderType;
  /** Tier (free, cheap, mid, premium) */
  tier: ModelTier;
  /** Input cost per 1M tokens (0 for free) */
  inputCostPer1M: number;
  /** Output cost per 1M tokens (0 for free) */
  outputCostPer1M: number;
  /** Supported backends */
  backend: BackendSupport;
  /** Aliases for this model */
  aliases: string[];
  /** Full API model name (if different from id) */
  apiModelName?: string;
  /** CLI model flag value (if different from id) */
  cliModelName?: string;
  /** Max context window tokens */
  contextWindow?: number;
  /** Max output tokens */
  maxOutputTokens?: number;
  /** Whether model is enabled */
  enabled: boolean;
  /** Description */
  description?: string;
}

/**
 * Provider definition - how to use a provider
 */
export interface ProviderDefinition {
  /** Provider identifier */
  id: ProviderType;
  /** Display name */
  displayName: string;
  /** CLI executable name (if has CLI) */
  cliExecutable?: string;
  /** API base URL */
  apiBaseUrl?: string;
  /** Environment variable for API key */
  apiKeyEnvVar?: string;
  /** Model name detection pattern */
  detectPattern: RegExp;
}

// ============================================================================
// PROVIDER DEFINITIONS
// ============================================================================

export const PROVIDER_DEFINITIONS: ProviderDefinition[] = [
  {
    id: 'anthropic',
    displayName: 'Anthropic',
    cliExecutable: 'claude',
    apiKeyEnvVar: 'ANTHROPIC_API_KEY',
    detectPattern: /^claude-/i,
  },
  {
    id: 'google',
    displayName: 'Google',
    cliExecutable: 'gemini',
    apiKeyEnvVar: 'GOOGLE_API_KEY',
    detectPattern: /^gemini-/i,
  },
  {
    id: 'groq',
    displayName: 'Groq',
    apiBaseUrl: 'https://api.groq.com/openai/v1',
    apiKeyEnvVar: 'GROQ_API_KEY',
    detectPattern: /^llama-|^mixtral-|^deepseek-/i,
  },
  {
    id: 'openai',
    displayName: 'OpenAI',
    apiBaseUrl: 'https://api.openai.com/v1',
    apiKeyEnvVar: 'OPENAI_API_KEY',
    detectPattern: /^gpt-|^o1-|^o3-/i,
  },
  {
    id: 'mistral',
    displayName: 'Mistral',
    apiBaseUrl: 'https://api.mistral.ai/v1',
    apiKeyEnvVar: 'MISTRAL_API_KEY',
    detectPattern: /^mistral-|^codestral-/i,
  },
  {
    id: 'ollama',
    displayName: 'Ollama',
    cliExecutable: 'ollama',
    apiBaseUrl: 'http://localhost:11434/api',
    detectPattern: /^ollama:/i,
  },
  {
    id: 'vibeproxy',
    displayName: 'VibeProxy',
    apiBaseUrl: 'http://localhost:8318/v1',
    apiKeyEnvVar: 'VIBEPROXY_API_KEY',
    detectPattern: /^gemini-claude-|^vibe-|^antigravity-/i,
  },
];

// ============================================================================
// MODEL DEFINITIONS
// ============================================================================

export const MODEL_DEFINITIONS: ModelDefinition[] = [
  // -------------------------------------------------------------------------
  // FREE TIER - VibeProxy (Antigravity - free via Google account)
  // -------------------------------------------------------------------------
  {
    id: 'vibe-opus',
    displayName: 'Claude Opus 4.5 (Antigravity)',
    provider: 'vibeproxy',
    tier: 'free',
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    backend: 'api',
    aliases: ['antigravity-opus'],
    apiModelName: 'gemini-claude-opus-4-5-thinking',
    contextWindow: 200000,
    maxOutputTokens: 64000,
    enabled: true,
    description: 'Claude Opus 4.5 via Antigravity (free with Google account)',
  },
  {
    id: 'vibe-sonnet',
    displayName: 'Claude Sonnet 4.5 (Antigravity)',
    provider: 'vibeproxy',
    tier: 'free',
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    backend: 'api',
    aliases: ['antigravity-sonnet'],
    apiModelName: 'gemini-claude-sonnet-4-5-thinking',
    contextWindow: 200000,
    maxOutputTokens: 64000,
    enabled: true,
    description: 'Claude Sonnet 4.5 via Antigravity (free with Google account)',
  },
  {
    id: 'vibe-sonnet-fast',
    displayName: 'Claude Sonnet 4.5 Fast (Antigravity)',
    provider: 'vibeproxy',
    tier: 'free',
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    backend: 'api',
    aliases: ['antigravity-sonnet-fast'],
    apiModelName: 'gemini-claude-sonnet-4-5',
    contextWindow: 200000,
    maxOutputTokens: 64000,
    enabled: true,
    description: 'Claude Sonnet 4.5 without thinking mode (faster)',
  },
  {
    id: 'gemini-3-pro',
    displayName: 'Gemini 3 Pro (Antigravity)',
    provider: 'vibeproxy',
    tier: 'free',
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    backend: 'api',
    aliases: ['antigravity-gemini'],
    apiModelName: 'gemini-3-pro-image-preview',
    contextWindow: 1000000,
    maxOutputTokens: 8192,
    enabled: true,
    description: 'Gemini 3 Pro with image support via Antigravity',
  },

  // -------------------------------------------------------------------------
  // FREE TIER - Groq (rate limited but free)
  // -------------------------------------------------------------------------
  {
    id: 'llama-70b',
    displayName: 'Llama 3.3 70B',
    provider: 'groq',
    tier: 'free',
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    backend: 'api',
    aliases: ['llama', 'llama3'],
    apiModelName: 'llama-3.3-70b-versatile',
    contextWindow: 128000,
    maxOutputTokens: 32768,
    enabled: true,
    description: 'Fast, free Llama 3.3 70B via Groq',
  },
  {
    id: 'llama-8b',
    displayName: 'Llama 3.1 8B',
    provider: 'groq',
    tier: 'free',
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    backend: 'api',
    aliases: ['llama-small'],
    apiModelName: 'llama-3.1-8b-instant',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    enabled: true,
    description: 'Ultra-fast Llama 3.1 8B via Groq',
  },
  {
    id: 'mixtral',
    displayName: 'Mixtral 8x7B',
    provider: 'groq',
    tier: 'free',
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    backend: 'api',
    aliases: ['mixtral-8x7b'],
    apiModelName: 'mixtral-8x7b-32768',
    contextWindow: 32768,
    maxOutputTokens: 32768,
    enabled: true,
    description: 'Mixtral MoE via Groq',
  },
  {
    id: 'deepseek-r1',
    displayName: 'DeepSeek R1',
    provider: 'groq',
    tier: 'free',
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    backend: 'api',
    aliases: ['deepseek'],
    apiModelName: 'deepseek-r1-distill-llama-70b',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    enabled: true,
    description: 'DeepSeek R1 reasoning model via Groq',
  },

  // -------------------------------------------------------------------------
  // CHEAP TIER - Low cost models (flash is default - cheapest with CLI support)
  // -------------------------------------------------------------------------
  {
    id: 'flash',
    displayName: 'Gemini 2.0 Flash',
    provider: 'google',
    tier: 'cheap',
    inputCostPer1M: 0.075,
    outputCostPer1M: 0.3,
    backend: 'both',
    aliases: ['gemini-flash'],
    apiModelName: 'gemini-2.0-flash',
    contextWindow: 1000000,
    maxOutputTokens: 8192,
    enabled: true,
    description: 'Ultra-fast Gemini model',
  },
  {
    id: 'haiku',
    displayName: 'Claude 3.5 Haiku',
    provider: 'anthropic',
    tier: 'cheap',
    inputCostPer1M: 0.25,
    outputCostPer1M: 1.25,
    backend: 'both',
    aliases: ['claude-haiku'],
    apiModelName: 'claude-3-5-haiku-latest',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    enabled: true,
    description: 'Fast, affordable Claude model',
  },
  {
    id: 'gpt-4o-mini',
    displayName: 'GPT-4o Mini',
    provider: 'openai',
    tier: 'cheap',
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.6,
    backend: 'api',
    aliases: ['4o-mini'],
    apiModelName: 'gpt-4o-mini',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    enabled: true,
    description: 'Affordable GPT-4o variant',
  },

  // -------------------------------------------------------------------------
  // MID TIER - Balanced performance/cost (pro is default - cheapest with CLI support)
  // -------------------------------------------------------------------------
  {
    id: 'pro',
    displayName: 'Gemini 2.0 Pro',
    provider: 'google',
    tier: 'mid',
    inputCostPer1M: 1.25,
    outputCostPer1M: 5.0,
    backend: 'both',
    aliases: ['gemini-pro'],
    apiModelName: 'gemini-2.0-pro',
    contextWindow: 2000000,
    maxOutputTokens: 8192,
    enabled: true,
    description: 'Powerful Gemini model',
  },
  {
    id: 'sonnet',
    displayName: 'Claude 4 Sonnet',
    provider: 'anthropic',
    tier: 'mid',
    inputCostPer1M: 3.0,
    outputCostPer1M: 15.0,
    backend: 'both',
    aliases: ['claude-sonnet'],
    apiModelName: 'claude-sonnet-4-20250514',
    contextWindow: 200000,
    maxOutputTokens: 64000,
    enabled: true,
    description: 'Balanced Claude model for most tasks',
  },
  {
    id: 'gpt-4o',
    displayName: 'GPT-4o',
    provider: 'openai',
    tier: 'mid',
    inputCostPer1M: 2.5,
    outputCostPer1M: 10.0,
    backend: 'api',
    aliases: ['4o'],
    apiModelName: 'gpt-4o',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    enabled: true,
    description: 'OpenAI flagship multimodal model',
  },

  // -------------------------------------------------------------------------
  // PREMIUM TIER - Highest capability
  // -------------------------------------------------------------------------
  {
    id: 'opus',
    displayName: 'Claude 4.5 Opus',
    provider: 'anthropic',
    tier: 'premium',
    inputCostPer1M: 15.0,
    outputCostPer1M: 75.0,
    backend: 'both',
    aliases: ['claude-opus'],
    apiModelName: 'claude-opus-4-5-20251101',
    contextWindow: 200000,
    maxOutputTokens: 64000,
    enabled: true,
    description: 'Most capable Claude model',
  },
  {
    id: 'o1',
    displayName: 'OpenAI o1',
    provider: 'openai',
    tier: 'premium',
    inputCostPer1M: 15.0,
    outputCostPer1M: 60.0,
    backend: 'api',
    aliases: ['o1-preview'],
    apiModelName: 'o1',
    contextWindow: 200000,
    maxOutputTokens: 100000,
    enabled: true,
    description: 'OpenAI reasoning model',
  },
  {
    id: 'thinking',
    displayName: 'Gemini 2.0 Thinking',
    provider: 'google',
    tier: 'premium',
    inputCostPer1M: 10.0,
    outputCostPer1M: 40.0,
    backend: 'both',
    aliases: ['gemini-thinking'],
    apiModelName: 'gemini-2.0-flash-thinking-exp',
    contextWindow: 1000000,
    maxOutputTokens: 64000,
    enabled: true,
    description: 'Gemini with extended thinking',
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get all enabled models
 */
export function getEnabledModels(): ModelDefinition[] {
  return MODEL_DEFINITIONS.filter((m) => m.enabled);
}

/**
 * Get models by tier
 */
export function getModelsByTier(tier: ModelTier): ModelDefinition[] {
  return getEnabledModels().filter((m) => m.tier === tier);
}

/**
 * Get models by provider
 */
export function getModelsByProvider(provider: ProviderType): ModelDefinition[] {
  return getEnabledModels().filter((m) => m.provider === provider);
}

/**
 * Find model by id or alias
 */
export function findModelByIdOrAlias(idOrAlias: string): ModelDefinition | undefined {
  const lower = idOrAlias.toLowerCase();
  return getEnabledModels().find(
    (m) => m.id.toLowerCase() === lower || m.aliases.some((a) => a.toLowerCase() === lower),
  );
}

/**
 * Get default model for tier
 * Returns the FIRST enabled model for this tier in MODEL_DEFINITIONS
 * (order in config determines priority)
 */
export function getDefaultModelForTier(tier: ModelTier): ModelDefinition | undefined {
  return MODEL_DEFINITIONS.find((m) => m.enabled && m.tier === tier);
}

/**
 * Get provider definition
 */
export function getProviderDefinition(provider: ProviderType): ProviderDefinition | undefined {
  return PROVIDER_DEFINITIONS.find((p) => p.id === provider);
}

/**
 * Detect provider from model name
 */
export function detectProviderFromModelName(modelName: string): ProviderType | undefined {
  for (const provider of PROVIDER_DEFINITIONS) {
    if (provider.detectPattern.test(modelName)) {
      return provider.id;
    }
  }
  // Also check if it's a known model id or alias
  const model = findModelByIdOrAlias(modelName);
  return model?.provider;
}

/**
 * Get all tier names
 */
export function getAllTiers(): ModelTier[] {
  return ['free', 'cheap', 'mid', 'premium'];
}

/**
 * Get all model IDs
 */
export function getAllModelIds(): string[] {
  return getEnabledModels().map((m) => m.id);
}
