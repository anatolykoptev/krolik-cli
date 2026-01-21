/**
 * @felix/models - LLM implementations and registry
 *
 * Pass-through approach: model names are passed directly to CLI.
 * No hardcoded model lists - CLI validates model availability.
 *
 * ## Architecture
 *
 * ```
 * model-config.ts     - Provider detection (no model lists)
 * cli-shared.ts       - Common types and utilities
 * timeout-config.ts   - Timeout configuration by complexity
 * llm-factory.ts      - Unified LLM creation (single entry point)
 * base-cli-llm.ts     - Abstract base class for CLI LLMs
 * ├── claude-cli-llm.ts  - Claude CLI implementation
 * └── gemini-cli-llm.ts  - Gemini CLI implementation
 * claude-llm.ts       - Claude API implementation
 * registry.ts         - Model registry (wraps factory + discovery)
 * fallback-router.ts  - Automatic fallback routing
 * ```
 */

// Base CLI LLM
export { BaseCliLlm, type CliExecutionConfig, type ProviderConfig } from './base-cli-llm.js';
// CLI-based LLMs (use local CLI)
export { ClaudeCliLlm, type ClaudeCliLlmParams, createClaudeCliLlm } from './claude-cli-llm.js';
// API-based LLMs (require API keys)
export { ClaudeLlm, type ClaudeLlmParams, createClaudeLlm } from './claude-llm.js';
// Shared utilities
export {
  ALLOWED_ENV_VARS,
  type BaseCliLlmParams,
  buildPromptWithRoles,
  buildSafeEnv,
  buildSimplePrompt,
  type CliResult,
  createErrorResponse,
  createSuccessResponse,
  MAX_OUTPUT_SIZE,
  truncateOutput,
  validateWorkingDirectory,
} from './cli-shared.js';
// Fallback Router (automatic provider fallback)
export {
  type FallbackConfig,
  FallbackRouter,
} from './fallback-router.js';
export { createGeminiCliLlm, GeminiCliLlm, type GeminiCliLlmParams } from './gemini-cli-llm.js';
// Groq API LLM (free tier via Groq API)
export { createGroqLlm, GroqLlm, type GroqLlmParams } from './groq-llm.js';
// Health Monitor (provider health tracking)
export {
  getHealthMonitor,
  type HealthConfig,
  HealthMonitor,
  type ProviderHealth,
  resetHealthMonitor,
} from './health-monitor.js';
// LLM Factory (unified LLM creation - single entry point)
// BackendType re-export (for compatibility)
export {
  type BackendType,
  createApiLlm,
  createCliLlm,
  createLlm,
  getLlmFactory,
  type LlmCreateOptions,
  type LlmCreateResult,
  LlmFactory,
  type LlmFactoryConfig,
  resetLlmFactory,
} from './llm-factory.js';
// LRU Cache (LLM instance caching)
export {
  LruCache,
  type LruCacheOptions,
} from './lru-cache.js';
// Model Configuration (provider detection only, no model lists)
export {
  checkCliAvailability,
  detectProvider,
  discoverProviders,
  getCliExecutable,
  getCliModelName,
  getProviderDef,
  isValidModelAlias,
  type ModelProvider,
  PROVIDERS,
  type ProviderDefinition,
} from './model-config.js';
// Provider Registry (dynamic LLM registration)
export {
  getLlmClass,
  type LlmConstructor,
  type ProviderMetadata,
  ProviderRegistry,
  providerRegistry,
  registerProvider,
} from './provider-registry.js';
// Timeout configuration
export {
  DEFAULT_TIMEOUT_MS,
  formatTimeout,
  getTimeoutForComplexity,
  TIMEOUT_BY_COMPLEXITY,
} from './timeout-config.js';
// VibeProxy Model Discovery (dynamic model fetching)
export {
  createVibeProxyDiscovery,
  getVibeProxyDiscovery,
  getVibeProxyModels,
  isVibeProxyAvailable,
  isVibeProxyCacheWarmed,
  MODEL_OWNERS,
  preloadVibeProxyModels,
  resetVibeProxyDiscovery,
  resolveVibeProxyAlias,
  resolveVibeProxyAliasSync,
  VibeProxyDiscovery,
  type VibeProxyModel,
} from './vibeproxy-discovery.js';
// VibeProxy API LLM (Antigravity + multi-provider via VibeProxy)
export {
  createVibeProxyLlm,
  createVibeProxyLlmAsync,
  resolveVibeProxyModel,
  VibeProxyLlm,
  type VibeProxyLlmParams,
} from './vibeproxy-llm.js';
