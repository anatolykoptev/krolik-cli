/**
 * @ralph/models - LLM implementations and registry
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
 * base-cli-llm.ts     - Abstract base class for CLI LLMs
 * ├── claude-cli-llm.ts  - Claude CLI implementation
 * └── gemini-cli-llm.ts  - Gemini CLI implementation
 * claude-llm.ts       - Claude API implementation
 * registry.ts         - Model registry (unified access)
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
// Health Monitor (provider health tracking)
export {
  getHealthMonitor,
  type HealthConfig,
  HealthMonitor,
  type ProviderHealth,
  resetHealthMonitor,
} from './health-monitor.js';
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
// Model Registry (unified access to all LLMs)
export {
  type BackendType,
  getApiLlm,
  getCliLlm,
  getLlm,
  getModelRegistry,
  ModelRegistry,
  type RegistryConfig,
  resetModelRegistry,
} from './registry.js';
// Timeout configuration
export {
  DEFAULT_TIMEOUT_MS,
  formatTimeout,
  getTimeoutForComplexity,
  TIMEOUT_BY_COMPLEXITY,
} from './timeout-config.js';
