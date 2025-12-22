/**
 * @module types/commands
 * @description Command-related type definitions
 */

import type { ResolvedConfig } from './config';

/**
 * Output format for command results
 */
export type OutputFormat = 'text' | 'json' | 'markdown';

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
  /** Output format */
  output?: OutputFormat;
  /** Enable verbose logging */
  verbose?: boolean;
  /** Dry run mode (no changes) */
  dryRun?: boolean;
  /** Custom config path */
  config?: string;
  /** Project root override */
  projectRoot?: string;
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
}

/**
 * Review severity levels
 */
export type ReviewSeverity = 'error' | 'warning' | 'info';

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
