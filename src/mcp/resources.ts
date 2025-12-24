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
      description:
        'Instructions and rules for AI agents working on this project',
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
 * Get resource content by URI
 *
 * @param uri - Resource URI (e.g., "krolik://project/claude-md")
 * @param projectRoot - Project root directory
 * @returns Resource content or null if not found
 */
export function getResource(
  uri: string,
  projectRoot: string,
): ResourceContent | null {
  switch (uri) {
    case 'krolik://project/claude-md': {
      const filePath = path.join(projectRoot, 'CLAUDE.md');
      if (fs.existsSync(filePath)) {
        return {
          content: fs.readFileSync(filePath, 'utf-8'),
          mimeType: 'text/markdown',
        };
      }
      return null;
    }

    case 'krolik://project/readme': {
      const filePath = path.join(projectRoot, 'README.md');
      if (fs.existsSync(filePath)) {
        return {
          content: fs.readFileSync(filePath, 'utf-8'),
          mimeType: 'text/markdown',
        };
      }
      return null;
    }

    case 'krolik://project/package-json': {
      const filePath = path.join(projectRoot, 'package.json');
      if (fs.existsSync(filePath)) {
        return {
          content: fs.readFileSync(filePath, 'utf-8'),
          mimeType: 'application/json',
        };
      }
      return null;
    }

    default:
      return null;
  }
}
