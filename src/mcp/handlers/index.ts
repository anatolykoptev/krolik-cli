/**
 * @module mcp/handlers
 * @description Tool handler registry
 */

import { handleStatus } from './status';
import { handleContext } from './context';
import { handleSchema } from './schema';
import { handleRoutes } from './routes';
import { handleReview } from './review';
import { handleIssue } from './issue';
import { handleAudit } from './audit';
import { handleFix } from './fix';

/**
 * Tool handler function type
 */
export type ToolHandler = (args: Record<string, unknown>, projectRoot: string) => string;

/**
 * Registry of tool handlers
 */
export const handlers: Record<string, ToolHandler> = {
  krolik_status: handleStatus,
  krolik_context: handleContext,
  krolik_schema: handleSchema,
  krolik_routes: handleRoutes,
  krolik_review: handleReview,
  krolik_issue: handleIssue,
  krolik_audit: handleAudit,
  krolik_fix: handleFix,
};

/**
 * Check if a tool name is valid
 */
export function isValidTool(name: string): boolean {
  return name in handlers;
}

/**
 * Get list of all available tool names
 */
export function getToolNames(): string[] {
  return Object.keys(handlers);
}
