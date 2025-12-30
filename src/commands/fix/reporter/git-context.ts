/**
 * @module commands/fix/reporter/git-context
 * @description Git and AI rules context for reports
 */

import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { AIRuleFile, GitInfo } from './types';

// ============================================================================
// GIT INFO
// ============================================================================

/**
 * Execute a git command and return the output
 */
function gitExec(cmd: string, cwd: string): string {
  try {
    return execSync(cmd, { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return '';
  }
}

/**
 * Get git information for the report
 */
export function getGitInfo(projectRoot: string): GitInfo | undefined {
  const branch = gitExec('git branch --show-current', projectRoot);
  if (!branch) return undefined;

  const statusOutput = gitExec('git status --porcelain', projectRoot);
  const lines = statusOutput.split('\n').filter(Boolean);

  let modified = 0;
  let untracked = 0;
  let staged = 0;

  for (const line of lines) {
    const index = line[0];
    const worktree = line[1];

    if (index === '?' && worktree === '?') {
      untracked++;
    } else if (index !== ' ' && index !== '?') {
      staged++;
    }
    if (worktree === 'M' || worktree === 'D') {
      modified++;
    }
  }

  // Get recent commits
  const commitsOutput = gitExec('git log --oneline -5 --format="%h|%s|%cr"', projectRoot);
  const recentCommits = commitsOutput
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [hash, message, relativeDate] = line.split('|');
      return { hash: hash ?? '', message: message ?? '', relativeDate: relativeDate ?? '' };
    });

  return { branch, modified, untracked, staged, recentCommits };
}

// ============================================================================
// AI RULES
// ============================================================================

/**
 * Find AI rules files in the project
 */
export function findAIRulesFiles(projectRoot: string): AIRuleFile[] {
  const files: AIRuleFile[] = [];

  // Check for CLAUDE.md at root
  if (fs.existsSync(path.join(projectRoot, 'CLAUDE.md'))) {
    files.push({ path: 'CLAUDE.md', scope: 'root' });
  }

  // Check for .claude directory
  const claudeDir = path.join(projectRoot, '.claude');
  if (fs.existsSync(claudeDir) && fs.statSync(claudeDir).isDirectory()) {
    const claudeFiles = fs.readdirSync(claudeDir).filter((f) => f.endsWith('.md'));
    for (const f of claudeFiles) {
      files.push({ path: `.claude/${f}`, scope: 'root' });
    }
  }

  return files;
}
