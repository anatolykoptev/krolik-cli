/**
 * @module mcp/tools/core
 * @description Core utilities and types for MCP tools
 *
 * This module provides the foundational building blocks for MCP tools:
 * - Type definitions for tool schemas and handlers
 * - Tool registration and discovery
 * - Shared constants and utilities
 * - Flag building for CLI commands
 * - Project detection and resolution
 * - Common utility functions
 * - Standardized error handling
 *
 * ## Tool Implementation Patterns
 *
 * ### CLI-based Tools (status, audit, fix, review, etc.)
 * Use `buildFlags` + `runKrolik` for tools that wrap CLI commands:
 * ```typescript
 * handler: (args, workspaceRoot) => {
 *   const result = buildFlags(args, schema);
 *   if (!result.ok) return result.error;
 *   return withProjectDetection(args, workspaceRoot, (projectPath) => {
 *     return runKrolik(`command ${result.flags}`, projectPath);
 *   });
 * }
 * ```
 *
 * ### Action-based Tools (docs, modules)
 * Use `validateActionRequirements` + `withErrorHandler` for multi-action tools:
 * ```typescript
 * const ACTIONS: Record<string, ActionDefinition> = {
 *   search: { requires: [{ param: 'query' }] },
 *   list: {},
 * };
 *
 * handler: (args, workspaceRoot) => {
 *   const error = validateActionRequirements(action, args, ACTIONS);
 *   if (error) return error;
 *   return withErrorHandler('toolname', action, () => handleAction());
 * }
 * ```
 *
 * ### Direct Function Tools (memory)
 * Use `resolveProjectPath` + `formatError` for direct function calls:
 * ```typescript
 * handler: (args, workspaceRoot) => {
 *   const resolved = resolveProjectPath(workspaceRoot, args.project);
 *   if ('error' in resolved) return resolved.error;
 *   try { return handleAction(); } catch (e) { return formatError(e); }
 * }
 * ```
 */

// Error handling
export * from './errors';
// Flag builder
export * from './flag-builder';
// Project detection
export * from './projects';
// Tool registry
export * from './registry';
// Shared constants and utilities
export * from './shared';
// Type definitions
export * from './types';
// Utility functions
export * from './utils';
