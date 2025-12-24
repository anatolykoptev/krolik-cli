/**
 * @module mcp/handlers/routes
 * @description Handler for krolik_routes tool
 */

import { runKrolik } from './utils';

export function handleRoutes(args: Record<string, unknown>, projectRoot: string): string {
  const flags = args.json ? '--json' : '';
  return runKrolik(`routes ${flags}`, projectRoot);
}
