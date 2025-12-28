/**
 * @module commands/context/types
 * @description Type definitions for context module
 */

import type { Memory } from '@/lib/storage/memory';
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
 * - minimal: ultra-compact (~1500 tokens) - summary, git, memory only
 * - quick: compact (~3500 tokens) - architecture, git, tree, schema, routes, repo-map
 * - deep: imports, types, env, contracts only (complements quick)
 * - full: all sections (quick + deep)
 */
export type ContextMode = 'minimal' | 'quick' | 'deep' | 'full';

/**
 * Context command options
 */
export interface ContextOptions {
  issue?: string;
  feature?: string;
  file?: string;
  format?: OutputFormat;
  verbose?: boolean;
  /** Minimal mode: ultra-compact (~1500 tokens) - summary, git, memory only */
  minimal?: boolean;
  /** Quick mode: compact (~3500 tokens) - architecture, git, tree, schema, routes, repo-map */
  quick?: boolean;
  /** Deep mode: imports, types, env, contracts only (complements --quick) */
  deep?: boolean;
  /** Include quality issues from audit */
  withAudit?: boolean;
  /** Include architecture patterns for AI agents (default: true) */
  architecture?: boolean;
  /** Include GitHub issues from gh CLI */
  withIssues?: boolean;
  /** Token budget for smart context (default: 4000) */
  budget?: number;
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
 * Lib module function info for context
 */
export interface LibModuleFunction {
  /** Function name */
  name: string;
  /** Function signature (e.g., "(path: string): boolean") */
  signature: string;
}

/**
 * Lib module info for context
 */
export interface LibModuleInfo {
  /** Module name without @ prefix (e.g., 'fs', 'discovery') */
  name: string;
  /** Import path (e.g., '@/lib/@fs') */
  importPath: string;
  /** Number of exports */
  exportCount: number;
  /** Top functions (for key modules) */
  functions?: LibModuleFunction[];
}

/**
 * Lib modules data for context
 * Contains scanned lib/@* modules with exports
 */
export interface LibModulesData {
  /** Total number of modules */
  moduleCount: number;
  /** Total number of exports */
  totalExports: number;
  /** List of modules */
  modules: LibModuleInfo[];
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
  // Lib modules from src/lib/@* (included in all modes)
  libModules?: LibModulesData;
  // Repository map from smart context (from --smart or --map-only)
  repoMap?: string;
}
