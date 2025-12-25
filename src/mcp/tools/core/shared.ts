/**
 * @module mcp/tools/shared
 * @description Shared constants and utilities for MCP tools
 */

import type { FlagDef } from './flag-builder';
import type { SchemaProperty } from './types';

/**
 * Common project property for tools that support project detection
 */
export const PROJECT_PROPERTY: Record<string, SchemaProperty> = {
  project: {
    type: 'string',
    description:
      'Project folder name to analyze (e.g., "my-app", "my-project"). If not specified, auto-detects or returns list of available projects.',
  },
};

/**
 * Valid fix categories for the krolik fix command
 */
export const FIX_CATEGORIES = ['lint', 'type-safety', 'complexity', 'hardcoded', 'srp'] as const;

/**
 * Type for fix categories derived from FIX_CATEGORIES constant
 */
export type FixCategory = (typeof FIX_CATEGORIES)[number];

/**
 * Common flag definitions for use with buildFlags()
 */
export const COMMON_FLAGS = {
  path: { flag: '--path', sanitize: 'feature' } as const,
  feature: { flag: '--feature', sanitize: 'feature' } as const,
  issue: { flag: '--issue', sanitize: 'issue' } as const,
  pr: { flag: '--pr', sanitize: 'issue' } as const,
  staged: { flag: '--staged' } as const,
  dryRun: { flag: '--dry-run' } as const,
  json: { flag: '--json' } as const,
  verbose: { flag: '--verbose' } as const,
  apply: { flag: '--apply' } as const,
  safe: { flag: '--safe' } as const,
} satisfies Record<string, FlagDef>;
