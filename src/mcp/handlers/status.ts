/**
 * @module mcp/handlers/status
 * @description Handler for krolik_status tool
 */

import { runKrolik } from './utils';
import { withProjectDetection } from './projects';

export function handleStatus(args: Record<string, unknown>, workspaceRoot: string): string {
  return withProjectDetection(args, workspaceRoot, (projectPath) => {
    const flags = args.fast ? '--fast' : '';
    return runKrolik(`status ${flags}`, projectPath);
  });
}
