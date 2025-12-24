/**
 * @module commands/context/types
 * @description Type definitions for context module
 */

import type { ContextResult, KrolikConfig, OutputFormat } from '../../types';
import type { RoutesOutput } from '../routes/output';
import type { SchemaOutput } from '../schema/output';
import type {
  ComponentInfo,
  ExtractedType,
  ImportRelation,
  TestInfo,
  ZodSchemaInfo,
} from './parsers';

/**
 * Context command options
 */
export interface ContextOptions {
  issue?: string;
  feature?: string;
  file?: string;
  format?: OutputFormat;
  verbose?: boolean;
  /** Include quality issues from audit */
  withAudit?: boolean;
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
 * Extended context data for AI output
 */
export interface AiContextData {
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
  // Quality issues (from --with-audit)
  qualityIssues?: ContextQualityIssue[];
  qualitySummary?: ContextQualitySummary;
}
