/**
 * @module mcp/tools/audit
 * @description krolik_audit tool - Code quality audit
 */

import {
  buildFlags,
  COMMON_FLAGS,
  type FlagSchema,
  type MCPToolDefinition,
  PROJECT_PROPERTY,
  registerTool,
  runKrolik,
  TIMEOUT_60S,
  withProjectDetection,
} from '../core';

const auditSchema: FlagSchema = {
  path: COMMON_FLAGS.path,
  feature: COMMON_FLAGS.feature,
  mode: { flag: '--mode' },
};

export const auditTool: MCPToolDefinition = {
  name: 'krolik_audit',
  description:
    'Audit code quality. Analyzes codebase for issues: console.log, any types, complexity, magic numbers, etc. Returns AI-friendly report.',
  inputSchema: {
    type: 'object',
    properties: {
      ...PROJECT_PROPERTY,
      path: {
        type: 'string',
        description: 'Specific subdirectory within project to audit (optional)',
      },
      feature: {
        type: 'string',
        description: 'Filter to specific feature/domain (e.g., "booking", "auth")',
      },
      mode: {
        type: 'string',
        enum: ['all', 'release', 'refactor'],
        description:
          'Filter by mode: all (default), release (security + type-safety), refactor (complexity + SRP)',
      },
    },
  },
  template: { when: 'Code quality audit', params: '—' },
  workflow: { trigger: 'on_refactor', order: 2 },
  category: 'code',
  handler: (args, workspaceRoot) => {
    const result = buildFlags(args, auditSchema);
    if (!result.ok) return result.error;

    return withProjectDetection(args, workspaceRoot, (projectPath) => {
      return runKrolik(`audit ${result.flags}`, projectPath, TIMEOUT_60S);
    });
  },
};

registerTool(auditTool);
