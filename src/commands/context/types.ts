/**
 * @module commands/context/types
 * @description Type definitions for context module
 */

import type { ContextResult, KrolikConfig } from "../../types";
import type { SchemaOutput } from "../schema/output";
import type { RoutesOutput } from "../routes/output";
import type {
  ZodSchemaInfo,
  ComponentInfo,
  TestInfo,
  ExtractedType,
  ImportRelation,
} from "./parsers";

/**
 * Context command options
 */
export interface ContextOptions {
  issue?: string;
  feature?: string;
  file?: string;
  json?: boolean;
  markdown?: boolean;
  ai?: boolean;
  verbose?: boolean;
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
}
