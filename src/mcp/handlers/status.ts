/**
 * @module mcp/handlers/status
 * @description Handler for krolik_status tool
 */

import { runKrolik } from './utils';

export function handleStatus(args: Record<string, unknown>, projectRoot: string): string {
  const flags = args.fast ? '--fast' : '';
  return runKrolik(`status ${flags}`, projectRoot);
}
