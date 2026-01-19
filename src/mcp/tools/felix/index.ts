/**
 * @module mcp/tools/felix
 * @description Krolik Felix MCP tool - Autonomous agent loop for PRD task execution
 *
 * Actions:
 * - status: Get current Felix session status and statistics
 * - validate: Validate PRD.json file and show execution order
 * - start: Start a new Felix session
 * - pause: Pause the active session
 * - resume: Resume a paused session
 * - cancel: Cancel the active session
 * - plan: Show model selection for each task
 * - estimate: Estimate cost before execution
 * - stats: View model routing statistics
 */

import {
  cancelActiveSession,
  formatStatusXML,
  formatValidationXML,
  getCostEstimate,
  getFelixStatus,
  getRouterStats,
  getRoutingPlan,
  pauseActiveSession,
  resumeActiveSession,
  startSessionBackground,
  validatePrdFile,
} from '@/commands/felix';
import { type MCPToolDefinition, PROJECT_PROPERTY, registerTool } from '../core';
import { formatError } from '../core/errors';
import { resolveProjectPath } from '../core/projects';

const ACTIONS = [
  'status',
  'validate',
  'start',
  'pause',
  'resume',
  'cancel',
  'plan',
  'estimate',
  'stats',
] as const;
type FelixAction = (typeof ACTIONS)[number];

export const felixTool: MCPToolDefinition = {
  name: 'krolik_felix',
  description: `Krolik Felix - Autonomous agent loop for executing PRD tasks.

Actions:
- status: Get current Felix session status and statistics
- validate: Validate PRD.json file and show execution order
- start: Start a new Felix session
- pause: Pause the active session
- resume: Resume a paused session
- cancel: Cancel the active session
- plan: Show model selection for each task
- estimate: Estimate cost before execution
- stats: View model routing statistics

Use this tool to:
- Check Krolik Felix status before starting a session
- Validate PRD.json files to ensure they're correctly formatted
- Control Felix sessions (start, pause, resume, cancel)
- Plan model routing for cost optimization
- Estimate execution costs before running

Examples:
- Status: { action: "status" }
- Validate: { action: "validate", prd: "PRD.json" }
- Start: { action: "start", prd: "PRD.json" }
- Pause: { action: "pause" }
- Plan: { action: "plan", prd: "PRD.json" }
- Estimate: { action: "estimate", prd: "PRD.json" }
- Stats: { action: "stats" }`,

  inputSchema: {
    type: 'object',
    properties: {
      ...PROJECT_PROPERTY,
      action: {
        type: 'string',
        description: 'Action to perform: status, validate, start, pause, resume, cancel',
        enum: [...ACTIONS],
      },
      prd: {
        type: 'string',
        description: 'Path to PRD.json file (relative to project root or absolute)',
      },
      dryRun: {
        type: 'boolean',
        description: 'For start: validate without starting the session',
      },
      maxAttempts: {
        type: 'number',
        description: 'For start: maximum retry attempts per task (default: 3)',
      },
      model: {
        type: 'string',
        description: 'For start: AI model to use',
        enum: ['opus', 'sonnet', 'haiku', 'flash', 'pro'],
      },
      backend: {
        type: 'string',
        description:
          'For start: backend to use (cli = Claude Code/Gemini CLI, api = requires API keys)',
        enum: ['cli', 'api'],
      },
      continueOnFailure: {
        type: 'boolean',
        description: 'For start: continue to next task on failure',
      },
      useMultiAgentMode: {
        type: 'boolean',
        description:
          'For start: use multi-agent mode with ADK SequentialAgent/ParallelAgent for coordinated task execution',
      },
    },
    required: ['action'],
  },

  template: {
    when: 'Before PRD task execution',
    params: '`action: "status"`',
  },

  category: 'advanced',

  handler: async (args, workspaceRoot) => {
    const projectArg = typeof args.project === 'string' ? args.project : undefined;
    const resolved = resolveProjectPath(workspaceRoot, projectArg);

    if ('error' in resolved) {
      if (resolved.error.includes('not found')) {
        return `<felix error="true"><message>Project "${projectArg}" not found.</message></felix>`;
      }
      return resolved.error;
    }

    const action = (args.action as FelixAction) ?? 'status';
    const prdPath = typeof args.prd === 'string' ? args.prd : undefined;

    try {
      switch (action) {
        case 'status': {
          const status = getFelixStatus(resolved.path, prdPath);
          return formatStatusXML(status);
        }

        case 'validate': {
          const result = validatePrdFile(resolved.path, prdPath);
          return formatValidationXML(result);
        }

        case 'start': {
          // Build options from args
          const options: {
            dryRun?: boolean;
            maxAttempts?: number;
            model?: 'opus' | 'sonnet' | 'haiku' | 'flash' | 'pro';
            backend?: 'cli' | 'api';
            continueOnFailure?: boolean;
            useMultiAgentMode?: boolean;
          } = {};

          // Handle boolean params
          if (args.dryRun === true) {
            options.dryRun = true;
          }
          if (typeof args.maxAttempts === 'number') {
            options.maxAttempts = args.maxAttempts;
          }
          if (
            args.model === 'opus' ||
            args.model === 'sonnet' ||
            args.model === 'haiku' ||
            args.model === 'flash' ||
            args.model === 'pro'
          ) {
            options.model = args.model;
          }
          if (args.backend === 'cli' || args.backend === 'api') {
            options.backend = args.backend;
          }
          if (args.continueOnFailure === true) {
            options.continueOnFailure = true;
          }
          if (args.useMultiAgentMode === true) {
            options.useMultiAgentMode = true;
          }

          // Use background spawn for MCP - runs as detached process
          const result = startSessionBackground(resolved.path, prdPath, options);
          if (result.success) {
            return `<felix-session action="started" id="${result.sessionId}" logFile="${result.logFile}"/>`;
          }
          return `<felix-error>${result.error}</felix-error>`;
        }

        case 'pause': {
          const result = pauseActiveSession(resolved.path);
          if (result.success) {
            return '<felix-session action="paused"/>';
          }
          return `<felix-error>${result.error}</felix-error>`;
        }

        case 'resume': {
          const result = resumeActiveSession(resolved.path);
          if (result.success) {
            return `<felix-session action="resumed" id="${result.sessionId}"/>`;
          }
          return `<felix-error>${result.error}</felix-error>`;
        }

        case 'cancel': {
          const result = cancelActiveSession(resolved.path);
          if (result.success) {
            return '<felix-session action="cancelled"/>';
          }
          return `<felix-error>${result.error}</felix-error>`;
        }

        case 'plan': {
          const result = getRoutingPlan(resolved.path, prdPath);
          if (result.success) {
            return result.xml ?? '<routing-plan/>';
          }
          return `<felix-error>${result.error}</felix-error>`;
        }

        case 'estimate': {
          const result = getCostEstimate(resolved.path, prdPath);
          if (result.success) {
            return result.xml ?? '<cost-estimate/>';
          }
          return `<felix-error>${result.error}</felix-error>`;
        }

        case 'stats': {
          const result = getRouterStats(resolved.path);
          return result.xml;
        }

        default:
          return `<felix-error>Unknown action: ${action}. Valid actions: ${ACTIONS.join(', ')}</felix-error>`;
      }
    } catch (error) {
      return formatError(error);
    }
  },
};

registerTool(felixTool);
