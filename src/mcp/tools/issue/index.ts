/**
 * @module mcp/tools/issue
 * @description krolik_issue tool - GitHub issue parsing
 *
 * PERFORMANCE: Uses direct function imports instead of subprocess spawn.
 * This eliminates 10s+ Node.js startup overhead.
 */

import { formatAI } from '@/commands/issue/output';
import { parseIssue } from '@/commands/issue/parser';
import { sanitizeIssueNumber } from '@/lib/@security';
import { getIssue, isGhAuthenticated, isGhAvailable } from '@/lib/@vcs';
import { type MCPToolDefinition, registerTool } from '../core';
import { formatError } from '../core/errors';
import { resolveProjectPath } from '../core/projects';

export const issueTool: MCPToolDefinition = {
  name: 'krolik_issue',
  description: 'Parse a GitHub issue and extract context: checklist, mentioned files, priority.',
  inputSchema: {
    type: 'object',
    properties: {
      number: {
        type: 'string',
        description: 'GitHub issue number',
      },
    },
    required: ['number'],
  },
  template: { when: 'Parse GitHub issue details', params: '`number: "123"`' },
  workflow: { trigger: 'before_task', order: 2 },
  category: 'context',
  handler: (args, workspaceRoot) => {
    // Validate and sanitize issue number
    const issueNumber = sanitizeIssueNumber(args.number);
    if (issueNumber === null) {
      return `<issue-error>Invalid issue number: ${args.number}. Must be a positive integer less than 1,000,000.</issue-error>`;
    }

    // Resolve project path for git context
    const resolved = resolveProjectPath(workspaceRoot, undefined);
    const projectRoot = 'error' in resolved ? workspaceRoot : resolved.path;

    // Check gh CLI availability
    if (!isGhAvailable()) {
      return '<issue-error tool="gh" status="not-installed">GitHub CLI (gh) is not installed. Install from: https://cli.github.com/</issue-error>';
    }

    // Check gh authentication
    if (!isGhAuthenticated()) {
      return '<issue-error tool="gh" status="not-authenticated">Not authenticated with GitHub. Run: gh auth login</issue-error>';
    }

    try {
      // Fetch issue from GitHub
      const issue = getIssue(issueNumber, projectRoot);

      if (!issue) {
        return `<issue-error number="${issueNumber}">Could not fetch issue #${issueNumber}. Check if the issue exists and you have access.</issue-error>`;
      }

      // Parse issue body for structured data
      const parsedIssue = parseIssue(issue);

      // Return AI-friendly XML format
      return formatAI(parsedIssue);
    } catch (error) {
      return formatError(error);
    }
  },
};

registerTool(issueTool);
