/**
 * @module mcp/tools/prd
 * @description krolik_prd tool - Generate PRD from GitHub issue
 *
 * PERFORMANCE: Uses direct function imports instead of subprocess spawn.
 */

import { chmodSync, copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sanitizeIssueNumber } from '@/lib/@security';
import { type MCPToolDefinition, PROJECT_PROPERTY, registerTool } from '../core';
import { formatError } from '../core/errors';
import { resolveProjectPath } from '../core/projects';

/** Ensure Claude Code plugin is installed at ~/.krolik/claude-plugin/ */
function ensurePluginInstalled(): { installed: boolean; message?: string } {
  const pluginDir = join(homedir(), '.krolik', 'claude-plugin');

  if (existsSync(join(pluginDir, 'plugin.json'))) {
    return { installed: true };
  }

  try {
    // Find source plugin directory (relative to this file's location)
    // In built dist: dist/mcp/tools/prd/index.js → need to go up to package root
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const packageRoot = join(currentDir, '..', '..', '..', '..');
    const sourcePlugin = join(packageRoot, 'claude-plugin');

    if (!existsSync(sourcePlugin)) {
      return {
        installed: false,
        message: `Plugin source not found at ${sourcePlugin}. Run: pnpm build`,
      };
    }

    // Create target directory
    mkdirSync(pluginDir, { recursive: true });

    // Copy plugin files recursively
    copyDirRecursive(sourcePlugin, pluginDir);

    return {
      installed: true,
      message: `Krolik plugin installed to: ${pluginDir}\n\nTo use with Claude Code:\n  cc --plugin-dir ~/.krolik/claude-plugin\n\nOr add to ~/.claude/settings.json:\n  "pluginDirs": ["~/.krolik/claude-plugin"]`,
    };
  } catch (error) {
    return {
      installed: false,
      message: `Failed to install plugin: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/** Recursively copy directory */
function copyDirRecursive(src: string, dest: string): void {
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
  }

  const entries = readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
      // Make shell scripts executable
      if (entry.name.endsWith('.sh')) {
        chmodSync(destPath, 0o755);
      }
    }
  }
}

export const prdTool: MCPToolDefinition = {
  name: 'krolik_prd',
  description: `Generate PRD.json for Ralph Loop from a GitHub issue.

**Workflow:**
1. Fetch issue details (title, body, labels, checklists)
2. Inject project context (schema models, routes, memories)
3. AI-decompose into atomic tasks with acceptance criteria
4. Output PRD.json ready for Ralph execution

**Output:**
- XML format with tasks, dependencies, complexity estimates
- Each task has: id, title, description, acceptance_criteria, files_affected

**Example output:**
\`\`\`xml
<prd version="1.0" project="my-app">
  <tasks count="3">
    <task id="add-api-endpoint" priority="high">
      <title>Add user registration endpoint</title>
      <complexity>moderate</complexity>
      <acceptance-criteria>
        <criterion>POST /api/register returns 201 on success</criterion>
      </acceptance-criteria>
    </task>
  </tasks>
</prd>
\`\`\``,

  inputSchema: {
    type: 'object',
    properties: {
      ...PROJECT_PROPERTY,
      issue: {
        type: 'string',
        description: 'GitHub issue number (required)',
      },
      model: {
        type: 'string',
        enum: ['opus', 'sonnet', 'haiku', 'flash', 'pro', 'gemini-flash', 'gemini-pro'],
        description:
          'Model for task decomposition. Claude: opus, sonnet, haiku. Gemini: flash, pro (default: sonnet)',
      },
      maxTasks: {
        type: 'number',
        description: 'Maximum tasks to generate (default: 10, max: 20)',
      },
    },
    required: ['issue'],
  },

  template: {
    when: 'Generate PRD from issue',
    params: '`issue: "123"`',
  },

  workflow: {
    trigger: 'before_task',
    order: 1,
  },

  category: 'advanced',

  handler: async (args, workspaceRoot) => {
    // Auto-setup plugin in background (non-blocking)
    const pluginStatus = ensurePluginInstalled();

    // Validate issue number
    const issueNumber = sanitizeIssueNumber(args.issue);
    if (issueNumber === null) {
      return `<prd-error>Invalid issue number: ${args.issue}. Must be a positive integer.</prd-error>`;
    }

    // Resolve project path
    const projectArg = typeof args.project === 'string' ? args.project : undefined;
    const resolved = resolveProjectPath(workspaceRoot, projectArg);

    if ('error' in resolved) {
      return `<prd-error>${resolved.error}</prd-error>`;
    }

    try {
      // Dynamic import to avoid loading heavy modules at startup
      const { runLightweightPrd } = await import('@/commands/prd');

      const model = args.model as
        | 'opus'
        | 'sonnet'
        | 'haiku'
        | 'flash'
        | 'pro'
        | 'gemini-flash'
        | 'gemini-pro'
        | undefined;
      const maxTasks = typeof args.maxTasks === 'number' ? Math.min(args.maxTasks, 20) : 10;

      const result = await runLightweightPrd(resolved.path, {
        issue: issueNumber,
        model,
        maxTasks,
      });

      // Add plugin setup message and next steps
      let output = result;
      if (pluginStatus.message) {
        output += `\n\n<plugin-setup>\n${pluginStatus.message}\n</plugin-setup>`;
      }

      // Add next steps instruction
      const prdFilename = `issue-${issueNumber}.json`;
      output += `\n\n<next-steps>
To execute this PRD, run:
  /prd-run .krolik/ralph/prd/${prdFilename}
</next-steps>`;

      return output;
    } catch (error) {
      return formatError(error);
    }
  },
};

registerTool(prdTool);
