/**
 * @module mcp/tools
 * @description MCP tools barrel export with self-registering pattern
 *
 * Adding a new tool is now simple:
 * 1. Create tools/my-tool.ts with MCPToolDefinition and call registerTool()
 * 2. Add import './my-tool'; below
 * That's it! The registry handles everything else.
 */

// Import all tool files to trigger self-registration
// Each tool file calls registerTool() on import
import './status';
import './context';
import './schema';
import './routes';
import './review';
import './issue';
import './audit';
import './fix';
import './refactor';

// Re-export registry functions
export {
  buildHandlerRegistry,
  getAllTools,
  getToolDefinitions,
  getToolNames,
  isValidTool,
  runTool,
} from './registry';
// Type exports
export type { MCPTool, MCPToolDefinition, SchemaProperty, ToolHandler } from './types';

// Legacy compatibility: export ALL_TOOLS constant
// This maintains backward compatibility with existing code
import { getAllTools } from './registry';
export const ALL_TOOLS = getAllTools();
