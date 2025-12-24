/**
 * @module mcp/tools/shared
 * @description Shared constants and utilities for MCP tools
 */

import type { SchemaProperty } from './types';

/**
 * Common project property for tools that support project detection
 */
export const PROJECT_PROPERTY: Record<string, SchemaProperty> = {
  project: {
    type: 'string',
    description:
      'Project folder name to analyze (e.g., "piternow-wt-fix", "krolik-cli"). If not specified, auto-detects or returns list of available projects.',
  },
};
