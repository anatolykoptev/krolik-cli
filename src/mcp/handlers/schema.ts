/**
 * @module mcp/handlers/schema
 * @description Handler for krolik_schema tool
 */

import { runKrolik } from './utils';

export function handleSchema(args: Record<string, unknown>, projectRoot: string): string {
  const flags = args.json ? '--json' : '';
  return runKrolik(`schema ${flags}`, projectRoot);
}
