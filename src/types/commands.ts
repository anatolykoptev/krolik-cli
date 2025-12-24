/**
 * @module types/commands
 * @description Command-related type definitions
 */

import type { ResolvedConfig } from './config';
import type { QualitySeverity } from "../commands/fix/types";

// Type alias for backwards compatibility (ReviewSeverity = QualitySeverity)
export type ReviewSeverity = QualitySeverity;

/**
 * Output format for command results
 * Default is 'ai' (AI-friendly XML format)
 */
export type OutputFormat = 'ai' | 'json' | 'text' | 'markdown';

/**
 * Log levels
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

/**
 * Logger interface for dependency injection
 */
export interface Logger {
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  success(message: string): void;
  section(title: string): void;
  box(lines: string[], type?: 'info' | 'success' | 'warning' | 'error'): void;
}

/**
 * Base options for all commands
 */
export interface BaseCommandOptions {
  /** Output format (default: 'ai' for AI-friendly XML) */
  format?: OutputFormat;
  /** Enable verbose logging */
  verbose?: boolean;
  /** Dry run mode (no changes) */
  dryRun?: boolean;
  /** Custom config path */
  config?: string;
  /** Project root override */
  projectRoot?: string;
  /** Human-readable text output */
  text?: boolean;
  /** JSON output */
  json?: boolean;
}

/**
 * Command context passed to all commands
 */
export interface CommandContext {
  /** Resolved configuration */
  config: ResolvedConfig;
  /** Logger instance */
  logger: Logger;
  /** Command options */
  options: BaseCommandOptions;
}

/**
 * Generic command result
 */
export interface CommandResult<T = unknown> {
  /** Whether command succeeded */
  success: boolean;
  /** Result data */
  data?: T;
  /** Error message if failed */
  error?: string;
  /** Duration in milliseconds */
  durationMs?: number;
}

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
}

/**
 * Review issue categories
 */
export type ReviewCategory = 'security' | 'performance' | 'style' | 'logic' | 'test' | 'docs';

/**
 * Single review issue
 */
export interface ReviewIssue {
  file: string;
  line?: number;
  severity: ReviewSeverity;
  category: ReviewCategory;
  message: string;
  suggestion?: string;
}

/**
 * File change information
 */
export interface FileChange {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  binary: boolean;
}

/**
 * Review result
 */
export interface ReviewResult {
  title: string;
  description: string;
  baseBranch: string;
  headBranch: string;
  files: FileChange[];
  issues: ReviewIssue[];
  affectedFeatures: string[];
  summary: {
    totalFiles: number;
    additions: number;
    deletions: number;
    riskLevel: 'low' | 'medium' | 'high';
    testsRequired: boolean;
    docsRequired: boolean;
  };
}

/**
 * Schema model definition
 */
export interface SchemaModel {
  name: string;
  fields: SchemaField[];
  relations: SchemaRelation[];
}

/**
 * Schema field definition
 */
export interface SchemaField {
  name: string;
  type: string;
  isOptional: boolean;
  isArray: boolean;
  attributes: string[];
}

/**
 * Schema relation definition
 */
export interface SchemaRelation {
  name: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  target: string;
}

/**
 * Schema analysis result
 */
export interface SchemaResult {
  models: SchemaModel[];
  enums: Array<{ name: string; values: string[] }>;
  modelCount: number;
  enumCount: number;
}

/**
 * Route procedure definition
 */
export interface RouteProcedure {
  name: string;
  type: 'query' | 'mutation' | 'subscription';
  input?: string;
  output?: string;
}

/**
 * Router definition
 */
export interface RouterDefinition {
  name: string;
  file: string;
  procedures: RouteProcedure[];
}

/**
 * Routes analysis result
 */
export interface RoutesResult {
  routers: RouterDefinition[];
  totalProcedures: number;
  queries: number;
  mutations: number;
}

/**
 * Context command result
 */
export interface ContextResult {
  /** Task description or issue title */
  task: string;
  /** Detected domains */
  domains: string[];
  /** Related files found */
  relatedFiles: string[];
  /** Suggested implementation approach */
  approach: string[];
  /** GitHub issue if provided */
  issue?: {
    number: number;
    title: string;
    body: string;
    labels: string[];
  };
}

/**
 * Issue parsing result
 */
export interface IssueResult {
  number: number;
  title: string;
  description: string;
  checklist: ChecklistItem[];
  labels: string[];
  domains: string[];
}

/**
 * Checklist item from issue
 */
export interface ChecklistItem {
  text: string;
  checked: boolean;
  subtasks?: ChecklistItem[];
}

/**
 * Security audit result
 */
export interface SecurityResult {
  vulnerabilities: SecurityVulnerability[];
  codeIssues: SecurityCodeIssue[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

/**
 * Security vulnerability from npm audit
 */
export interface SecurityVulnerability {
  package: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  path: string;
  fixAvailable: boolean;
}

/**
 * Security issue in code
 */
export interface SecurityCodeIssue {
  file: string;
  line: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  pattern: string;
  message: string;
  suggestion?: string;
}
