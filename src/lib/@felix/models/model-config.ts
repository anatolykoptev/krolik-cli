/**
 * Model Configuration - Dynamic model routing
 *
 * Pass-through approach: don't hardcode models, let CLI validate.
 * Only maintain provider detection and convenience aliases.
 *
 * @module @ralph/models/model-config
 */

import { spawn } from 'node:child_process';

// ============================================================================
// TYPES
// ============================================================================

export type ModelProvider = 'anthropic' | 'google' | 'groq' | 'ollama' | 'openai' | 'vibeproxy';

export interface ProviderDefinition {
  /** Provider name */
  name: ModelProvider;
  /** CLI executable name */
  cliExecutable: string;
  /** Pattern to detect provider from model name */
  detectPattern: RegExp;
  /** Short aliases that map to this provider */
  aliases: string[];
}

// ============================================================================
// PROVIDER DEFINITIONS (minimal, no model lists)
// ============================================================================

/**
 * Provider detection patterns
 * Models are NOT hardcoded - CLI validates them
 */
export const PROVIDERS: ProviderDefinition[] = [
  {
    name: 'anthropic',
    cliExecutable: 'claude',
    detectPattern: /^claude-/i,
    aliases: ['sonnet', 'opus', 'haiku'], // CLI understands these
  },
  {
    name: 'google',
    cliExecutable: 'gemini',
    detectPattern: /^gemini-/i,
    aliases: ['flash', 'pro', 'thinking'], // CLI understands these
  },
  {
    name: 'groq',
    cliExecutable: '', // Groq has no CLI, API only
    detectPattern: /^llama-|^mixtral-|^deepseek-/i,
    aliases: ['llama-70b', 'llama-8b', 'mixtral'], // Groq models
  },
  {
    name: 'vibeproxy',
    cliExecutable: '', // VibeProxy has no CLI, API only
    detectPattern: /^gemini-claude-|^vibe-|^antigravity-/i,
    aliases: [
      'vibe-opus',
      'vibe-sonnet',
      'vibe-sonnet-fast',
      'antigravity-opus',
      'antigravity-sonnet',
    ],
  },
];

// ============================================================================
// PROVIDER DETECTION
// ============================================================================

/**
 * Detect provider from model name or alias
 * Returns null for unknown - caller should handle
 */
export function detectProvider(modelOrAlias: string): ModelProvider | null {
  const lower = modelOrAlias.toLowerCase();

  for (const provider of PROVIDERS) {
    // Check if it's a known alias
    if (provider.aliases.includes(lower)) {
      return provider.name;
    }
    // Check pattern match
    if (provider.detectPattern.test(modelOrAlias)) {
      return provider.name;
    }
  }

  return null;
}

/**
 * Get CLI executable for provider
 */
export function getCliExecutable(provider: ModelProvider): string | null {
  const def = PROVIDERS.find((p) => p.name === provider);
  return def?.cliExecutable ?? null;
}

/**
 * Get provider definition
 */
export function getProviderDef(provider: ModelProvider): ProviderDefinition | undefined {
  return PROVIDERS.find((p) => p.name === provider);
}

// ============================================================================
// MODEL PASS-THROUGH
// ============================================================================

/**
 * Get CLI model name - pass-through approach
 *
 * - Short aliases (sonnet, flash) → passed as-is (CLI understands them)
 * - Full model names → passed as-is (CLI validates)
 * - Unknown → passed as-is (let CLI error if invalid)
 */
export function getCliModelName(modelOrAlias: string): string {
  // Just pass through - CLI handles validation
  return modelOrAlias;
}

/**
 * Check if model alias is potentially valid
 * This is permissive - actual validation happens in CLI
 */
export function isValidModelAlias(modelOrAlias: string, provider?: ModelProvider): boolean {
  // If we can detect a provider, it's probably valid
  const detected = detectProvider(modelOrAlias);

  if (provider) {
    return detected === provider || detected === null; // null = unknown, let CLI decide
  }

  return true; // Always let CLI validate
}

// ============================================================================
// DYNAMIC DISCOVERY
// ============================================================================

interface DiscoveryResult {
  available: boolean;
  version?: string;
  error?: string;
}

/**
 * Check if CLI is available
 */
export async function checkCliAvailability(executable: string): Promise<DiscoveryResult> {
  return new Promise((resolve) => {
    const proc = spawn(executable, ['--version'], {
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let output = '';

    proc.stdout.on('data', (data) => {
      output += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0 && output) {
        resolve({ available: true, version: output.trim() });
      } else {
        resolve({ available: false });
      }
    });

    proc.on('error', (error) => {
      resolve({ available: false, error: error.message });
    });
  });
}

/**
 * Discover available CLI providers
 */
export async function discoverProviders(): Promise<Map<ModelProvider, DiscoveryResult>> {
  const results = new Map<ModelProvider, DiscoveryResult>();

  const discoveries = await Promise.all(
    PROVIDERS.map(async (provider) => {
      const result = await checkCliAvailability(provider.cliExecutable);
      return { provider: provider.name, result };
    }),
  );

  for (const { provider, result } of discoveries) {
    results.set(provider, result);
  }

  return results;
}

// ============================================================================
// BACKWARDS COMPATIBILITY (deprecated, will be removed)
// ============================================================================

/** @deprecated Use detectProvider + pass-through instead */
export interface ModelDefinition {
  id: string;
  provider: ModelProvider;
  aliases: string[];
  cliModel?: string;
  isDefault?: boolean;
  description?: string;
  available?: boolean;
}

/** @deprecated No longer used - models are not hardcoded */
export function getAllModels(): ModelDefinition[] {
  return [];
}

/** @deprecated Use detectProvider instead */
export function findModel(_modelOrAlias: string): ModelDefinition | undefined {
  return undefined;
}

/** @deprecated No longer used */
export function getDefaultModel(_provider: ModelProvider): ModelDefinition | undefined {
  return undefined;
}

/** @deprecated No longer used */
export function getProviderModels(_provider: ModelProvider): ModelDefinition[] {
  return [];
}

/** @deprecated No longer used */
export function buildAliasMap(): Map<string, ModelDefinition> {
  return new Map();
}

/** @deprecated No longer used */
export function buildCliModelMap(): Record<string, string> {
  return {};
}
