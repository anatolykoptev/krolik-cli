/**
 * @module commands/context/types
 * @description Type definitions for context module
 */

import type { Memory } from '../../lib/@memory';
import type { ContextResult, KrolikConfig, OutputFormat } from '../../types';
import type { RoutesOutput } from '../routes/output';
import type { SchemaOutput } from '../schema/output';
import type { TodoItem } from '../status/todos';
import type { ArchitecturePatterns } from './helpers';
import type {
  ComponentInfo,
  DbRelations,
  EnvVarsReport,
  ExtractedType,
  ImportGraph,
  ImportRelation,
  RouterContract,
  TestInfo,
  ZodSchemaInfo,
} from './parsers';

/**
 * Context generation mode
 * - quick: architecture, git, tree, schema, routes only
 * - deep: imports, types, env, contracts only (complements quick)
 * - full: all sections (quick + deep)
 */
export type ContextMode = 'quick' | 'deep' | 'full';

/**
 * Context command options
 */
export interface ContextOptions {
  issue?: string;
  feature?: string;
  file?: string;
  format?: OutputFormat;
  verbose?: boolean;
  /** Quick mode: architecture, git, tree, schema, routes only */
  quick?: boolean;
  /** Deep mode: imports, types, env, contracts only (complements --quick) */
  deep?: boolean;
  /** Include quality issues from audit */
  withAudit?: boolean;
  /** Include architecture patterns for AI agents (default: true) */
  architecture?: boolean;
  /** Include GitHub issues from gh CLI */
  withIssues?: boolean;
}

/**
 * File discovery result
 */
export interface DiscoveredFiles {
  zodSchemas: string[];
  components: string[];
  tests: string[];
}

/**
 * Git status for AI context
 */
export interface GitContextInfo {
  branch: string;
  changedFiles: string[];
  stagedFiles: string[];
  untrackedFiles: string[];
  diff?: string;
  recentCommits?: string[];
}

/**
 * Project tree for AI context
 */
export interface ProjectTree {
  structure: string;
  totalFiles: number;
  totalDirs: number;
}

/**
 * Quality issue for context (simplified from EnrichedIssue)
 */
export interface ContextQualityIssue {
  file: string;
  line?: number;
  category: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  autoFixable: boolean;
  fixerId?: string;
}

/**
 * Quality summary for context
 */
export interface ContextQualitySummary {
  totalIssues: number;
  autoFixable: number;
  byCategory: Record<string, number>;
}

/**
 * Library documentation for context
 * Contains auto-fetched docs from Context7
 */
export interface LibraryDocsEntry {
  /** Library name (e.g., "next.js", "prisma") */
  libraryName: string;
  /** Context7 library ID */
  libraryId: string;
  /** Status of the library (cached, expired, fetched, unavailable) */
  status: 'cached' | 'expired' | 'fetched' | 'unavailable';
  /** Relevant documentation sections */
  sections: Array<{
    title: string;
    content: string;
    codeSnippets: string[];
  }>;
}

/**
 * GitHub issues data for context
 * Contains issues fetched via gh CLI
 */
export interface GitHubIssuesData {
  /** Total number of issues fetched */
  count: number;
  /** Source of the data */
  source: 'gh cli';
  /** List of issues */
  issues: Array<{
    number: number;
    title: string;
    state: 'open' | 'closed';
    labels: string[];
  }>;
}

/**
 * Extended context data for AI output
 */
export interface AiContextData {
  /** Context generation mode (quick/deep/full) */
  mode: ContextMode;
  /** ISO timestamp when context was generated */
  generatedAt: string;
  context: ContextResult;
  config?: KrolikConfig;
  schema?: SchemaOutput;
  routes?: RoutesOutput;
  checklist?: string[];
  files?: DiscoveredFiles;
  // Enhanced sections
  ioSchemas?: ZodSchemaInfo[];
  componentDetails?: ComponentInfo[];
  testDetails?: TestInfo[];
  hints?: Record<string, string>;
  // Git and project structure
  git?: GitContextInfo;
  tree?: ProjectTree;
  // TypeScript types and dependencies
  types?: ExtractedType[];
  imports?: ImportRelation[];
  // Import graph with circular dependency detection
  importGraph?: ImportGraph;
  // Database relations from Prisma schema
  dbRelations?: DbRelations;
  // tRPC API contracts with input/output types
  apiContracts?: RouterContract[];
  // Environment variables analysis
  envVars?: EnvVarsReport;
  // Quality issues (from --with-audit)
  qualityIssues?: ContextQualityIssue[];
  qualitySummary?: ContextQualitySummary;
  // Memory from previous sessions
  memories?: Memory[];
  // Architecture patterns (from --architecture)
  architecture?: ArchitecturePatterns;
  // Library documentation from Context7 (auto-fetched)
  libraryDocs?: LibraryDocsEntry[];
  // TODO/FIXME/HACK/XXX comments from codebase
  todos?: TodoItem[];
  // GitHub issues (from --with-issues)
  githubIssues?: GitHubIssuesData;
}
