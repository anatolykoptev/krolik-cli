/**
 * @module mcp/handlers
 * @description MCP request handlers
 */

import type { MCPResult } from './types';
import { TOOLS, runTool } from './tools';
import { getResources, getResource, type ResourceContent } from './resources';

// ============================================================================
// INITIALIZE HANDLER
// ============================================================================

/**
 * Handle MCP initialize request
 *
 * @returns Server info and capabilities
 */
export function handleInitialize(): MCPResult {
  return {
    protocolVersion: '2024-11-05',
    serverInfo: { name: 'krolik', version: '1.0.0' },
    capabilities: { tools: {}, resources: {} },
  };
}

// ============================================================================
// TOOLS HANDLERS
// ============================================================================

/**
 * Handle tools/list request
 *
 * @returns List of available tools
 */
export function handleToolsList(): MCPResult {
  return { tools: TOOLS };
}

/**
 * Handle tools/call request
 *
 * @param params - Request params with tool name and arguments
 * @param projectRoot - Project root directory
 * @returns Tool execution result
 */
export function handleToolsCall(params: unknown, projectRoot: string): MCPResult {
  const { name, arguments: args = {} } = params as {
    name: string;
    arguments?: Record<string, unknown>;
  };
  const result = runTool(name, args, projectRoot);
  return { content: [{ type: 'text', text: result }] };
}

// ============================================================================
// RESOURCES HANDLERS
// ============================================================================

/**
 * Handle resources/list request
 *
 * @param projectRoot - Project root directory
 * @returns List of available resources
 */
export function handleResourcesList(projectRoot: string): MCPResult {
  return { resources: getResources(projectRoot) };
}

/**
 * Build resource content response
 */
function buildResourceContent(uri: string, resource: ResourceContent): MCPResult {
  return {
    contents: [{
      uri,
      mimeType: resource.mimeType,
      text: resource.content,
    }],
  };
}

/**
 * Handle resources/read request
 *
 * @param params - Request params with resource URI
 * @param projectRoot - Project root directory
 * @returns Resource content
 */
export function handleResourcesRead(params: unknown, projectRoot: string): MCPResult {
  const { uri } = params as { uri: string };
  const resource = getResource(uri, projectRoot);
  if (!resource) {
    throw new Error(`Resource not found: ${uri}`);
  }
  return buildResourceContent(uri, resource);
}
