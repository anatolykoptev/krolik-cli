/**
 * @module types/commands/status
 * @description Status command result types
 */

/**
 * Status command result
 */
export interface StatusResult {
  health: 'good' | 'warning' | 'error';
  branch: {
    name: string;
    isCorrect: boolean;
  };
  git: {
    hasChanges: boolean;
    modified: number;
    untracked: number;
    staged: number;
    ahead?: number;
    behind?: number;
  };
  typecheck: {
    status: 'passed' | 'failed' | 'skipped';
    cached: boolean;
    errors?: string;
  };
  lint: {
    warnings: number;
    errors: number;
  };
  todos: {
    count: number;
  };
  durationMs: number;
  /** Package info (optional, for rich output) */
  package?: {
    name: string;
    version: string;
    depsCount: number;
    devDepsCount: number;
  };
  /** Tech stack (optional, for rich output) */
  techStack?: {
    framework?: string;
    language: 'typescript' | 'javascript';
    ui: string[];
    database: string[];
    api: string[];
    packageManager: string;
  };
  /** Recent commits (optional, for rich output) */
  recentCommits?: Array<{
    hash: string;
    message: string;
    author: string;
    relativeDate: string;
  }>;
  /** File stats (optional, for rich output) */
  fileStats?: {
    sourceFiles: number;
    testFiles: number;
  };
  /** Monorepo workspaces (optional) */
  workspaces?: Array<{
    name: string;
    path: string;
    type: 'app' | 'package' | 'config' | 'unknown';
  }>;
  /** AI rules files for agents to read (IMPORTANT!) */
  aiRules?: Array<{
    path: string;
    relativePath: string;
    scope: 'root' | 'package' | 'app';
  }>;
  /** Current branch context */
  branchContext?: {
    name: string;
    type: 'feature' | 'fix' | 'chore' | 'release' | 'hotfix' | 'main' | 'develop' | 'unknown';
    issueNumber?: number;
    description?: string;
  };
  /** Recent memory entries (decisions, patterns, bugfixes, library knowledge, etc.) */
  memory?: Array<{
    type:
      | 'decision'
      | 'pattern'
      | 'bugfix'
      | 'observation'
      | 'feature'
      | 'library'
      | 'snippet'
      | 'anti-pattern';
    title: string;
    tags?: string[];
  }>;
}
