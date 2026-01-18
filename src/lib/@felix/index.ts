/**
 * Ralph Loop Library
 *
 * Autonomous agent loop for executing PRD tasks.
 *
 * Architecture (ADK-based):
 * - ADK agents: LlmAgent, SequentialAgent, ParallelAgent, LoopAgent
 * - Multi-LLM support: Claude (Anthropic) + Gemini (Google)
 * - Plugin system: Validation, Retry, Cost, Context, Quality Gate
 * - PRD.json validation via Zod schemas
 * - Progress/Attempts/Guardrails stored in SQLite (@storage/ralph)
 *
 * @module @ralph
 */

// ============================================================================
// ADK-based Multi-Agent Framework
// ============================================================================

// Re-export ADK core classes
export {
  BaseAgent,
  BaseLlm,
  BasePlugin,
  BaseTool,
  BaseToolset,
  createSession,
  type Event,
  FunctionTool,
  Gemini,
  InMemoryRunner,
  InMemorySessionService,
  LlmAgent,
  type LlmRequest,
  type LlmResponse,
  LoopAgent,
  ParallelAgent,
  type RunConfig,
  Runner,
  SequentialAgent,
  type Session,
} from '@google/adk';

// Export Ralph LLM implementations
export {
  type BackendType as LlmBackendType,
  // CLI-based LLMs
  ClaudeCliLlm,
  type ClaudeCliLlmParams,
  // API-based LLMs
  ClaudeLlm,
  type ClaudeLlmParams,
  createClaudeCliLlm,
  createClaudeLlm,
  createGeminiCliLlm,
  type FallbackConfig,
  FallbackRouter,
  GeminiCliLlm,
  type GeminiCliLlmParams,
  getApiLlm,
  getCliLlm,
  getHealthMonitor,
  getLlm,
  getModelRegistry,
  // Health & Fallback
  HealthMonitor,
  LruCache,
  // Model Registry
  ModelRegistry,
  type RegistryConfig,
  resetModelRegistry,
} from './models/index.js';
// Export Ralph orchestrator
export {
  createOrchestrator,
  FelixOrchestrator,
  type FelixOrchestratorConfig,
  type OrchestratorResult,
} from './orchestrator/index.js';

// Export Ralph plugins
export {
  CostPlugin,
  type CostPluginConfig,
  type CostTracking,
  createCostPlugin,
  createRetryPlugin,
  createValidationPlugin,
  type ErrorCategory,
  RetryPlugin,
  type RetryPluginConfig,
  type StepResult as PluginStepResult,
  type TokenUsage as PluginTokenUsage,
  ValidationPlugin,
  type ValidationPluginConfig,
  type ValidationResult as PluginValidationResult,
  type ValidationStep as PluginValidationStep,
} from './plugins/index.js';
// Export Ralph session services
export {
  createSQLiteSessionService,
  type SessionService,
  SQLiteSessionService,
} from './services/index.js';

// ============================================================================
// Core Ralph Components
// ============================================================================

// Context Injection (exports from ./context module)
export {
  formatInjectedContext,
  type InjectContextOptions,
  type InjectedContext,
  injectContext,
} from './context/injector.js';
// Executor types and functions
export type {
  QualityGateConfig,
  QualityGateIssue,
  QualityGateResult,
  QualityGateSummary,
} from './executor/quality-gate.js';
export { runQualityGate } from './executor/quality-gate.js';
// Schemas (PRD.json validation)
export * from './schemas';
// Test runner
export * from './test-runner';
// Types
export * from './types';

// ============================================================================
// Model Router (adaptive model selection)
// ============================================================================

export {
  // Model Tiers (single source of truth)
  ALL_MODELS,
  // History
  analyzeHistory,
  // Cascade
  type CascadeConfig,
  // Cost estimation
  type CostEstimate,
  // Router
  calculateTaskScore,
  canModelEscalate,
  classifyError,
  compareTiers,
  createTaskSignature,
  DEFAULT_CASCADE_CONFIG,
  DEFAULT_ESCALATION_PROBABILITY,
  DEFAULT_MODELS,
  type ExecutionResult,
  estimateCost,
  estimateTaskCost,
  estimateTotalCost,
  executeWithCascade,
  formatCostEstimate,
  formatCostEstimateXml,
  formatRoutingDecision,
  formatRoutingDecisionsXml,
  getCheapestModel,
  getCheapestModelInTier,
  getDefaultEscalationProbability,
  getDefaultModel,
  getEscalationPath,
  getModelInfo,
  getModelProvider,
  getModelsForProvider,
  getModelsInTier,
  getModelTier,
  getNextTierUp,
  getPremiumModel,
  getPreviousTier,
  getRoutingPlanSummary,
  getRoutingStats,
  getTierEscalationPaths,
  isTierHigher,
  isTierLower,
  MODEL_INFO,
  type ModelInfo,
  type ModelName,
  type ModelPreference,
  type ModelTier,
  type RoutingDecision,
  routeTask,
  routeTasks,
  scoreToTier,
  type TaskAttributes,
  type TaskComplexity,
  type TaskCostEstimate,
  TIER_HIERARCHY,
  TIER_THRESHOLDS,
} from './router/index.js';
