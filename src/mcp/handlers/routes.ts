/**
 * @module mcp/handlers/routes
 * @description Handler for krolik_routes tool
 */

import { runKrolik } from './utils';
import { withProjectDetection } from './projects';

export function handleRoutes(args: Record<string, unknown>, workspaceRoot: string): string {
  return withProjectDetection(args, workspaceRoot, (projectPath) => {
    const flags = args.json ? '--json' : '';
    return runKrolik(`routes ${flags}`, projectPath);
  });
}
