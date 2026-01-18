/**
 * Config Resolver - Resolve and validate orchestrator configuration
 *
 * @module @ralph/orchestrator/config-resolver
 */

import { join } from 'node:path';
import type { RalphOrchestratorConfig, ResolvedConfig } from './types.js';

/**
 * Default configuration values
 *
 * Note: dbPath and checkpointDbPath are removed - all data is now stored
 * in the central krolik.db at {projectRoot}/.krolik/memory/krolik.db
 */
const DEFAULT_CONFIG: Omit<ResolvedConfig, 'projectRoot'> = {
  prdPath: 'PRD.json',
  model: 'sonnet',
  backend: 'cli',
  maxAttempts: 3,
  maxCostUsd: 10,
  validationSteps: [], // Disabled by default for CLI backend (no real code changes)
  continueOnFailure: false,
  onEvent: () => {},
  onCostUpdate: () => {},
  plugins: [],
  enableContext: true,
  enableGitAutoCommit: false,
  // Note: qualityGateMode omitted = disabled by default (expensive analysis)
  enableMemory: true,
  dryRun: false,
  verbose: false,
  enableParallelExecution: false,
  maxParallelTasks: 3,
  enableCheckpoints: true,
  useMultiAgentMode: false,
};

/**
 * Resolve config with defaults
 */
export function resolveConfig(config: RalphOrchestratorConfig): ResolvedConfig {
  return {
    ...DEFAULT_CONFIG,
    ...config,
  };
}

/**
 * Resolve PRD file path (relative or absolute)
 */
export function resolvePrdPath(config: ResolvedConfig): string {
  const { prdPath, projectRoot } = config;
  if (prdPath.startsWith('/')) {
    return prdPath;
  }
  return join(projectRoot, prdPath);
}
