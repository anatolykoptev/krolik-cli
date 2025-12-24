/**
 * @module mcp/handlers/schema
 * @description Handler for krolik_schema tool
 */

import { runKrolik } from './utils';
import { withProjectDetection } from './projects';

export function handleSchema(args: Record<string, unknown>, workspaceRoot: string): string {
  return withProjectDetection(args, workspaceRoot, (projectPath) => {
    const flags = args.json ? '--json' : '';
    return runKrolik(`schema ${flags}`, projectPath);
  });
}
