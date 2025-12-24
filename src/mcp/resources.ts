/**
 * @module mcp/resources
 * @description MCP resource definitions and implementations
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { MCPResource } from './types';

// ============================================================================
// RESOURCE DEFINITIONS
// ============================================================================

/**
 * Get available resources for the project
 *
 * @param projectRoot - Project root directory
 * @returns List of available MCP resources
 */
export function getResources(projectRoot: string): MCPResource[] {
  const resources: MCPResource[] = [];

  if (fs.existsSync(path.join(projectRoot, 'CLAUDE.md'))) {
    resources.push({
      uri: 'krolik://project/claude-md',
      name: 'Project Rules (CLAUDE.md)',
      description: 'Instructions and rules for AI agents working on this project',
      mimeType: 'text/markdown',
    });
  }

  if (fs.existsSync(path.join(projectRoot, 'README.md'))) {
    resources.push({
      uri: 'krolik://project/readme',
      name: 'README',
      description: 'Project documentation and setup instructions',
      mimeType: 'text/markdown',
    });
  }

  if (fs.existsSync(path.join(projectRoot, 'package.json'))) {
    resources.push({
      uri: 'krolik://project/package-json',
      name: 'Package.json',
      description: 'Project dependencies and scripts',
      mimeType: 'application/json',
    });
  }

  return resources;
}

// ============================================================================
// RESOURCE CONTENT
// ============================================================================

/** Resource content with mime type */
export interface ResourceContent {
  content: string;
  mimeType: string;
}

/**
 * Read resource file if it exists
 *
 * @param filePath - Path to the file
 * @param mimeType - MIME type of the resource
 * @returns Resource content or null if file doesn't exist
 */
function readResourceFile(filePath: string, mimeType: string): ResourceContent | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return {
    content: fs.readFileSync(filePath, 'utf-8'),
    mimeType,
  };
}

/**
 * Get resource content by URI
 *
 * @param uri - Resource URI (e.g., "krolik://project/claude-md")
 * @param projectRoot - Project root directory
 * @returns Resource content or null if not found
 */
export function getResource(uri: string, projectRoot: string): ResourceContent | null {
  switch (uri) {
    case 'krolik://project/claude-md':
      return readResourceFile(path.join(projectRoot, 'CLAUDE.md'), 'text/markdown');

    case 'krolik://project/readme':
      return readResourceFile(path.join(projectRoot, 'README.md'), 'text/markdown');

    case 'krolik://project/package-json':
      return readResourceFile(path.join(projectRoot, 'package.json'), 'application/json');

    default:
      return null;
  }
}
