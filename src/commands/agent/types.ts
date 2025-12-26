/**
 * @module commands/agent/types
 * @description Agent command types
 *
 * Terminology from wshobson/agents:
 * - Plugin: folder bundle containing agents, commands, skills
 * - Agent: specialized AI prompt (.md in agents/ folder)
 * - Command: slash command/workflow (.md in commands/ folder)
 * - Skill: progressive disclosure knowledge (SKILL.md in skills/[name]/ folder)
 */

import type { Memory } from '../../lib/@memory';
import type { OutputFormat } from '../../types';

// Re-export shared types from lib
export type { RepoStats } from '../../lib/@agents';
export type { VersionInfo } from '../../lib/@git';
export type { Memory } from '../../lib/@memory';

/**
 * Component type in wshobson/agents
 */
export type ComponentType = 'agent' | 'command' | 'skill';

/**
 * Agent definition from wshobson/agents
 */
export interface AgentDefinition {
  name: string;
  description: string;
  model?: 'sonnet' | 'opus' | 'haiku' | 'inherit';
  content: string;
  category: AgentCategory;
  plugin: string;
  filePath: string;
  componentType: ComponentType;
}

/**
 * Agent category for grouping
 */
export type AgentCategory =
  | 'security'
  | 'performance'
  | 'architecture'
  | 'quality'
  | 'debugging'
  | 'docs'
  | 'frontend'
  | 'backend'
  | 'database'
  | 'devops'
  | 'testing'
  | 'other';

/**
 * Agent category metadata
 */
export interface AgentCategoryInfo {
  name: AgentCategory;
  label: string;
  description: string;
  aliases: string[];
  plugins: string[];
  primaryAgents: string[];
}

/**
 * Agent command options
 */
export interface AgentOptions {
  list?: boolean | undefined;
  category?: AgentCategory | undefined;
  target?: string | undefined;
  file?: string | undefined;
  feature?: string | undefined;
  includeSchema?: boolean | undefined;
  includeRoutes?: boolean | undefined;
  includeGit?: boolean | undefined;
  includeMemory?: boolean | undefined;
  format?: OutputFormat | undefined;
  verbose?: boolean | undefined;
  dryRun?: boolean | undefined;
}

/**
 * Library documentation snippet for agent context
 */
export interface LibraryDocSnippet {
  library: string;
  title: string;
  snippet: string;
}

/**
 * Agent execution context
 */
export interface AgentContext {
  projectRoot: string;
  schema?: string;
  routes?: string;
  gitStatus?: string;
  gitDiff?: string;
  targetFile?: string;
  targetContent?: string;
  feature?: string;
  libraryDocs?: LibraryDocSnippet[];
  memories?: Memory[];
}

/**
 * Agent execution result
 */
export interface AgentResult {
  agent: string;
  category: AgentCategory;
  success: boolean;
  output: string;
  issues?: AgentIssue[];
  suggestions?: AgentSuggestion[];
  durationMs: number;
}

/**
 * Issue found by agent
 */
export interface AgentIssue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  file?: string;
  line?: number;
  fix?: string;
}

/**
 * Suggestion from agent
 */
export interface AgentSuggestion {
  title: string;
  description: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  effort: 'low' | 'medium' | 'high';
}
