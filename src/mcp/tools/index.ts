/**
 * @module mcp/tools
 * @description Central tool registry and exports
 *
 * This file imports all tools to trigger registration and re-exports
 * registry functions and types.
 *
 * Structure:
 * - core/ - infrastructure (types, registry, shared, flag-builder, utils, projects)
 * - status/, context/, schema/, routes/, review/, issue/, audit/, fix/, refactor/ - each tool in its own folder
 *
 * Adding a new tool:
 * 1. Create src/mcp/tools/my-tool/ folder with index.ts
 * 2. Export MCPToolDefinition and call registerTool()
 * 3. Import './my-tool' below to trigger registration
 */

// Tool imports - each tool calls registerTool() on import
import './agent';
import './audit';
import './context';
import './docs';
import './fix';
import './issue';
import './memory';
import './refactor';
import './review';
import './routes';
import './schema';
import './status';

// Re-export registry functions from core/
export {
  buildHandlerRegistry,
  getAllTools,
  getToolDefinitions,
  getToolNames,
  isValidTool,
  runTool,
} from './core/registry';

// Type exports from core/
export type { MCPTool, MCPToolDefinition, SchemaProperty, ToolHandler } from './core/types';

// Legacy compatibility: export ALL_TOOLS constant
// This maintains backward compatibility with existing code
import { getAllTools } from './core/registry';
export const ALL_TOOLS = getAllTools();
