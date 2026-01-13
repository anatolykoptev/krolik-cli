/**
 * @module mcp/tools/review
 * @description krolik_review tool - Code review
 *
 * PERFORMANCE: Uses direct function imports instead of subprocess spawn.
 * This eliminates 10s+ Node.js startup overhead.
 */

import { generateReview } from '@/commands/review';
import {
  getChangedFiles,
  getPRInfo,
  getReviewBranches,
  getStagedChanges,
} from '@/commands/review/diff';
import { formatAI } from '@/commands/review/output';
import { type MCPToolDefinition, PROJECT_PROPERTY, registerTool } from '../core';
import { formatError } from '../core/errors';
import { resolveProjectPath } from '../core/projects';

export const reviewTool: MCPToolDefinition = {
  name: 'krolik_review',
  description:
    'Review code changes. Analyzes git diff for security issues, performance problems, and risks.',
  inputSchema: {
    type: 'object',
    properties: {
      ...PROJECT_PROPERTY,
      staged: {
        type: 'boolean',
        description: 'Review only staged changes',
      },
      pr: {
        type: 'string',
        description: 'Review specific PR number',
      },
    },
  },
  template: { when: 'After code changes', params: '`staged: true`' },
  workflow: { trigger: 'before_commit', order: 1 },
  category: 'code',
  handler: (args, workspaceRoot) => {
    const projectArg = typeof args.project === 'string' ? args.project : undefined;
    const resolved = resolveProjectPath(workspaceRoot, projectArg);

    if ('error' in resolved) {
      return resolved.error;
    }

    const cwd = resolved.path;

    try {
      let title: string;
      let description = '';
      let baseBranch: string;
      let headBranch: string;
      let files: ReturnType<typeof getChangedFiles>;

      if (typeof args.pr === 'string') {
        // Review specific PR
        const prNumber = Number.parseInt(args.pr, 10);
        if (Number.isNaN(prNumber)) {
          return '<review-error>Invalid PR number</review-error>';
        }

        const prInfo = getPRInfo(prNumber, cwd);
        if (!prInfo) {
          return `<review-error>Failed to fetch PR #${prNumber}</review-error>`;
        }

        title = prInfo.title;
        description = prInfo.description;
        baseBranch = prInfo.baseBranch;
        headBranch = prInfo.headBranch;
        files = getChangedFiles(baseBranch, headBranch, cwd);
      } else if (args.staged === true) {
        // Review staged changes
        title = 'Staged Changes Review';
        baseBranch = 'HEAD';
        headBranch = 'staged';
        files = getStagedChanges(cwd);
      } else {
        // Review current branch vs main
        const branches = getReviewBranches(cwd);
        baseBranch = branches.base;
        headBranch = branches.head;
        title = `Review: ${headBranch}`;
        files = getChangedFiles(baseBranch, headBranch, cwd);
      }

      if (files.length === 0) {
        return '<review><message>No changes to review</message></review>';
      }

      const review = generateReview(files, {
        title,
        description,
        baseBranch,
        headBranch,
        staged: args.staged === true,
        cwd,
      });

      // Return AI-friendly XML format
      return formatAI(review);
    } catch (error) {
      return formatError(error);
    }
  },
};

registerTool(reviewTool);
