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

import type { FelixGuardrail } from '@/lib/@storage/felix/types';
import type { Memory } from '@/lib/@storage/memory';
import type { StoredSkill } from '@/lib/@storage/skills';
import type { OutputFormat } from '../../types/commands/base';

export type { FelixGuardrail } from '@/lib/@storage/felix/types';
export type { Memory } from '@/lib/@storage/memory';
export type { StoredSkill } from '@/lib/@storage/skills';
// Re-export shared types from lib
export type { RepoStats } from '../../lib/@agents';
export type { VersionInfo } from '../../lib/@vcs';

// ... (existing code)

/**
 * Agent category
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
 * Agent category information
 */
export interface AgentCategoryInfo {
  name: string;
  label: string;
  description: string;
  aliases: string[];
  plugins: string[];
  primaryAgents: string[];
}

/**
 * Component type
 */
export type ComponentType = 'agent' | 'command' | 'skill' | 'workflow';

/**
 * Agent definition
 */
export interface AgentDefinition {
  name: string;
  description: string;
  content: string;
  category: AgentCategory;
  plugin: string;
  filePath: string;
  componentType: ComponentType;
  model?: 'sonnet' | 'opus' | 'haiku' | 'inherit';
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
  includeSkills?: boolean | undefined;
  format?: OutputFormat | undefined;
  verbose?: boolean | undefined;
  dryRun?: boolean | undefined;
  // LLM options
  model?: string | undefined;
  backend?: 'cli' | 'api' | undefined;
  // Plugin skills (loaded by plugin name)
  pluginSkills?: StoredSkill[] | undefined;
}

/**
 * Library documentation snippet
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
  skills?: FelixGuardrail[];
  pluginSkills?: StoredSkill[]; // Skills from agent's plugin
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
