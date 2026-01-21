/**
 * Plugin Factory - Create and configure ADK plugins
 *
 * @module @felix/orchestrator/plugin-factory
 */

import type { BasePlugin } from '@google/adk';
import { RETRY_BASE_DELAY_MS, RETRY_MAX_DELAY_MS } from '../constants.js';
import { ActionPlugin } from '../plugins/action-plugin.js';
import {
  CircuitBreakerPlugin,
  type CircuitBreakerPluginConfig,
} from '../plugins/circuit-breaker-plugin.js';
import { ContextPlugin } from '../plugins/context-plugin.js';
import { CostPlugin, type CostTracking } from '../plugins/cost-plugin.js';
import { GitPlugin } from '../plugins/git-plugin.js';
import { MemoryPlugin } from '../plugins/memory-plugin.js';
import { QualityGatePlugin } from '../plugins/quality-gate-plugin.js';
import { RateLimitPlugin } from '../plugins/rate-limit-plugin.js';
import { RetryPlugin } from '../plugins/retry-plugin.js';
import { ValidationPlugin } from '../plugins/validation-plugin.js';
import type { FelixLoopEvent } from '../types.js';
import type { ResolvedConfig } from './types.js';

export interface PluginFactoryDeps {
  config: ResolvedConfig;
  emit: (event: FelixLoopEvent) => void;
  now: () => string;
}

export interface CorePlugins {
  costPlugin: CostPlugin;
  retryPlugin: RetryPlugin;
  validationPlugin: ValidationPlugin;
}

/**
 * Create cost tracking plugin
 */
export function createCostPlugin(deps: PluginFactoryDeps): CostPlugin {
  const { config, emit, now } = deps;
  return new CostPlugin({
    maxCostUsd: config.maxCostUsd,
    onUpdate: config.onCostUpdate,
    onBudgetExceeded: (tracking: CostTracking) => {
      emit({
        type: 'loop_failed',
        timestamp: now(),
        error: `Budget exceeded: $${tracking.costUsd.toFixed(4)}`,
      });
    },
  });
}

/**
 * Create retry plugin
 */
export function createRetryPlugin(config: ResolvedConfig): RetryPlugin {
  return new RetryPlugin({
    maxAttempts: config.maxAttempts,
    baseDelayMs: RETRY_BASE_DELAY_MS,
    maxDelayMs: RETRY_MAX_DELAY_MS,
  });
}

/**
 * Create validation plugin
 */
export function createValidationPlugin(config: ResolvedConfig): ValidationPlugin {
  return new ValidationPlugin({
    projectRoot: config.projectRoot,
    steps: config.validationSteps,
    failFast: true,
  });
}

/**
 * Build complete plugin list from config
 */
export function buildPluginList(corePlugins: CorePlugins, deps: PluginFactoryDeps): BasePlugin[] {
  const { config, emit, now } = deps;
  const { costPlugin, validationPlugin, retryPlugin } = corePlugins;

  const allPlugins: unknown[] = [costPlugin, validationPlugin, retryPlugin];

  if (config.enableContext) {
    allPlugins.push(new ContextPlugin({ projectRoot: config.projectRoot }));
  }

  if (config.qualityGateMode) {
    allPlugins.push(
      new QualityGatePlugin({
        projectRoot: config.projectRoot,
        mode: config.qualityGateMode,
      }),
    );
  }

  if (config.enableGitAutoCommit) {
    allPlugins.push(
      new GitPlugin({
        projectRoot: config.projectRoot,
        autoCommit: true,
      }),
    );
  }

  // Always enable ActionPlugin (Felix Actions)
  allPlugins.push(
    new ActionPlugin({
      projectRoot: config.projectRoot,
    }),
  );

  if (config.enableMemory) {
    allPlugins.push(new MemoryPlugin({ projectRoot: config.projectRoot }));
  }

  if (config.rateLimit) {
    allPlugins.push(new RateLimitPlugin(config.rateLimit));
  }

  if (config.circuitBreaker) {
    const circuitBreakerConfig: CircuitBreakerPluginConfig = {
      ...config.circuitBreaker,
      onTrip: (state, failures) => {
        emit({
          type: 'circuit_breaker_tripped',
          timestamp: now(),
          state,
          failures,
        } as FelixLoopEvent);
        config.onCircuitBreakerTrip?.(state, failures);
      },
    };
    allPlugins.push(new CircuitBreakerPlugin(circuitBreakerConfig));
  }

  return [...(allPlugins as BasePlugin[]), ...config.plugins];
}
